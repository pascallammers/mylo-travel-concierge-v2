/**
 * Admin badge and subscription-row selection for ThriveCart-backed access.
 */

export type SubscriptionStatusBadge = 'active' | 'inactive' | 'cancelled' | 'none';

export type SubscriptionStatusInput = {
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

/**
 * Maps a subscription row to the admin "Zugriff" badge.
 *
 * @param sub - Latest subscription, or null when the user has none
 * @param now - Comparison timestamp
 * @returns Badge status and ISO valid-until when access is still dated
 */
export function determineSubscriptionStatus(
  sub: SubscriptionStatusInput | null,
  now: Date = new Date()
): { status: SubscriptionStatusBadge; validUntil: string | null } {
  if (!sub) {
    return { status: 'none', validUntil: null };
  }

  const periodEnd = sub.currentPeriodEnd;

  if (sub.status === 'active' && periodEnd > now) {
    return { status: 'active', validUntil: periodEnd.toISOString() };
  }

  if (sub.cancelAtPeriodEnd) {
    return { status: 'cancelled', validUntil: periodEnd.toISOString() };
  }

  if (sub.status === 'canceled' || periodEnd < now) {
    return { status: 'inactive', validUntil: null };
  }

  return { status: 'active', validUntil: periodEnd.toISOString() };
}

/**
 * Picks the subscription that currently grants (or most recently granted) access.
 * Prefers the latest `currentPeriodEnd`, not `createdAt`.
 *
 * @param subscriptions - Candidate rows for one user
 * @returns The latest row, or null when the list is empty
 */
export function pickLatestSubscription<T extends { currentPeriodEnd: Date | null }>(
  subscriptions: readonly T[]
): T | null {
  if (subscriptions.length === 0) {
    return null;
  }

  return [...subscriptions].sort((a, b) => {
    const aEnd = a.currentPeriodEnd?.getTime() ?? 0;
    const bEnd = b.currentPeriodEnd?.getTime() ?? 0;
    return bEnd - aEnd;
  })[0] ?? null;
}
