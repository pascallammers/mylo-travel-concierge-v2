import { getInteractiveDatabase } from '../db/interactive-client';
import { createValuationRepository } from './repository';
import { loadValuationTable } from './reader';
import type { ValuationRepository, ValuationTable } from './types';

let repository: ValuationRepository | undefined;

/**
 * Compose the production repository lazily with the shared interactive pool.
 * @returns Shared repository without opening a connection until queried.
 */
export function getValuationRepository(): ValuationRepository {
  repository ??= createValuationRepository(getInteractiveDatabase());
  return repository;
}

const SNAPSHOT_TIMEOUT_MS = 2_000;
const SNAPSHOT_TTL_MS = 5 * 60_000;
let cached: { at: number; table: Promise<ValuationTable> } | undefined;

async function loadRowsWithTimeout() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getValuationRepository().loadCurrentRows(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Zeitüberschreitung')), SNAPSHOT_TIMEOUT_MS);
        timeout.unref();
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Bound database latency to two seconds and reuse snapshots for five minutes.
 * @returns Accepted valuation table, with seed fallback on configuration/query failure.
 */
export function readValuationTable(): Promise<ValuationTable> {
  if (!cached || Date.now() - cached.at >= SNAPSHOT_TTL_MS) {
    cached = {
      at: Date.now(),
      table: loadValuationTable({ loadCurrentRows: loadRowsWithTimeout, warn: console.warn, now: () => new Date() }),
    };
  }
  return cached.table;
}

/**
 * Invalidate this instance's snapshot after an administrator writes a rate.
 * @returns Nothing; the next read loads a new snapshot.
 */
export function resetValuationTableCache(): void {
  cached = undefined;
}
