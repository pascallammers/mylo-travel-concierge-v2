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
import { orderUsersForSync } from './sync-order';

/**
 * Vercel kills the cron function at maxDuration (300 s). One ThriveCart lookup
 * plus rate-limit delay costs ~1.3 s, so a full pass over ~1000 users never
 * fits. Each run visits as many users as the budget allows and stamps them,
 * the next run continues with the oldest stamps. The route runs
 * deactivateExpiredUsers afterwards, which took ~50 s for 124 users on the
 * first live run (05.09.2026, total 292 s), so the loop keeps 100 s in reserve.
 */
const SYNC_TIME_BUDGET_MS = 200_000;

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
 * Sync ThriveCart subscriptions for as many users as the time budget allows,
 * inconsistent and longest-unsynced users first. Every visited user gets a
 * fresh `lastSyncedAt`, so consecutive runs cover the whole base.
 *
 * @param budgetMs - Wall-clock budget for the user loop.
 * @returns Aggregate sync counters and discrepancies
 */
export async function runFullSync(budgetMs: number = SYNC_TIME_BUDGET_MS): Promise<SyncResult> {
  const syncId = generateId();
  const now = new Date();
  const deadline = Date.now() + budgetMs;

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
        lastSyncedAt: subscription.lastSyncedAt,
      })
      .from(user)
      .innerJoin(subscription, eq(subscription.userId, user.id))
      .where(ne(user.role, 'admin'));

    const uniqueUsers = orderUsersForSync(
      usersWithSubs.map((row) => ({ ...row, isActive: Boolean(row.isActive) })),
      now,
    );

    console.log(`[ThriveCart Sync] Starting sync for ${uniqueUsers.length} users, budget ${budgetMs}ms`);

    for (const dbUser of uniqueUsers) {
      if (Date.now() >= deadline) {
        console.log(`[ThriveCart Sync] Budget exhausted after ${result.totalChecked}/${uniqueUsers.length}`);
        break;
      }
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
      } finally {
        await db
          .update(subscription)
          .set({ lastSyncedAt: new Date() })
          .where(eq(subscription.id, dbUser.subId));
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
          progress: `${result.totalChecked}/${uniqueUsers.length}`,
        },
        status: 'completed',
      })
      .where(eq(thrivecartSyncLog.id, syncId));

    console.log(
      `[ThriveCart Sync] Complete: ${result.totalChecked}/${uniqueUsers.length} checked, ${result.totalCorrected} corrected, ${result.totalErrors} errors`
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
