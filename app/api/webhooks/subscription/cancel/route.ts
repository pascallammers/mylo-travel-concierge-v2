import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import type { CancelWebhookRequest } from '../_lib/types';
import {
  validateWebhookSecret,
  validateRequiredFields,
  findUserByEmail,
  findUserSubscription,
  markSubscriptionCancelled,
  createWebhookResponse,
} from '../_lib/helpers';

/**
 * Webhook endpoint for subscription cancellation
 * 
 * POST /api/webhooks/subscription/cancel
 * 
 * Called by Zapier when ThriveCart triggers a subscription_cancelled event.
 * Marks the subscription for cancellation at period end - user keeps access until then.
 * 
 * @example Request Body (from Zapier):
 * {
 *   "email": "kunde@example.com",
 *   "orderId": "37313646",
 *   "cancelledAt": "2025-12-02T10:30:00Z",
 *   "webhookSecret": "your-secret"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: CancelWebhookRequest = await req.json();
    const { email, orderId, cancelledAt, cancellationReason, webhookSecret } = body;

    console.log('📥 Cancellation webhook received for:', email);

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
      console.warn('⚠️ User not found for cancellation:', email);
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
      return NextResponse.json(
        createWebhookResponse(false, 'No subscription found for user'),
        { status: 404 }
      );
    }

    // 5. Mark subscription as cancelled at period end
    const updatedSubscription = await markSubscriptionCancelled(userSubscription.id);
    
    // Non-blocking: log the cancellation with details
    const accessUntil = userSubscription.currentPeriodEnd;
    after(() => {
      console.log('⚠️ Subscription cancelled for:', email);
      console.log('📅 User retains access until:', accessUntil);
      if (cancellationReason) {
        console.log('📝 Cancellation reason:', cancellationReason);
      }
    });

    // Note: User is NOT suspended here - they keep access until currentPeriodEnd
    // A scheduled job or middleware should check currentPeriodEnd and suspend when it passes

    return NextResponse.json(
      createWebhookResponse(true, 'Subscription marked for cancellation at period end', {
        userId: user.id,
        subscriptionId: userSubscription.id,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error processing cancellation webhook:', error);
    return NextResponse.json(
      createWebhookResponse(false, 'Internal server error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
