import { db } from '@/lib/db';
import { subscription, user } from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { doesSubscriptionGrantAccess, evaluateAccountAccess, type AccessCheckResult } from './subscription-access';

export type { AccessCheckResult };

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

    // 2. Latest subscription (only loaded for non-admins, admins bypass it anyway)
    const latestSubscription =
      userRecord.role === 'admin'
        ? null
        : ((await db.query.subscription.findFirst({
            where: eq(subscription.userId, userId),
            columns: { currentPeriodEnd: true, status: true },
            orderBy: [desc(subscription.currentPeriodEnd)],
          })) ?? null);

    const result = evaluateAccountAccess({ ...userRecord, subscription: latestSubscription }, new Date());

    logAccessResult(userId, result);

    return result;
  } catch (error) {
    console.error('❌ Error checking user access:', error);
    // Fail closed: deny access on error
    return { hasAccess: false, reason: 'inactive_user' };
  }
}

/**
 * Check which of the given users currently have access to the application.
 * Batched counterpart to {@link checkUserAccess} for jobs that process many users at once.
 *
 * @param userIds - User IDs to check.
 * @returns The subset of IDs whose account grants access right now.
 */
export async function filterUserIdsWithAccess(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    return new Set();
  }

  const [userRecords, subscriptions] = await Promise.all([
    db.query.user.findMany({
      where: inArray(user.id, uniqueIds),
      columns: { id: true, role: true, isActive: true, activationStatus: true },
    }),
    db.query.subscription.findMany({
      where: inArray(subscription.userId, uniqueIds),
      columns: { userId: true, currentPeriodEnd: true, status: true },
      orderBy: [desc(subscription.currentPeriodEnd)],
    }),
  ]);

  // Ordered by currentPeriodEnd desc, so the first hit per user is the latest subscription.
  const latestSubscriptions = new Map<string, { status: string | null; currentPeriodEnd: Date }>();
  for (const row of subscriptions) {
    if (row.userId && !latestSubscriptions.has(row.userId)) {
      latestSubscriptions.set(row.userId, { status: row.status, currentPeriodEnd: row.currentPeriodEnd });
    }
  }

  const now = new Date();

  return new Set(
    userRecords
      .filter((record) =>
        evaluateAccountAccess({ ...record, subscription: latestSubscriptions.get(record.id) ?? null }, now).hasAccess,
      )
      .map((record) => record.id),
  );
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

/**
 * Mirror the previous per-branch logging so production log greps keep working.
 */
function logAccessResult(userId: string, result: AccessCheckResult): void {
  switch (result.reason) {
    case 'admin':
      console.log(`✅ Admin access granted for user ${userId}`);
      return;
    case 'active_subscription':
      console.log(`✅ Valid subscription found for user ${userId}, valid until ${result.subscriptionEndDate}`);
      return;
    case 'inactive_user':
      console.log(`❌ User ${userId} is inactive`);
      return;
    case 'expired_subscription':
      console.log(`❌ Expired subscription for user ${userId}, expired on ${result.subscriptionEndDate}`);
      return;
    case 'no_subscription':
      console.log(
        result.subscriptionEndDate
          ? `❌ Invalid subscription status for user ${userId} (validUntil: ${result.subscriptionEndDate})`
          : `❌ No subscription found for user ${userId}`,
      );
      return;
  }
}
