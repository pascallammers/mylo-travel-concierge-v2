import { NextRequest, NextResponse } from 'next/server';
import { sendFailedPaymentAdminAlert } from '@/lib/email';
import type { FailedPaymentWebhookRequest } from '../_lib/types';
import {
  validateWebhookSecret,
  validateRequiredFields,
  findUserByEmail,
  findUserSubscription,
  markSubscriptionPastDue,
  suspendUser,
  getGracePeriodDays,
  createWebhookResponse,
} from '../_lib/helpers';

/**
 * Webhook endpoint for failed subscription payment
 * 
 * POST /api/webhooks/subscription/failed
 * 
 * Called by Zapier when ThriveCart triggers a rebill_failed event.
 * Suspends the user immediately (or after grace period) and sends admin notification.
 * 
 * @example Request Body (from Zapier):
 * {
 *   "email": "kunde@example.com",
 *   "orderId": "37313646",
 *   "failedAt": "2025-12-02T10:30:00Z",
 *   "webhookSecret": "your-secret"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: FailedPaymentWebhookRequest = await req.json();
    const { email, orderId, failedAt, webhookSecret } = body;

    console.log('📥 Failed payment webhook received for:', email);

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
      console.warn('⚠️ User not found for failed payment:', email);
      return NextResponse.json(
        createWebhookResponse(false, 'User not found', { error: `No user with email ${email}` }),
        { status: 404 }
      );
    }

    console.log('✅ User found:', user.id, user.name);

    // 4. Find user's subscription
    const userSubscription = await findUserSubscription(user.id);
    if (!userSubscription) {
      console.warn('⚠️ No subscription found for user:', user.id);
      // Still send admin alert even if no subscription found
      await sendFailedPaymentAdminAlert(
        email,
        user.name || 'Unbekannt',
        orderId || 'N/A',
        failedAt ? new Date(failedAt) : new Date()
      );
      return NextResponse.json(
        createWebhookResponse(false, 'No subscription found for user'),
        { status: 404 }
      );
    }

    // 5. Mark subscription as past_due
    const updatedSubscription = await markSubscriptionPastDue(userSubscription.id);
    console.log('✅ Subscription marked as past_due:', userSubscription.id);

    // 6. Check grace period and suspend if needed
    const gracePeriodDays = getGracePeriodDays();
    
    if (gracePeriodDays === 0) {
      // Immediate suspension
      await suspendUser(user.id);
      console.log('🚫 User suspended immediately:', user.id);
    } else {
      console.log(`⏳ User in grace period (${gracePeriodDays} days):`, user.id);
      // User will be suspended when grace period expires
      // This could be handled by a cron job or checked on login
    }

    // 7. Send admin notification
    const failedAtDate = failedAt ? new Date(failedAt) : new Date();
    await sendFailedPaymentAdminAlert(
      email,
      user.name || 'Unbekannt',
      orderId || 'N/A',
      failedAtDate
    );
    console.log('📧 Admin notification sent for:', email);

    console.log('❌ Failed payment processed for:', email);

    return NextResponse.json(
      createWebhookResponse(true, 'Failed payment processed - user suspended', {
        userId: user.id,
        subscriptionId: userSubscription.id,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error processing failed payment webhook:', error);
    return NextResponse.json(
      createWebhookResponse(false, 'Internal server error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
