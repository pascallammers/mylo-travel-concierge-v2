import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createTransferTableRepository } from './repository';
import { loadDachPartnerMaps, type DachPartnerMaps } from './reader';
import type { TransferRepository } from './types';

let repository: TransferRepository | undefined;

/**
 * Lazily compose the production repository with an interactive transaction driver.
 * @returns Shared cache-free repository; no connection is opened until queried.
 */
export function getTransferRepository(): TransferRepository {
  if (!repository) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Die Datenbank ist nicht konfiguriert.');
    const client = postgres(url, { max: 2, prepare: false, fetch_types: false, idle_timeout: 20, connect_timeout: 10 });
    repository = createTransferTableRepository(drizzle(client));
  }
  return repository;
}

const SNAPSHOT_TIMEOUT_MS = 2_000;
const SNAPSHOT_TTL_MS = 5 * 60_000;
let cached: { at: number; maps: Promise<DachPartnerMaps> } | undefined;

/**
 * Load the production transfer maps with seed fallback, including configuration failures.
 * The table changes monthly at most, so one snapshot serves an instance for five minutes,
 * and a slow database costs a flight search two seconds at worst before the seed answers.
 * @returns Current DACH partners and their verification month.
 */
export function readDachPartnerMaps(): Promise<DachPartnerMaps> {
  if (!cached || Date.now() - cached.at > SNAPSHOT_TTL_MS) {
    const maps = loadDachPartnerMaps({
      loadSnapshot: () =>
        Promise.race([
          getTransferRepository().loadSnapshot(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Zeitüberschreitung')), SNAPSHOT_TIMEOUT_MS).unref(),
          ),
        ]),
      warn: console.warn,
    });
    cached = { at: Date.now(), maps };
  }
  return cached.maps;
}

/** Drop the cached snapshot, e.g. after an approval changed the table. */
export function resetDachPartnerMapsCache(): void {
  cached = undefined;
}
