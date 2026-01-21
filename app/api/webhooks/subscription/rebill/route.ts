import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { payment } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { RebillWebhookRequest } from '../_lib/types';
import {
  validateWebhookSecret,
  validateRequiredFields,
  findUserByEmail,
  findUserSubscription,
  extendSubscriptionPeriod,
  reactivateUser,
  createWebhookResponse,
} from '../_lib/helpers';

/**
 * Webhook endpoint for successful subscription rebill/renewal
 * 
 * POST /api/webhooks/subscription/rebill
 * 
 * Called by Zapier when ThriveCart triggers a successful rebill event.
 * Extends the user's subscription by 30 days and reactivates if suspended.
 * 
 * @example Request Body (from Zapier):
 * {
 *   "email": "kunde@example.com",
 *   "orderId": "37313646",
 *   "amount": 4900,
 *   "currency": "EUR",
 *   "productName": "MYLO Miles & Travel Concierge",
 *   "webhookSecret": "your-secret"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: RebillWebhookRequest = await req.json();
    const { email, orderId, amount, currency, productName, customerId, webhookSecret } = body;

    console.log('📥 Rebill webhook received for:', email);

    // 1. Validate required fields
    const validation = validateRequiredFields(body);
    if (!validation.valid) {
      console.warn('⚠️ Validation failed:', validation.error);
      return NextResponse.json(
        createWebhookResponse(false, validation.error || 'Validation failed'),
        { status: 400 }
      );
    }

    // 2. Validate webhook secret
    if (!validateWebhookSecret(webhookSecret)) {
      console.warn('⚠️ Invalid webhook secret attempt for:', email);
      return NextResponse.json(
        createWebhookResponse(false, 'Unauthorized'),
        { status: 401 }
      );
    }

    // 3. Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      console.warn('⚠️ User not found for rebill:', email);
      return NextResponse.json(
        createWebhookResponse(false, 'User not found', { error: `No user with email ${email}` }),
        { status: 404 }
      );
    }

    console.log('✅ User found:', user.id, user.name);

    // 4. Check for idempotency (prevent duplicate processing)
    if (orderId) {
      const existingPayment = await db.query.payment.findFirst({
        where: eq(payment.thrivecardPaymentId, orderId),
      });

      if (existingPayment) {
        console.log('ℹ️ Rebill already processed for order:', orderId);
        return NextResponse.json(
          createWebhookResponse(true, 'Already processed', {
            userId: user.id,
          }),
          { status: 200 }
        );
      }
    }

    // 5. Find user's subscription
    const userSubscription = await findUserSubscription(user.id);
    if (!userSubscription) {
      console.warn('⚠️ No subscription found for user:', user.id);
      return NextResponse.json(
        createWebhookResponse(false, 'No subscription found for user'),
        { status: 404 }
      );
    }

    // 6. Extend subscription by 30 days from NOW (not from current period end)
    const updatedSubscription = await extendSubscriptionPeriod(userSubscription.id, new Date());
    console.log('✅ Subscription extended until:', updatedSubscription.currentPeriodEnd);

    // 7. Reactivate user if they were suspended
    if (!user.isActive || user.activationStatus !== 'active') {
      await reactivateUser(user.id);
      console.log('✅ User reactivated:', user.id);
    }

    // 8. Record the payment for audit trail
    const paymentId = crypto.randomBytes(16).toString('hex');
    const now = new Date();

    // Convert amount from Euro (e.g., 47.00) to cents (4700) for integer storage
    const amountInCents = Math.round(parseFloat(String(amount || 0)) * 100);

    await db.insert(payment).values({
      id: paymentId,
      createdAt: now,
      updatedAt: now,
      userId: user.id,
      totalAmount: amountInCents,
      currency: currency || 'EUR',
      status: 'succeeded',
      thrivecardPaymentId: orderId || null,
      thrivecardCustomerId: customerId || null,
      paymentProvider: 'thrivecart',
      webhookSource: 'zapier',
      metadata: JSON.stringify({
        event: 'rebill',
        productName: productName || null,
        processedAt: now.toISOString(),
        originalAmount: amount,
      }),
    });

    // Non-blocking: log success metrics
    after(() => {
      console.log('✅ Payment record created:', paymentId);
      console.log('🎉 Rebill processed successfully for:', email);
    });

    return NextResponse.json(
      createWebhookResponse(true, 'Subscription extended successfully', {
        userId: user.id,
        subscriptionId: userSubscription.id,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error processing rebill webhook:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      createWebhookResponse(false, 'Internal server error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
