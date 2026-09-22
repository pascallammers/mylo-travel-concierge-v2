import { buildValuationTable } from './table';
import type { RateKey, ResolvedRate, ValuationRepository } from './types';

export interface CheckDependencies {
  repository: Pick<ValuationRepository, 'ensureSeeded' | 'loadCurrentRows'>;
  sendMail: (rates: (ResolvedRate & RateKey)[]) => Promise<void>;
  now: () => Date;
}

/**
 * Enforce manual review deadlines without fetching or comparing external sources.
 * @param deps - Persistence, notification sender, and clock.
 * @returns Overdue count and oldest current travel/all source month.
 */
export async function runValuationTableCheck(deps: CheckDependencies): Promise<{ stale: number; tableAsOf: string }> {
  const now = deps.now();
  await deps.repository.ensureSeeded(now);
  const table = buildValuationTable(await deps.repository.loadCurrentRows(), now);
  const stale = table.staleRates();
  if (stale.length) await deps.sendMail(stale);
  return { stale: stale.length, tableAsOf: table.tableAsOf };
}
