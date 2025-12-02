import { db } from '@/lib/db';
import { user, subscription } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { BaseWebhookRequest, WebhookResponse } from './types';

// Webhook secret from environment
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Grace period in days (0 = immediate suspension)
const GRACE_PERIOD_DAYS = parseInt(process.env.GRACE_PERIOD_DAYS || '0');

/**
 * Validate webhook secret from request
 * @param webhookSecret - Secret from request body
 * @returns true if valid, false otherwise
 */
export function validateWebhookSecret(webhookSecret: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('❌ WEBHOOK_SECRET not configured in environment');
    return false;
  }
  return webhookSecret === WEBHOOK_SECRET;
}

/**
 * Find user by email address
 * @param email - User's email address
 * @returns User record or null if not found
 */
export async function findUserByEmail(email: string) {
  const [foundUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.toLowerCase().trim()))
    .limit(1);

  return foundUser || null;
}

/**
 * Find user's active subscription
 * @param userId - User's ID
 * @returns Most recent subscription or null
 */
export async function findUserSubscription(userId: string) {
  const [foundSubscription] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .orderBy(desc(subscription.currentPeriodEnd))
    .limit(1);

  return foundSubscription || null;
}

/**
 * Extend subscription period by 30 days
 * @param subscriptionId - Subscription ID
 * @param fromDate - Date to extend from (defaults to current periodEnd or now)
 * @returns Updated subscription
 */
export async function extendSubscriptionPeriod(
  subscriptionId: string,
  fromDate?: Date
) {
  const currentSub = await db.query.subscription.findFirst({
    where: eq(subscription.id, subscriptionId),
  });

  if (!currentSub) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  // Calculate new period: extend from current end date or now, whichever is later
  const now = new Date();
  const currentEnd = currentSub.currentPeriodEnd;
  const extendFrom = fromDate || (currentEnd > now ? currentEnd : now);
  
  const newPeriodStart = extendFrom;
  const newPeriodEnd = new Date(extendFrom);
  newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

  const [updatedSubscription] = await db
    .update(subscription)
    .set({
      status: 'active',
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      modifiedAt: now,
      lastPaymentDate: now,
      nextPaymentDate: newPeriodEnd,
      // Clear any cancellation flags if reactivating
      cancelAtPeriodEnd: false,
      canceledAt: null,
    })
    .where(eq(subscription.id, subscriptionId))
    .returning();

  return updatedSubscription;
}

/**
 * Suspend a user (set inactive)
 * @param userId - User ID to suspend
 * @returns Updated user record
 */
export async function suspendUser(userId: string) {
  const [updatedUser] = await db
    .update(user)
    .set({
      isActive: false,
      activationStatus: 'suspended',
      deactivatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning();

  return updatedUser;
}

/**
 * Reactivate a suspended user
 * @param userId - User ID to reactivate
 * @returns Updated user record
 */
export async function reactivateUser(userId: string) {
  const [updatedUser] = await db
    .update(user)
    .set({
      isActive: true,
      activationStatus: 'active',
      deactivatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning();

  return updatedUser;
}

/**
 * Mark subscription as cancelled (but still active until period end)
 * @param subscriptionId - Subscription ID
 * @returns Updated subscription
 */
export async function markSubscriptionCancelled(subscriptionId: string) {
  const now = new Date();

  const [updatedSubscription] = await db
    .update(subscription)
    .set({
      cancelAtPeriodEnd: true,
      canceledAt: now,
      modifiedAt: now,
    })
    .where(eq(subscription.id, subscriptionId))
    .returning();

  return updatedSubscription;
}

/**
 * Mark subscription as past due (failed payment)
 * @param subscriptionId - Subscription ID
 * @returns Updated subscription
 */
export async function markSubscriptionPastDue(subscriptionId: string) {
  const now = new Date();
  
  // Calculate grace period end
  const gracePeriodEnd = new Date(now);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

  const [updatedSubscription] = await db
    .update(subscription)
    .set({
      status: 'past_due',
      gracePeriodEnd: gracePeriodEnd,
      modifiedAt: now,
    })
    .where(eq(subscription.id, subscriptionId))
    .returning();

  return updatedSubscription;
}

/**
 * Get grace period days from environment
 */
export function getGracePeriodDays(): number {
  return GRACE_PERIOD_DAYS;
}

/**
 * Validate required fields in webhook request
 * @param body - Request body
 * @returns Validation result with error message if invalid
 */
export function validateRequiredFields(
  body: Partial<BaseWebhookRequest>
): { valid: boolean; error?: string } {
  if (!body.email || !body.email.includes('@')) {
    return { valid: false, error: 'Invalid or missing email address' };
  }
  if (!body.webhookSecret) {
    return { valid: false, error: 'Missing webhookSecret' };
  }
  return { valid: true };
}

/**
 * Create a standardized webhook response
 */
export function createWebhookResponse(
  success: boolean,
  message: string,
  data?: Partial<WebhookResponse>
): WebhookResponse {
  return {
    success,
    message,
    ...data,
  };
}
