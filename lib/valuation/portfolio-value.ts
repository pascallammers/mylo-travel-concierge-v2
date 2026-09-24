import { classifyLoyaltyAccount } from '../loyalty/account-state';
import { getLoyaltyProgram } from '../loyalty/programs';
import type { ValuationTable } from './types';

export interface PortfolioAccount {
  programId: string;
  balance: number | null;
  syncErrorCode: number | null;
  lastRetrievedAt: Date | null;
}

export interface ProgrammeValue {
  programId: string;
  name: string;
  travelEur: number;
}

export type Wertzahl =
  | { kind: 'not_connected' }
  | { kind: 'no_rateable_account'; unreadableCount: number; totalAccounts: number }
  | {
      kind: 'value';
      travelEur: number;
      noPlan: { eur: number; coveredPrograms: number; totalPrograms: number } | null;
      ratedAccounts: number;
      totalAccounts: number;
      unreadableCount: number;
      programs: ProgrammeValue[];
    };

/**
 * Round the Wertzahl without hiding small, positive balances as zero euros.
 * @param eur - Unrounded value in euros.
 * @returns Whole euros below 100, otherwise the nearest hundred euros.
 */
export function displayEuro(eur: number): number {
  if (eur === 0) return 0;
  if (eur < 100) return Math.max(1, Math.round(eur));
  return Math.round(eur / 100) * 100;
}

/**
 * Compute Reisewert and Wert ohne Plan over every bewertbares Konto.
 * @param input - Connection state, stored balances, valuation snapshot and explicit clock.
 * @returns Wertzahl with programme contributions or the applicable empty state.
 */
export function computeWertzahl(input: {
  connected: boolean;
  accounts: readonly PortfolioAccount[];
  table: Pick<ValuationTable, 'rateFor' | 'isRatable'>;
  now: Date;
}): Wertzahl {
  const { connected, accounts, table, now } = input;
  if (!connected) return { kind: 'not_connected' };

  const balances = new Map<string, number>();
  let ratedAccounts = 0;
  let unreadableCount = 0;

  for (const account of accounts) {
    if (!table.isRatable(account.programId)) continue;
    if (account.balance === null) {
      const state = classifyLoyaltyAccount(account, now);
      if (state.kind === 'needs_repair' || state.kind === 'read_failed') unreadableCount++;
      continue;
    }
    ratedAccounts++;
    balances.set(account.programId, (balances.get(account.programId) ?? 0) + account.balance);
  }

  const totalAccounts = accounts.length;
  if (ratedAccounts === 0) return { kind: 'no_rateable_account', unreadableCount, totalAccounts };

  let noPlanEur = 0;
  let coveredPrograms = 0;
  const programs: ProgrammeValue[] = [];

  for (const [programId, balance] of balances) {
    // Allowlist membership guarantees a travel/all fallback for the business cabin.
    const travelRate = table.rateFor(programId, 'travel', 'business')!;
    programs.push({
      programId,
      name: getLoyaltyProgram(programId)?.name ?? programId,
      travelEur: (balance * travelRate.centsPerUnit) / 100,
    });
    const noPlanRate = table.rateFor(programId, 'no_plan');
    if (noPlanRate) {
      noPlanEur += (balance * noPlanRate.centsPerUnit) / 100;
      coveredPrograms++;
    }
  }

  return {
    kind: 'value',
    travelEur: displayEuro(programs.reduce((sum, program) => sum + program.travelEur, 0)),
    noPlan:
      coveredPrograms > 0 ? { eur: displayEuro(noPlanEur), coveredPrograms, totalPrograms: programs.length } : null,
    ratedAccounts,
    totalAccounts,
    unreadableCount,
    programs: programs.sort((a, b) => b.travelEur - a.travelEur),
  };
}
