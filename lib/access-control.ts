import { db } from '@/lib/db';
import { subscription, user } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { doesSubscriptionGrantAccess } from './subscription-access';

export type AccessCheckResult = {
  hasAccess: boolean;
  reason?: 'admin' | 'active_subscription' | 'no_subscription' | 'expired_subscription' | 'inactive_user';
  subscriptionEndDate?: Date;
};

/**
 * Check if user has access to the application
 * @param userId - The user's ID
 * @returns Access check result with reason
 * 
 * Access Rules:
 * 1. Admins ALWAYS have access (bypass all checks)
 * 2. Inactive users are blocked
 * 3. Regular users need an active subscription with currentPeriodEnd > now()
 */
export async function checkUserAccess(userId: string): Promise<AccessCheckResult> {
  try {
    // 1. Get user role and status
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { role: true, isActive: true, activationStatus: true },
    });

    if (!userRecord) {
      return { hasAccess: false, reason: 'inactive_user' };
    }

    // 2. Admins bypass all subscription checks
    if (userRecord.role === 'admin') {
      console.log(`✅ Admin access granted for user ${userId}`);
      return { hasAccess: true, reason: 'admin' };
    }

    // 3. Check if user account is active
    if (userRecord.isActive === false || (userRecord.activationStatus && userRecord.activationStatus !== 'active')) {
      console.log(`❌ User ${userId} is inactive (isActive: ${userRecord.isActive}, status: ${userRecord.activationStatus})`);
      return { hasAccess: false, reason: 'inactive_user' };
    }

    // 4. Check latest subscription validity
    const now = new Date();
    const latestSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      columns: { currentPeriodEnd: true, status: true },
      orderBy: [desc(subscription.currentPeriodEnd)],
    });

    if (!latestSubscription) {
      console.log(`❌ No subscription found for user ${userId}`);
      return { hasAccess: false, reason: 'no_subscription' };
    }

    if (doesSubscriptionGrantAccess(latestSubscription.status, latestSubscription.currentPeriodEnd, now)) {
      console.log(
        `✅ Valid subscription found for user ${userId}, valid until ${latestSubscription.currentPeriodEnd} (status: ${latestSubscription.status})`
      );
      return {
        hasAccess: true,
        reason: 'active_subscription',
        subscriptionEndDate: latestSubscription.currentPeriodEnd,
      };
    }

    if (latestSubscription.currentPeriodEnd <= now) {
      console.log(`❌ Expired subscription for user ${userId}, expired on ${latestSubscription.currentPeriodEnd}`);
      return {
        hasAccess: false,
        reason: 'expired_subscription',
        subscriptionEndDate: latestSubscription.currentPeriodEnd,
      };
    }

    console.log(
      `❌ Invalid subscription status for user ${userId} (status: ${latestSubscription.status}, validUntil: ${latestSubscription.currentPeriodEnd})`
    );
    return {
      hasAccess: false,
      reason: 'no_subscription',
      subscriptionEndDate: latestSubscription.currentPeriodEnd,
    };
  } catch (error) {
    console.error('❌ Error checking user access:', error);
    // Fail closed: deny access on error
    return { hasAccess: false, reason: 'inactive_user' };
  }
}

/**
 * Check if a user has an active subscription (does not check admin status)
 * @param userId - The user's ID
 * @returns True if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const now = new Date();
  const latestSubscription = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
    columns: { status: true, currentPeriodEnd: true },
    orderBy: [desc(subscription.currentPeriodEnd)],
  });

  return doesSubscriptionGrantAccess(latestSubscription?.status, latestSubscription?.currentPeriodEnd, now);
}
