import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createTransferTableRepository } from './repository';
import { loadDachPartnerMaps } from './reader';
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
    const client = postgres(url, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
    repository = createTransferTableRepository(drizzle(client));
  }
  return repository;
}

/**
 * Load the production transfer maps with seed fallback, including configuration failures.
 * @returns Current DACH partners and their verification month.
 */
export function readDachPartnerMaps() {
  return loadDachPartnerMaps({ loadSnapshot: () => getTransferRepository().loadSnapshot(), warn: console.warn });
}
