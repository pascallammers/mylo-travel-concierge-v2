import { db } from '@/lib/db';
import { user, subscription, thrivecartSyncLog, thrivecartWebhookLog } from '@/lib/db/schema';
import { eq, isNotNull, desc, and, ne, gt } from 'drizzle-orm';
import { getCustomerByEmail, rateLimitDelay } from './client';
import {
  reactivateUser,
  markSubscriptionCancelled,
  suspendUser,
  archiveExpiredSubscription,
} from '@/app/api/webhooks/subscription/_lib/helpers';
import type { SyncResult, SyncDiscrepancy } from './types';
import { generateId } from 'ai';
import { thrivecartConfig } from './config';

/**
 * Check if a user has a recent successful order.success webhook event.
 * Used to prevent the sync from overriding fresh webhook-driven state changes.
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
        eq(thrivecartWebhookLog.eventType, 'order.success'),
        eq(thrivecartWebhookLog.result, 'success'),
        gt(thrivecartWebhookLog.processedAt, cutoff)
      )
    )
    .limit(1);

  return !!recent;
}

/**
 * Run a full sync of all ThriveCart subscriptions.
 * Queries each user's status from ThriveCart API and corrects discrepancies.
 */
export async function runFullSync(): Promise<SyncResult> {
  const syncId = generateId();
  const now = new Date();

  // Create sync log entry
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
    // Fetch only active users with subscriptions (skip already-deactivated to stay within timeout)
    const usersWithSubs = await db
      .select({
        userId: user.id,
        email: user.email,
        isActive: user.isActive,
        activationStatus: user.activationStatus,
        subId: subscription.id,
        subStatus: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        thrivecardCustomerId: subscription.thrivecardCustomerId,
      })
      .from(user)
      .innerJoin(subscription, eq(subscription.userId, user.id))
      .where(and(
        eq(user.isActive, true),
        eq(subscription.status, 'active'),
        ne(user.role, 'admin'),
      ))
      .orderBy(desc(subscription.currentPeriodEnd));

    // Deduplicate by userId (keep most recent subscription)
    const seen = new Set<string>();
    const uniqueUsers = usersWithSubs.filter((u) => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    });

    console.log(`[ThriveCart Sync] Starting sync for ${uniqueUsers.length} users`);

    for (const dbUser of uniqueUsers) {
      result.totalChecked++;

      try {
        // Query ThriveCart for this customer
        const tcResult = await getCustomerByEmail(dbUser.email);
        await rateLimitDelay();

        if (!tcResult.success || !tcResult.data) {
          // Customer not found in ThriveCart — might be deleted
          result.errors.push({ email: dbUser.email, error: tcResult.error || 'Not found in ThriveCart' });
          result.totalErrors++;
          continue;
        }

        const tcCustomer = tcResult.data;
        const tcPurchase = tcCustomer.purchases?.find(
          (p) => p.product_id === Number(thrivecartConfig.productId) && p.subscription
        );

        if (!tcPurchase?.subscription) {
          // No active subscription found in ThriveCart
          if (dbUser.subStatus === 'active' && !dbUser.cancelAtPeriodEnd) {
            // Check if a recent webhook event exists — webhook is more authoritative than API
            const hasRecent = await hasRecentWebhookEvent(dbUser.email);
            if (hasRecent) {
              console.log(`[ThriveCart Sync] Skipping ${dbUser.email}: recent webhook event found, webhook is authoritative`);
            } else {
              // DB says active but ThriveCart has no subscription — mark as cancelled
              await markSubscriptionCancelled(dbUser.subId);
              result.discrepancies.push({
                userId: dbUser.userId,
                email: dbUser.email,
                field: 'subscription_status',
                dbValue: 'active',
                thriveCartValue: 'no_subscription',
                corrected: true,
              });
              result.totalCorrected++;
            }
          }
          continue;
        }

        const tcSub = tcPurchase.subscription;

        // Compare subscription status
        if (tcSub.status === 'cancelled' && dbUser.subStatus === 'active' && !dbUser.cancelAtPeriodEnd) {
          // Check if a recent webhook event exists — webhook is more authoritative than API
          const hasRecent = await hasRecentWebhookEvent(dbUser.email);
          if (hasRecent) {
            console.log(`[ThriveCart Sync] Skipping cancel for ${dbUser.email}: recent webhook event found, webhook is authoritative`);
          } else {
            await markSubscriptionCancelled(dbUser.subId);
            result.discrepancies.push({
              userId: dbUser.userId,
              email: dbUser.email,
              field: 'cancel_status',
              dbValue: 'active',
              thriveCartValue: 'cancelled',
              corrected: true,
            });
            result.totalCorrected++;
          }
        }

        if (tcSub.status === 'active' && dbUser.subStatus !== 'active') {
          // ThriveCart says active but DB doesn't — reactivate
          await db
            .update(subscription)
            .set({ status: 'active', modifiedAt: new Date() })
            .where(eq(subscription.id, dbUser.subId));
          if (!dbUser.isActive) await reactivateUser(dbUser.userId);
          result.discrepancies.push({
            userId: dbUser.userId,
            email: dbUser.email,
            field: 'subscription_status',
            dbValue: dbUser.subStatus,
            thriveCartValue: 'active',
            corrected: true,
          });
          result.totalCorrected++;
        }

        // Update lastSyncedAt
        await db
          .update(subscription)
          .set({ lastSyncedAt: new Date() })
          .where(eq(subscription.id, dbUser.subId));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ email: dbUser.email, error: errorMsg });
        result.totalErrors++;
      }

      // Log progress and update sync log every 50 users (preserves partial results on timeout)
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

    // Update sync log
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
 * Deactivate users whose subscription has expired.
 * Finds all active, non-admin users with subscriptions where
 * the latest currentPeriodEnd is in the past, then suspends them.
 */
export async function deactivateExpiredUsers(): Promise<number> {
  const now = new Date();

  // Get all active non-admin users who have at least one subscription
  const usersWithSubs = await db
    .select({
      userId: user.id,
      subId: subscription.id,
      currentPeriodEnd: subscription.currentPeriodEnd,
      subStatus: subscription.status,
    })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(
      and(
        eq(user.isActive, true),
        ne(user.role, 'admin')
      )
    )
    .orderBy(desc(subscription.currentPeriodEnd));

  // Deduplicate: keep only the latest subscription per user
  const seen = new Set<string>();
  const latestPerUser = usersWithSubs.filter((row) => {
    if (seen.has(row.userId)) return false;
    seen.add(row.userId);
    return true;
  });

  // Filter to users whose latest subscription has expired
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
      // Archive the expired subscription
      const wasArchived = await archiveExpiredSubscription(row.subId, 'expired');
      if (wasArchived) archived++;
      deactivated++;
    } catch (error) {
      console.error(`[Expired Check] Failed to deactivate user ${row.userId}:`, error);
    }
  }

  console.log(`[Expired Check] ${deactivated} users deactivated, ${archived} subscriptions archived out of ${expired.length} expired`);
  return deactivated;
}
