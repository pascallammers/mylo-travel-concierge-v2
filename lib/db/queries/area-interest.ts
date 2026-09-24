import 'server-only';

import { and, count, eq } from 'drizzle-orm';
import { db, dbUncached } from '../index';
import { areaInterest } from '../schema';
import { toAreaInterestCounts, type PreviewAreaSlug } from '../../shell/preview-areas';

/**
 * Record interest once per user and preview area.
 * @param userId - Authenticated user ID.
 * @param area - Validated preview area.
 * @returns A promise that resolves after the idempotent insert.
 */
export async function registerAreaInterest(userId: string, area: PreviewAreaSlug): Promise<void> {
  await db.insert(areaInterest).values({ userId, areaSlug: area }).onConflictDoNothing();
}

/**
 * Check whether a user already registered interest in a preview area.
 * @param userId - Authenticated user ID.
 * @param area - Preview area to check.
 * @returns Whether an interest entry exists for this user and area.
 */
export async function hasAreaInterest(userId: string, area: PreviewAreaSlug): Promise<boolean> {
  const rows = await dbUncached.select({ userId: areaInterest.userId })
    .from(areaInterest)
    .where(and(eq(areaInterest.userId, userId), eq(areaInterest.areaSlug, area)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Count interested users for every preview area.
 * @returns Counts for all preview areas, including zero for missing areas.
 */
export async function countAreaInterestByArea(): Promise<Record<PreviewAreaSlug, number>> {
  const rows = await dbUncached.select({ areaSlug: areaInterest.areaSlug, count: count() })
    .from(areaInterest)
    .groupBy(areaInterest.areaSlug);
  return toAreaInterestCounts(rows);
}
