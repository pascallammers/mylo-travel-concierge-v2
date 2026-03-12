import { db } from '@/lib/db';
import {
  user,
  account,
  subscription,
  payment,
  thrivecartWebhookLog,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail, sendFailedPaymentAdminAlert } from '@/lib/email';
import {
  extendSubscriptionPeriod,
  reactivateUser,
  suspendUser,
  markSubscriptionCancelled,
  markSubscriptionPastDue,
  revokeUserAccessImmediately,
  getGracePeriodDays,
  findUserByEmail,
  findUserSubscription,
} from '@/app/api/webhooks/subscription/_lib/helpers';
import type { ThriveCartWebhookPayload, WebhookProcessingResult } from './types';
import { generateId } from 'ai';
import { logAdminActivity } from '@/lib/admin/activity-logger';

/**
 * Process a ThriveCart webhook event.
 * Logs the event, checks for duplicates, then dispatches to the appropriate handler.
 */
export async function processWebhookEvent(
  payload: ThriveCartWebhookPayload
): Promise<WebhookProcessingResult> {
  const email = payload.customer?.email?.toLowerCase().trim();
  const eventType = payload.event;
  const orderId = String(payload.order_id || '');
  const eventId = payload.event_id ? String(payload.event_id) : null;

  if (!email) {
    return { success: false, action: 'rejected', error: 'No customer email in payload' };
  }

  // Check for duplicate event processing (idempotency)
  if (eventId) {
    const [existing] = await db
      .select()
      .from(thrivecartWebhookLog)
      .where(eq(thrivecartWebhookLog.eventId, eventId))
      .limit(1);
    if (existing) {
      console.log(`[ThriveCart] Duplicate event ${eventId} skipped`);
      return { success: true, action: 'skipped_duplicate' };
    }
  }

  let result: WebhookProcessingResult;

  try {
    switch (eventType) {
      case 'order.success':
        result = await handleOrderSuccess(payload, email);
        break;
      case 'order.subscription_payment':
        result = await handleSubscriptionPayment(payload, email);
        break;
      case 'order.subscription_cancelled':
        result = await handleSubscriptionCancelled(payload, email);
        break;
      case 'order.refund':
        result = await handleRefund(payload, email);
        break;
      case 'order.rebill_failed':
        result = await handleRebillFailed(payload, email);
        break;
      case 'order.subscription_paused':
        result = await handleSubscriptionPaused(email);
        break;
      case 'order.subscription_resumed':
        result = await handleSubscriptionResumed(email);
        break;
      default:
        result = { success: true, action: `ignored_event_${eventType}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result = { success: false, action: `error_${eventType}`, error: errorMsg };
  }

  // Log the webhook event
  await db.insert(thrivecartWebhookLog).values({
    id: generateId(),
    eventType,
    eventId,
    orderId,
    customerEmail: email,
    payload: payload as unknown as Record<string, unknown>,
    processedAt: new Date(),
    result: result.success ? 'success' : 'error',
    errorMessage: result.error || null,
  });

  return result;
}

// --- Event Handlers ---

async function handleOrderSuccess(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const { customer, order, purchases, order_id, customer_id, currency } = payload;
  const firstName = customer.firstname || '';
  const lastName = customer.lastname || '';
  const orderId = String(order_id);
  const customerId = String(customer_id);

  // Find MYLO product purchase
  const myloPurchase = purchases?.find((p) => p.product_id === 5) || purchases?.[0];
  const amount = myloPurchase?.amount || order?.total || 0;

  // Check if user already exists
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    // User exists — check if they need a new subscription
    const existingSub = await findUserSubscription(existingUser.id);

    if (existingSub) {
      // Extend existing subscription
      await extendSubscriptionPeriod(existingSub.id);
      if (!existingUser.isActive) await reactivateUser(existingUser.id);
      return {
        success: true,
        action: 'existing_user_subscription_extended',
        userId: existingUser.id,
        subscriptionId: existingSub.id,
      };
    }

    // Create new subscription for existing user
    const subId = await createSubscription(existingUser.id, {
      amount, currency, orderId, customerId,
      productName: myloPurchase?.product_name,
      subscriptionId: myloPurchase?.subscription?.id,
    });
    if (!existingUser.isActive) await reactivateUser(existingUser.id);

    return {
      success: true,
      action: 'existing_user_new_subscription',
      userId: existingUser.id,
      subscriptionId: subId,
    };
  }

  // New user — create user + account + subscription + send welcome email
  const userId = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(12).toString('base64').slice(0, 12);
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    email,
    name: firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0],
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    activationStatus: 'active',
  });

  const hashedPassword = bcrypt.hashSync(password, 10);
  await db.insert(account).values({
    id: crypto.randomBytes(16).toString('hex'),
    userId,
    accountId: email,
    providerId: 'credential',
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  const subId = await createSubscription(userId, {
    amount, currency, orderId, customerId,
    productName: myloPurchase?.product_name,
    subscriptionId: myloPurchase?.subscription?.id,
  });

  // Record initial payment
  await recordPayment(userId, {
    orderId, customerId, amount, currency,
    event: 'initial_purchase',
    productName: myloPurchase?.product_name,
  });

  // Send welcome email
  try {
    await sendWelcomeEmail(email, password, firstName, 'de');
  } catch (emailError) {
    console.error('[ThriveCart] Failed to send welcome email:', emailError);
  }

  return {
    success: true,
    action: 'new_user_created',
    userId,
    subscriptionId: subId,
  };
}

async function handleSubscriptionPayment(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'rebill', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'rebill', error: `No subscription for: ${email}` };

  // Idempotency is already handled at the top level via event_id in processWebhookEvent.
  // Do NOT check order_id here — ThriveCart reuses the same order_id for initial purchase
  // and all subsequent rebills, which would incorrectly skip all recurring payments.

  await extendSubscriptionPeriod(sub.id);
  if (!foundUser.isActive || foundUser.activationStatus !== 'active') {
    await reactivateUser(foundUser.id);
  }

  const myloPurchase = payload.purchases?.find((p) => p.product_id === 5) || payload.purchases?.[0];
  const eventId = payload.event_id ? String(payload.event_id) : crypto.randomBytes(8).toString('hex');
  await recordPayment(foundUser.id, {
    orderId: eventId,
    customerId: String(payload.customer_id || ''),
    amount: myloPurchase?.amount || payload.order?.total || 0,
    currency: payload.currency || 'EUR',
    event: 'rebill',
    productName: myloPurchase?.product_name,
  });

  return {
    success: true,
    action: 'subscription_extended',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleSubscriptionCancelled(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'cancel', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'cancel', error: `No subscription for: ${email}` };

  await markSubscriptionCancelled(sub.id);

  await logAdminActivity(foundUser.id, 'webhook.cancellation_processed', null, {
    email,
    orderId: String(payload.order_id || ''),
    accessUntil: sub.currentPeriodEnd?.toISOString() ?? null,
  });

  return {
    success: true,
    action: 'subscription_cancelled_at_period_end',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleRefund(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'refund', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'refund', error: `No subscription for: ${email}` };

  // Refund = immediate access revocation (no grace period)
  await revokeUserAccessImmediately(foundUser.id, sub.id, 'refund');

  await logAdminActivity(foundUser.id, 'webhook.refund_processed', null, {
    email,
    orderId: String(payload.order_id || ''),
    amount: payload.order?.total || 0,
  });

  // Record the refund payment with negative amount
  const myloPurchase = payload.purchases?.find((p) => p.product_id === 5) || payload.purchases?.[0];
  const eventId = payload.event_id ? String(payload.event_id) : crypto.randomBytes(8).toString('hex');
  await recordPayment(foundUser.id, {
    orderId: eventId,
    customerId: String(payload.customer_id || ''),
    amount: -(myloPurchase?.amount || payload.order?.total || 0),
    currency: payload.currency || 'EUR',
    event: 'refund',
    productName: myloPurchase?.product_name,
  });

  return {
    success: true,
    action: 'subscription_refunded_access_revoked',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleRebillFailed(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'failed', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'failed', error: `No subscription for: ${email}` };

  await markSubscriptionPastDue(sub.id);

  if (getGracePeriodDays() === 0) {
    await suspendUser(foundUser.id);
  }

  // Send admin alert
  try {
    await sendFailedPaymentAdminAlert(
      email,
      foundUser.name || 'Unbekannt',
      String(payload.order_id || 'N/A'),
      new Date()
    );
  } catch (e) {
    console.error('[ThriveCart] Failed to send admin alert:', e);
  }

  return {
    success: true,
    action: 'subscription_marked_past_due',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleSubscriptionPaused(email: string): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'paused', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'paused', error: `No subscription for: ${email}` };

  await db
    .update(subscription)
    .set({ status: 'past_due', modifiedAt: new Date() })
    .where(eq(subscription.id, sub.id));

  return { success: true, action: 'subscription_paused', userId: foundUser.id, subscriptionId: sub.id };
}

async function handleSubscriptionResumed(email: string): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'resumed', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'resumed', error: `No subscription for: ${email}` };

  await db
    .update(subscription)
    .set({ status: 'active', modifiedAt: new Date() })
    .where(eq(subscription.id, sub.id));

  if (!foundUser.isActive) await reactivateUser(foundUser.id);

  return { success: true, action: 'subscription_resumed', userId: foundUser.id, subscriptionId: sub.id };
}

// --- Helpers ---

async function createSubscription(
  userId: string,
  opts: {
    amount: number;
    currency: string;
    orderId: string;
    customerId: string;
    productName?: string;
    subscriptionId?: string;
  }
): Promise<string> {
  const subId = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.insert(subscription).values({
    id: subId,
    userId,
    status: 'active',
    amount: Math.round(opts.amount / 100), // ThriveCart sends in hundreds
    currency: opts.currency || 'EUR',
    recurringInterval: 'month',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    startedAt: now,
    createdAt: now,
    customerId: opts.customerId || userId,
    productId: 'mylo-subscription',
    checkoutId: opts.orderId || crypto.randomBytes(8).toString('hex'),
    thrivecardCustomerId: opts.customerId || null,
    thrivecardSubscriptionId: opts.subscriptionId || opts.orderId || null,
    planType: 'standard',
    planName: opts.productName || 'MYLO Miles & Travel Concierge',
    lastPaymentDate: now,
    nextPaymentDate: periodEnd,
  });

  return subId;
}

async function recordPayment(
  userId: string,
  opts: {
    orderId: string;
    customerId: string;
    amount: number;
    currency: string;
    event: string;
    productName?: string;
  }
): Promise<void> {
  const now = new Date();
  await db.insert(payment).values({
    id: crypto.randomBytes(16).toString('hex'),
    createdAt: now,
    updatedAt: now,
    userId,
    totalAmount: Math.round(opts.amount / 100) * 100, // normalize to cents
    currency: opts.currency || 'EUR',
    status: 'succeeded',
    thrivecardPaymentId: opts.orderId || null,
    thrivecardCustomerId: opts.customerId || null,
    paymentProvider: 'thrivecart',
    webhookSource: 'direct',
    syncSource: 'webhook',
    metadata: JSON.stringify({
      event: opts.event,
      productName: opts.productName || null,
      processedAt: now.toISOString(),
    }),
  });
}
