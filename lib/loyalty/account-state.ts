/** Days after which a balance AwardWallet has not re-read counts as stale. */
export const STALE_AFTER_DAYS = 90;

/**
 * Repair outcomes require account changes; retry outcomes may recover through
 * AwardWallet's "Update all". A successful or never-run update is ok.
 * @see https://awardwallet.com/api/account#object-Account
 */
type SyncOutcome = 'ok' | 'retry' | 'repair';

const SYNC_ERROR_OUTCOME: Readonly<Record<number, SyncOutcome>> = {
  0: 'ok', 1: 'ok', 9: 'ok',
  2: 'repair', 7: 'repair', 8: 'repair', 10: 'repair',
  3: 'retry', 4: 'retry', 5: 'retry', 6: 'retry', 11: 'retry',
};

export type LoyaltyAccountState =
  | { kind: 'current' }
  | { kind: 'stale'; days: number }
  | { kind: 'no_balance' }
  | { kind: 'needs_repair'; code: number }
  | { kind: 'read_failed'; code: number };

export interface LoyaltyAccountStateInput {
  balance: number | null;
  syncErrorCode: number | null;
  lastRetrievedAt: Date | null;
}

/**
 * Determines which account action takes precedence over balance age.
 * @param input - Stored balance and AwardWallet's last update result
 * @param now - Reference time for the stale threshold
 * @returns Account state with the age or error code needed for its hint
 */
export function classifyLoyaltyAccount(input: LoyaltyAccountStateInput, now: Date): LoyaltyAccountState {
  const { balance, syncErrorCode, lastRetrievedAt } = input;
  // Legacy rows have no error code and must not be treated as failed updates.
  const outcome = syncErrorCode === null ? 'ok' : (SYNC_ERROR_OUTCOME[syncErrorCode] ?? 'retry');

  if (syncErrorCode !== null && outcome === 'repair') return { kind: 'needs_repair', code: syncErrorCode };
  if (syncErrorCode !== null && outcome === 'retry') return { kind: 'read_failed', code: syncErrorCode };
  if (balance === null) return { kind: 'no_balance' };
  if (lastRetrievedAt === null) return { kind: 'current' };

  const days = Math.floor((now.getTime() - lastRetrievedAt.getTime()) / (24 * 60 * 60 * 1000));
  return days >= STALE_AFTER_DAYS ? { kind: 'stale', days } : { kind: 'current' };
}

/**
 * Counts balances for which a manual AwardWallet refresh is recommended.
 * @param states - Classified loyalty account states
 * @returns Number of stale balances
 */
export function countStaleAccounts(states: readonly LoyaltyAccountState[]): number {
  return states.filter((state) => state.kind === 'stale').length;
}
