/**
 * Type-safe loaders for the borski-toolkit data files.
 *
 * Server-side only. JSON is imported statically (build-time inlined via the
 * bundler), parsed against the colocated zod schemas, and cached across
 * calls within the same process. No filesystem read at runtime — works
 * identically in tsx tests, `next dev`, `next start`, and Vercel without
 * any `outputFileTracingIncludes` config.
 *
 * Trade-off: the 6 active JSON files (~99 KB total) ship inside any
 * server bundle that imports this module. The 3 large hotel-property
 * files (~2 MB combined) are intentionally NOT imported here — add a
 * separate fs-backed loader when the hotel feature lands in Phase 2.
 *
 * The borski-toolkit submodule is the single source of truth — never
 * modify its files. To pull upstream updates, see `LICENSE-THIRD-PARTY.md`.
 *
 * @module lib/data/borski-toolkit-adapter/load-from-borski
 */

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

import transferPartnersData from '../borski-toolkit/data/transfer-partners.json' with { type: 'json' };
import sweetSpotsData from '../borski-toolkit/data/sweet-spots.json' with { type: 'json' };
import pointsValuationsData from '../borski-toolkit/data/points-valuations.json' with { type: 'json' };
import alliancesData from '../borski-toolkit/data/alliances.json' with { type: 'json' };
import partnerAwardsData from '../borski-toolkit/data/partner-awards.json' with { type: 'json' };
import hotelChainsData from '../borski-toolkit/data/hotel-chains.json' with { type: 'json' };

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
  transferPartnersCache = BorskiTransferPartnersFileSchema.parse(transferPartnersData);
  return transferPartnersCache;
}

/**
 * Load and validate `sweet-spots.json`. Cached after first call.
 *
 * @returns parsed and validated sweet-spots file.
 */
export function loadSweetSpots(): BorskiSweetSpotsFile {
  if (sweetSpotsCache) return sweetSpotsCache;
  sweetSpotsCache = BorskiSweetSpotsFileSchema.parse(sweetSpotsData);
  return sweetSpotsCache;
}

/**
 * Load and validate `points-valuations.json`. Cached after first call.
 *
 * @returns parsed and validated points-valuations file.
 */
export function loadPointsValuations(): BorskiPointsValuationsFile {
  if (pointsValuationsCache) return pointsValuationsCache;
  pointsValuationsCache = BorskiPointsValuationsFileSchema.parse(pointsValuationsData);
  return pointsValuationsCache;
}

/**
 * Load and validate `alliances.json`. Cached after first call.
 *
 * @returns parsed and validated alliances file.
 */
export function loadAlliances(): BorskiAlliancesFile {
  if (alliancesCache) return alliancesCache;
  alliancesCache = BorskiAlliancesFileSchema.parse(alliancesData);
  return alliancesCache;
}

/**
 * Load and validate `partner-awards.json`. Cached after first call.
 *
 * @returns parsed and validated partner-awards file.
 */
export function loadPartnerAwards(): BorskiPartnerAwardsFile {
  if (partnerAwardsCache) return partnerAwardsCache;
  partnerAwardsCache = BorskiPartnerAwardsFileSchema.parse(partnerAwardsData);
  return partnerAwardsCache;
}

/**
 * Load and validate `hotel-chains.json`. Cached after first call.
 *
 * @returns parsed and validated hotel-chains file.
 */
export function loadHotelChains(): BorskiHotelChainsFile {
  if (hotelChainsCache) return hotelChainsCache;
  hotelChainsCache = BorskiHotelChainsFileSchema.parse(hotelChainsData);
  return hotelChainsCache;
}

/**
 * Reset all in-memory caches. Useful for tests that need a fresh parse
 * after mutating the underlying schema.
 */
export function resetBorskiCaches(): void {
  transferPartnersCache = null;
  sweetSpotsCache = null;
  pointsValuationsCache = null;
  alliancesCache = null;
  partnerAwardsCache = null;
  hotelChainsCache = null;
}
