/**
 * Type-safe loaders for the borski-toolkit data files.
 *
 * Server-side only. Reads JSON from `lib/data/borski-toolkit/data/`,
 * validates against the colocated zod schemas, and caches the result
 * across calls within the same process.
 *
 * The borski-toolkit submodule is the single source of truth — never modify
 * its files. To pull upstream updates, see `LICENSE-THIRD-PARTY.md`.
 *
 * @module lib/data/borski-toolkit-adapter/load-from-borski
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  BorskiTransferPartnersFileSchema,
  BorskiSweetSpotsFileSchema,
  BorskiPointsValuationsFileSchema,
  BorskiAlliancesFileSchema,
  BorskiPartnerAwardsFileSchema,
  BorskiHotelChainsFileSchema,
  type BorskiTransferPartnersFile,
  type BorskiSweetSpotsFile,
  type BorskiPointsValuationsFile,
  type BorskiAlliancesFile,
  type BorskiPartnerAwardsFile,
  type BorskiHotelChainsFile,
} from './schemas';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to a borski-toolkit data file.
 *
 * @param filename - basename inside `lib/data/borski-toolkit/data/`.
 */
function dataPath(filename: string): string {
  return resolve(HERE, '..', 'borski-toolkit', 'data', filename);
}

/**
 * Read, parse, and validate one borski JSON file.
 *
 * Errors:
 * - `ENOENT` if the submodule has not been initialized (`git submodule update --init`).
 * - `ZodError` if the file shape drifted upstream (re-pin or update schema).
 *
 * @param filename - basename inside `lib/data/borski-toolkit/data/`.
 * @param schema - zod parser for the file.
 */
function readAndValidate<T>(
  filename: string,
  schema: { parse: (raw: unknown) => T },
): T {
  const path = dataPath(filename);
  const raw = readFileSync(path, 'utf8');
  const json: unknown = JSON.parse(raw);
  return schema.parse(json);
}

// ============================================
// Per-file lazy caches
// ============================================

let transferPartnersCache: BorskiTransferPartnersFile | null = null;
let sweetSpotsCache: BorskiSweetSpotsFile | null = null;
let pointsValuationsCache: BorskiPointsValuationsFile | null = null;
let alliancesCache: BorskiAlliancesFile | null = null;
let partnerAwardsCache: BorskiPartnerAwardsFile | null = null;
let hotelChainsCache: BorskiHotelChainsFile | null = null;

/**
 * Load and validate `transfer-partners.json`. Cached after first call.
 *
 * @returns parsed and validated transfer-partners file.
 */
export function loadTransferPartners(): BorskiTransferPartnersFile {
  if (transferPartnersCache) return transferPartnersCache;
  transferPartnersCache = readAndValidate(
    'transfer-partners.json',
    BorskiTransferPartnersFileSchema,
  );
  return transferPartnersCache;
}

/**
 * Load and validate `sweet-spots.json`. Cached after first call.
 *
 * @returns parsed and validated sweet-spots file.
 */
export function loadSweetSpots(): BorskiSweetSpotsFile {
  if (sweetSpotsCache) return sweetSpotsCache;
  sweetSpotsCache = readAndValidate('sweet-spots.json', BorskiSweetSpotsFileSchema);
  return sweetSpotsCache;
}

/**
 * Load and validate `points-valuations.json`. Cached after first call.
 *
 * @returns parsed and validated points-valuations file.
 */
export function loadPointsValuations(): BorskiPointsValuationsFile {
  if (pointsValuationsCache) return pointsValuationsCache;
  pointsValuationsCache = readAndValidate(
    'points-valuations.json',
    BorskiPointsValuationsFileSchema,
  );
  return pointsValuationsCache;
}

/**
 * Load and validate `alliances.json`. Cached after first call.
 *
 * @returns parsed and validated alliances file.
 */
export function loadAlliances(): BorskiAlliancesFile {
  if (alliancesCache) return alliancesCache;
  alliancesCache = readAndValidate('alliances.json', BorskiAlliancesFileSchema);
  return alliancesCache;
}

/**
 * Load and validate `partner-awards.json`. Cached after first call.
 *
 * @returns parsed and validated partner-awards file.
 */
export function loadPartnerAwards(): BorskiPartnerAwardsFile {
  if (partnerAwardsCache) return partnerAwardsCache;
  partnerAwardsCache = readAndValidate(
    'partner-awards.json',
    BorskiPartnerAwardsFileSchema,
  );
  return partnerAwardsCache;
}

/**
 * Load and validate `hotel-chains.json`. Cached after first call.
 *
 * @returns parsed and validated hotel-chains file.
 */
export function loadHotelChains(): BorskiHotelChainsFile {
  if (hotelChainsCache) return hotelChainsCache;
  hotelChainsCache = readAndValidate('hotel-chains.json', BorskiHotelChainsFileSchema);
  return hotelChainsCache;
}

/**
 * Reset all in-memory caches. Useful for tests that need a fresh load
 * after mutating the underlying file.
 */
export function resetBorskiCaches(): void {
  transferPartnersCache = null;
  sweetSpotsCache = null;
  pointsValuationsCache = null;
  alliancesCache = null;
  partnerAwardsCache = null;
  hotelChainsCache = null;
}
