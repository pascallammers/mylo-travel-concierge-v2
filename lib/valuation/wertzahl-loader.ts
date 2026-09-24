import type { getUserLoyaltyData } from '../db/queries/awardwallet';
import { computeWertzahl, type Wertzahl } from './portfolio-value';
import type { ValuationTable } from './types';

export type RailWertzahl = Wertzahl | { kind: 'unavailable' };

/**
 * Load the rail's Wertzahl while containing failures at the system boundary.
 * @param userId - Authenticated MYLO user ID.
 * @param deps - Loyalty query, valuation snapshot loader and explicit clock.
 * @returns Wertzahl, or unavailable when the underlying data cannot be loaded.
 */
export async function loadRailWertzahl(
  userId: string,
  deps: {
    loadLoyalty: typeof getUserLoyaltyData;
    loadTable: () => Promise<ValuationTable>;
    now: () => Date;
  },
): Promise<RailWertzahl> {
  try {
    const [loyalty, table] = await Promise.all([deps.loadLoyalty(userId), deps.loadTable()]);
    return computeWertzahl({
      connected: loyalty.status !== 'disconnected',
      accounts: loyalty.accounts,
      table,
      now: deps.now(),
    });
  } catch (error) {
    console.error('[Wertzahl] Failed to load rail value:', error);
    return { kind: 'unavailable' };
  }
}
