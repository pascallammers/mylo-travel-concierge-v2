import 'server-only';

import {
  getMessageCount,
  getExtremeSearchCount,
  getHistoricalUsageData,
  getCustomInstructionsByUserId,
} from '@/lib/db/queries';
import { usageCountCache, createMessageCountKey, createExtremeCountKey } from '@/lib/performance-cache';

/**
 * Read records for a trusted, already authenticated server caller.
 * @param userId - User identifier resolved by the calling server boundary.
 * @returns The requested records with the existing failure fallback.
 */
export async function getUserMessageCountForUser(userId: string) {
  try {
    // Check cache first
    const cacheKey = createMessageCountKey(userId);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getMessageCount({
      userId,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    console.error('Error getting user message count:', error);
    return { count: 0, error: 'Failed to get message count' };
  }
}

/**
 * Read records for a trusted, already authenticated server caller.
 * @param userId - User identifier resolved by the calling server boundary.
 * @returns The requested records with the existing failure fallback.
 */
export async function getExtremeSearchUsageCountForUser(userId: string) {
  try {
    // Check cache first
    const cacheKey = createExtremeCountKey(userId);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getExtremeSearchCount({
      userId,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    console.error('Error getting extreme search usage count:', error);
    return { count: 0, error: 'Failed to get extreme search count' };
  }
}

/**
 * Read records for a trusted, already authenticated server caller.
 * @param userId - User identifier resolved by the calling server boundary.
 * @param months - Number of months to include.
 * @returns The requested records with the existing failure fallback.
 */
export async function getHistoricalUsageForUser(userId: string, months: number = 9) {
  try {
    const historicalData = await getHistoricalUsageData({ userId, months });

    // Calculate days based on months (approximately 30 days per month)
    const totalDays = months * 30;
    const futureDays = Math.min(15, Math.floor(totalDays * 0.08)); // ~8% future days, max 15
    const pastDays = totalDays - futureDays - 1; // -1 for today

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + futureDays);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - pastDays);

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    historicalData.forEach((record) => {
      const dateKey = record.date.toISOString().split('T')[0];
      dataMap.set(dateKey, record.messageCount || 0);
    });

    // Generate complete dataset for all days
    const completeData = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];

      const count = dataMap.get(dateKey) || 0;
      let level: 0 | 1 | 2 | 3 | 4;

      // Define usage levels based on message count
      if (count === 0) level = 0;
      else if (count <= 3) level = 1;
      else if (count <= 7) level = 2;
      else if (count <= 12) level = 3;
      else level = 4;

      completeData.push({
        date: dateKey,
        count,
        level,
      });
    }

    return completeData;
  } catch (error) {
    console.error('Error getting historical usage:', error);
    return [];
  }
}

/**
 * Read records for a trusted, already authenticated server caller.
 * @param userId - User identifier resolved by the calling server boundary.
 * @returns The requested records with the existing failure fallback.
 */
export async function getCustomInstructionsForUser(userId: string) {
  try {
    const instructions = await getCustomInstructionsByUserId({ userId });
    return instructions;
  } catch (error) {
    console.error('Error getting custom instructions:', error);
    return null;
  }
}
