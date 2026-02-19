import { db } from '@/lib/db';
import { session, subscription, user } from '@/lib/db/schema';
import { and, desc, gt, inArray, ne, sql } from 'drizzle-orm';
import {
  evaluateUserAccessState,
  type AccessAuditReason,
  type LatestSubscriptionRecord,
} from '@/lib/admin/access-audit-utils';

export type { AccessAuditReason } from '@/lib/admin/access-audit-utils';

export type AccessAuditUserIssue = {
  userId: string;
  name: string;
  email: string;
  reason: AccessAuditReason;
  liveSessionCount: number;
  latestSessionExpiry: string | null;
  isActive: boolean | null;
  activationStatus: string | null;
  subscriptionStatus: string | null;
  subscriptionValidUntil: string | null;
};

export type AccessAuditSummary = {
  checkedUsers: number;
  blockedUsers: number;
  blockedWithLiveSessions: number;
  liveSessionsOnBlockedUsers: number;
  generatedAt: string;
};

export type AccessAuditReport = {
  summary: AccessAuditSummary;
  issues: AccessAuditUserIssue[];
};

/**
 * Builds an access-audit report for non-admin users and finds blocked users with still-valid sessions.
 * @returns Report with summary and detailed issue list.
 */
export async function getAccessAuditReport(): Promise<AccessAuditReport> {
  const now = new Date();

  const nonAdminUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      activationStatus: user.activationStatus,
    })
    .from(user)
    .where(ne(user.role, 'admin'));

  if (nonAdminUsers.length === 0) {
    return {
      summary: {
        checkedUsers: 0,
        blockedUsers: 0,
        blockedWithLiveSessions: 0,
        liveSessionsOnBlockedUsers: 0,
        generatedAt: now.toISOString(),
      },
      issues: [],
    };
  }

  const userIds = nonAdminUsers.map((account) => account.id);

  const subscriptions = await db
    .select({
      userId: subscription.userId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
    })
    .from(subscription)
    .where(inArray(subscription.userId, userIds))
    .orderBy(desc(subscription.currentPeriodEnd), desc(subscription.createdAt));

  const latestSubscriptionsByUserId = new Map<string, LatestSubscriptionRecord>();
  for (const sub of subscriptions) {
    if (!sub.userId || latestSubscriptionsByUserId.has(sub.userId)) {
      continue;
    }

    latestSubscriptionsByUserId.set(sub.userId, {
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  }

  const liveSessions = await db
    .select({
      userId: session.userId,
      liveSessionCount: sql<number>`count(*)::int`,
      latestSessionExpiry: sql<string | null>`max(${session.expiresAt})::text`,
    })
    .from(session)
    .where(and(inArray(session.userId, userIds), gt(session.expiresAt, now)))
    .groupBy(session.userId);

  const liveSessionsByUserId = new Map<string, { count: number; latestExpiry: string | null }>();
  for (const currentSession of liveSessions) {
    liveSessionsByUserId.set(currentSession.userId, {
      count: Number(currentSession.liveSessionCount),
      latestExpiry: currentSession.latestSessionExpiry,
    });
  }

  let blockedUsers = 0;
  const issues: AccessAuditUserIssue[] = [];

  for (const account of nonAdminUsers) {
    const latestSubscription = latestSubscriptionsByUserId.get(account.id) ?? null;
    const accessState = evaluateUserAccessState(
      {
        isActive: account.isActive,
        activationStatus: account.activationStatus,
      },
      latestSubscription,
      now
    );

    if (accessState.hasAccess) {
      continue;
    }

    blockedUsers += 1;

    const sessionInfo = liveSessionsByUserId.get(account.id);
    if (!sessionInfo || sessionInfo.count === 0 || !accessState.reason) {
      continue;
    }

    issues.push({
      userId: account.id,
      name: account.name,
      email: account.email,
      reason: accessState.reason,
      liveSessionCount: sessionInfo.count,
      latestSessionExpiry: sessionInfo.latestExpiry,
      isActive: account.isActive,
      activationStatus: account.activationStatus,
      subscriptionStatus: latestSubscription?.status ?? null,
      subscriptionValidUntil: latestSubscription?.currentPeriodEnd.toISOString() ?? null,
    });
  }

  issues.sort((a, b) => {
    if (b.liveSessionCount !== a.liveSessionCount) {
      return b.liveSessionCount - a.liveSessionCount;
    }
    return a.email.localeCompare(b.email);
  });

  const liveSessionsOnBlockedUsers = issues.reduce((sum, issue) => sum + issue.liveSessionCount, 0);

  return {
    summary: {
      checkedUsers: nonAdminUsers.length,
      blockedUsers,
      blockedWithLiveSessions: issues.length,
      liveSessionsOnBlockedUsers,
      generatedAt: now.toISOString(),
    },
    issues,
  };
}

/**
 * Revokes sessions for the provided users.
 * @param userIds - User IDs whose sessions should be removed.
 * @returns Number of removed sessions.
 */
export async function revokeSessionsForUsers(userIds: string[]): Promise<number> {
  if (userIds.length === 0) {
    return 0;
  }

  const deletedSessions = await db
    .delete(session)
    .where(inArray(session.userId, userIds))
    .returning({ id: session.id });

  return deletedSessions.length;
}
