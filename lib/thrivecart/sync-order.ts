export type SyncCandidate = {
  userId: string;
  isActive: boolean;
  subStatus: string;
  currentPeriodEnd: Date;
  lastSyncedAt: Date | null;
};

/**
 * Whether the DB claims access the subscription no longer supports. Inactive
 * users are a steady state and never count as inconsistent.
 */
function isInconsistent(user: SyncCandidate, now: Date): boolean {
  return user.isActive && (user.subStatus !== 'active' || user.currentPeriodEnd <= now);
}

/**
 * Order sync candidates so that a time-budgeted run converges: inconsistent
 * active users first, then never-synced, then oldest sync stamp. Rows are
 * deduplicated to one per user, keeping the latest period end.
 *
 * @param rows - One row per (user, subscription), any order.
 * @param now - Comparison timestamp.
 * @returns Deduplicated candidates in visit order.
 */
export function orderUsersForSync<T extends SyncCandidate>(rows: readonly T[], now: Date): T[] {
  const latestPerUser = new Map<string, T>();
  for (const row of rows) {
    const current = latestPerUser.get(row.userId);
    if (!current || row.currentPeriodEnd > current.currentPeriodEnd) {
      latestPerUser.set(row.userId, row);
    }
  }

  return [...latestPerUser.values()].sort((a, b) => {
    const aInconsistent = isInconsistent(a, now);
    const bInconsistent = isInconsistent(b, now);
    if (aInconsistent !== bInconsistent) return aInconsistent ? -1 : 1;

    const aStamp = a.lastSyncedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bStamp = b.lastSyncedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return aStamp - bStamp;
  });
}
