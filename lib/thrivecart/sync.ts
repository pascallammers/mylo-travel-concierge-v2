import { dbUncached as db } from '@/lib/db';
import { user, subscription, thrivecartSyncLog, thrivecartWebhookLog } from '@/lib/db/schema';
import { eq, desc, and, ne, gt, inArray } from 'drizzle-orm';
import { getCustomerByEmail, rateLimitDelay } from './client';
import {
  reactivateUser,
  markSubscriptionCancelled,
  suspendUser,
  archiveExpiredSubscription,
} from '@/app/api/webhooks/subscription/_lib/helpers';
import type { SyncResult } from './types';
import { generateId } from 'ai';
import { thrivecartConfig } from './config';
import { decideSyncAction, resolvePeriodEndFromThriveCart, type SyncAction } from './sync-decision';

const RECENT_WEBHOOK_EVENTS = ['order.success', 'order.subscription_payment'] as const;

/**
 * True when a recent MYLO purchase or rebill webhook should win over the API snapshot.
 *
 * @param email - Customer email
 * @param hoursAgo - Lookback window in hours
 * @returns Whether a successful webhook exists in the window
 */
async function hasRecentWebhookEvent(email: string, hoursAgo = 24): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAgo);

  const [recent] = await db
    .select({ id: thrivecartWebhookLog.id })
    .from(thrivecartWebhookLog)
    .where(
      and(
        eq(thrivecartWebhookLog.customerEmail, email.toLowerCase()),
        inArray(thrivecartWebhookLog.eventType, [...RECENT_WEBHOOK_EVENTS]),
        eq(thrivecartWebhookLog.result, 'success'),
        gt(thrivecartWebhookLog.processedAt, cutoff)
      )
    )
    .limit(1);

  return !!recent;
}

/**
 * Apply a period update and clear cancellation flags when ThriveCart says the sub is active.
 *
 * @param subscriptionId - Subscription row to update
 * @param nextPaymentDate - ThriveCart next payment date, if present
 * @param now - Comparison timestamp
 */
async function applyActivePeriod(
  subscriptionId: string,
  nextPaymentDate: string | undefined,
  now: Date
): Promise<void> {
  const periodEnd = resolvePeriodEndFromThriveCart(nextPaymentDate, now);
  await db
    .update(subscription)
    .set({
      status: 'active',
      currentPeriodEnd: periodEnd,
      nextPaymentDate: periodEnd,
      modifiedAt: now,
      lastSyncedAt: now,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      endedAt: null,
    })
    .where(eq(subscription.id, subscriptionId));
}

/**
 * Persist the decided sync action for one user.
 *
 * @param action - Pure decision from decideSyncAction
 * @param dbUser - User/subscription identifiers
 * @param now - Comparison timestamp
 * @returns Whether a correction was written
 */
async function applySyncAction(
  action: SyncAction,
  dbUser: { userId: string; email: string; subId: string; isActive: boolean; subStatus: string },
  now: Date
): Promise<boolean> {
  switch (action.type) {
    case 'skip_recent_webhook':
      console.log(`[ThriveCart Sync] Skipping ${dbUser.email}: recent webhook is authoritative`);
      return false;
    case 'mark_cancelled':
      await markSubscriptionCancelled(dbUser.subId);
      return true;
    case 'reactivate':
      await applyActivePeriod(dbUser.subId, action.nextPaymentDate, now);
      if (!dbUser.isActive) await reactivateUser(dbUser.userId);
      return true;
    case 'extend_period':
      await applyActivePeriod(dbUser.subId, action.nextPaymentDate, now);
      return true;
    case 'touch_synced':
      await db
        .update(subscription)
        .set({ lastSyncedAt: now })
        .where(eq(subscription.id, dbUser.subId));
      return false;
    case 'none':
      return false;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Run a full sync of ThriveCart subscriptions, including suspended/expired users.
 *
 * @returns Aggregate sync counters and discrepancies
 */
export async function runFullSync(): Promise<SyncResult> {
  const syncId = generateId();
  const now = new Date();

  await db.insert(thrivecartSyncLog).values({
    id: syncId,
    startedAt: now,
    status: 'running',
  });

  const result: SyncResult = {
    totalChecked: 0,
    totalCorrected: 0,
    totalErrors: 0,
    discrepancies: [],
    errors: [],
  };

  try {
    const usersWithSubs = await db
      .select({
        userId: user.id,
        email: user.email,
        isActive: user.isActive,
        subId: subscription.id,
        subStatus: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      })
      .from(user)
      .innerJoin(subscription, eq(subscription.userId, user.id))
      .where(ne(user.role, 'admin'))
      .orderBy(desc(subscription.currentPeriodEnd));

    const seen = new Set<string>();
    const uniqueUsers = usersWithSubs.filter((row) => {
      if (seen.has(row.userId)) return false;
      seen.add(row.userId);
      return true;
    });

    uniqueUsers.sort((a, b) => {
      const aNeedsHeal = !a.isActive || a.subStatus !== 'active' || a.currentPeriodEnd <= now;
      const bNeedsHeal = !b.isActive || b.subStatus !== 'active' || b.currentPeriodEnd <= now;
      if (aNeedsHeal === bNeedsHeal) return 0;
      return aNeedsHeal ? -1 : 1;
    });

    console.log(`[ThriveCart Sync] Starting sync for ${uniqueUsers.length} users`);

    for (const dbUser of uniqueUsers) {
      result.totalChecked++;

      try {
        const tcResult = await getCustomerByEmail(dbUser.email);
        await rateLimitDelay();

        if (!tcResult.success || !tcResult.data) {
          result.errors.push({ email: dbUser.email, error: tcResult.error || 'Not found in ThriveCart' });
          result.totalErrors++;
          continue;
        }

        const hasRecent = await hasRecentWebhookEvent(dbUser.email);
        const action = decideSyncAction(
          {
            isActive: Boolean(dbUser.isActive),
            subStatus: dbUser.subStatus,
            currentPeriodEnd: dbUser.currentPeriodEnd,
            cancelAtPeriodEnd: Boolean(dbUser.cancelAtPeriodEnd),
          },
          tcResult.data,
          hasRecent,
          thrivecartConfig.productIds,
          now
        );

        const corrected = await applySyncAction(
          action,
          {
            userId: dbUser.userId,
            email: dbUser.email,
            subId: dbUser.subId,
            isActive: Boolean(dbUser.isActive),
            subStatus: dbUser.subStatus,
          },
          now
        );
        if (corrected) {
          result.discrepancies.push({
            userId: dbUser.userId,
            email: dbUser.email,
            field: action.type,
            dbValue: `${dbUser.subStatus}/${dbUser.isActive ? 'active' : 'inactive'}`,
            thriveCartValue: action.type,
            corrected: true,
          });
          result.totalCorrected++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ email: dbUser.email, error: errorMsg });
        result.totalErrors++;
      }

      if (result.totalChecked % 50 === 0) {
        console.log(`[ThriveCart Sync] Progress: ${result.totalChecked}/${uniqueUsers.length}`);
        await db
          .update(thrivecartSyncLog)
          .set({
            totalChecked: result.totalChecked,
            totalCorrected: result.totalCorrected,
            totalErrors: result.totalErrors,
            details: {
              discrepancies: result.discrepancies.slice(-20),
              errors: result.errors.slice(-10),
              progress: `${result.totalChecked}/${uniqueUsers.length}`,
            },
          })
          .where(eq(thrivecartSyncLog.id, syncId));
      }
    }

    await db
      .update(thrivecartSyncLog)
      .set({
        completedAt: new Date(),
        totalChecked: result.totalChecked,
        totalCorrected: result.totalCorrected,
        totalErrors: result.totalErrors,
        details: {
          discrepancies: result.discrepancies,
          errors: result.errors,
        },
        status: 'completed',
      })
      .where(eq(thrivecartSyncLog.id, syncId));

    console.log(
      `[ThriveCart Sync] Complete: ${result.totalChecked} checked, ${result.totalCorrected} corrected, ${result.totalErrors} errors`
    );
  } catch (error) {
    await db
      .update(thrivecartSyncLog)
      .set({
        completedAt: new Date(),
        status: 'failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      })
      .where(eq(thrivecartSyncLog.id, syncId));

    throw error;
  }

  return result;
}

/**
 * Deactivate users whose latest subscription period has ended.
 * Call after runFullSync so ThriveCart-active users are extended first.
 *
 * @returns Number of users suspended
 */
export async function deactivateExpiredUsers(): Promise<number> {
  const now = new Date();

  const usersWithSubs = await db
    .select({
      userId: user.id,
      subId: subscription.id,
      currentPeriodEnd: subscription.currentPeriodEnd,
      subStatus: subscription.status,
    })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(and(eq(user.isActive, true), ne(user.role, 'admin')))
    .orderBy(desc(subscription.currentPeriodEnd));

  const seen = new Set<string>();
  const latestPerUser = usersWithSubs.filter((row) => {
    if (seen.has(row.userId)) return false;
    seen.add(row.userId);
    return true;
  });

  const expired = latestPerUser.filter((row) => row.currentPeriodEnd <= now);

  let deactivated = 0;
  let archived = 0;
  for (const row of expired) {
    try {
      await suspendUser(row.userId);
      if (row.subStatus !== 'expired') {
        await db
          .update(subscription)
          .set({ status: 'expired', modifiedAt: now })
          .where(eq(subscription.id, row.subId));
      }
      const wasArchived = await archiveExpiredSubscription(row.subId, 'expired');
      if (wasArchived) archived++;
      deactivated++;
    } catch (error) {
      console.error(`[Expired Check] Failed to deactivate user ${row.userId}:`, error);
    }
  }

  console.log(
    `[Expired Check] ${deactivated} users deactivated, ${archived} subscriptions archived out of ${expired.length} expired`
  );
  return deactivated;
}
