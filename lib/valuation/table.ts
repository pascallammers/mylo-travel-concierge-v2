import type { NewRate, RateVersion, ResolvedRate, ValuationTable } from './types';

/**
 * Build a pure valuation snapshot using current versions and an explicit clock.
 * @param rows - Persisted versions or seed rows.
 * @param today - Instant used for strict review deadline comparison.
 * @returns Travel/no-plan lookup, allowlist, overdue rates, and oldest source month.
 */
export function buildValuationTable(rows: readonly (RateVersion | NewRate)[], today: Date): ValuationTable {
  const current = structuredClone(rows.filter((row) => !('validTo' in row) || row.validTo === null));
  const instant = today.getTime();
  const resolve = (row: NewRate | RateVersion): ResolvedRate => ({
    centsPerUnit: row.centsPerUnit,
    cabin: row.cabin,
    source: row.source,
    sourceUrl: row.sourceUrl,
    sourceAsOf: new Date(row.sourceAsOf),
    reviewDue: new Date(row.reviewDue),
    stale: row.reviewDue.getTime() < instant,
    validFrom: 'validFrom' in row ? new Date(row.validFrom) : new Date(today),
  });
  const allowlist = current.filter((row) => row.anchor === 'travel' && row.cabin === 'all');
  const ids = [...new Set(allowlist.map((row) => row.programId))].sort();
  return {
    rateFor: (programId, anchor, cabin = 'all') => {
      const matches = current.filter((row) => row.programId === programId && row.anchor === anchor);
      const row =
        (anchor === 'travel' ? matches.find((row) => row.cabin === cabin) : undefined) ??
        matches.find((row) => row.cabin === 'all');
      return row ? resolve(row) : undefined;
    },
    isRatable: (programId) => ids.includes(programId),
    programIds: () => [...ids],
    staleRates: () =>
      current
        .filter((row) => row.reviewDue.getTime() < instant)
        .map((row) => ({ ...resolve(row), programId: row.programId, anchor: row.anchor })),
    tableAsOf: allowlist.length
      ? new Date(Math.min(...allowlist.map((row) => row.sourceAsOf.getTime()))).toISOString().slice(0, 7)
      : '',
  };
}
