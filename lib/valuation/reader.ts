import { seedRows } from './seeds';
import { buildValuationTable } from './table';
import type { ValuationRepository, ValuationTable } from './types';

interface ReaderDependencies {
  loadCurrentRows: ValuationRepository['loadCurrentRows'];
  warn: (message: string) => void;
  now: () => Date;
}

/**
 * Read the current valuation table with a warning and seed fallback on missing data.
 * @param deps - Read-only persistence, logger, and clock.
 * @returns Current accepted rates, or dated seeds for an empty/unreachable database.
 */
export async function loadValuationTable(deps: ReaderDependencies): Promise<ValuationTable> {
  try {
    const rows = await deps.loadCurrentRows();
    if (rows.some((row) => row.validTo === null)) return buildValuationTable(rows, deps.now());
    deps.warn('Bewertungstabelle: Keine aktuellen Daten; Seed wird verwendet.');
  } catch {
    deps.warn('Bewertungstabelle: Datenbank nicht verfügbar; Seed wird verwendet.');
  }
  return buildValuationTable(seedRows(), deps.now());
}
