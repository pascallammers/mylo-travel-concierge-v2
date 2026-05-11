/**
 * Multi-region transfer engine — public API.
 *
 * Models loyalty-points transfer partners across regions (DACH, US) and
 * source programs (Amex MR, Chase UR, Bilt, Capital One, Citi TY).
 *
 * Public surface:
 * - `TRANSFER_PARTNERS`: nested map of all partners by region/source program.
 * - `AMEX_DACH_PARTNERS`: convenience direct access to the DACH Amex set.
 * - Generic helpers operating on any `PartnerMap`.
 * - DACH-specific helpers preserved for backward compatibility.
 *
 * @module lib/config/transfer-engine
 */

import { AMEX_DACH_PARTNERS } from './dach';
import { CHASE_PARTNERS } from './us-chase';
import { AMEX_US_PARTNERS } from './us-amex';
import { BILT_PARTNERS } from './us-bilt';
import { CAPITAL_ONE_PARTNERS } from './us-capital-one';
import { CITI_PARTNERS } from './us-citi';

// ============================================
// Re-exports: types
// ============================================

export type {
  AmexTransferPartner,
  Alliance,
  LocalizedString,
  PartnerMap,
  PartnerType,
  TransferLocale,
  TransferPartner,
} from './types';

// ============================================
// Re-exports: regional partner maps
// ============================================

export { AMEX_DACH_PARTNERS } from './dach';
export { CHASE_PARTNERS } from './us-chase';
export { AMEX_US_PARTNERS } from './us-amex';
export { BILT_PARTNERS } from './us-bilt';
export { CAPITAL_ONE_PARTNERS } from './us-capital-one';
export { CITI_PARTNERS } from './us-citi';

// ============================================
// Re-exports: helpers
// ============================================

export {
  // Generic helpers (work on any PartnerMap)
  calculatePartnerMilesIn,
  calculateRequiredSourcePoints,
  sortPartnersByEffectiveRate,
  getAirlinePartnersIn,
  formatTransferRatio,
  getLocalizedValue,
  // DACH-specific convenience wrappers (backward compat)
  calculatePartnerMiles,
  calculateRequiredAmexPoints,
  getDachPartnersByEffectiveRate,
  getDachAirlinePartners,
  formatAmexDachTransferOptions,
  findDachTransferPartner,
} from './helpers';

// ============================================
// Top-level multi-region map
// ============================================

/**
 * All transfer partners organized by region and source program.
 *
 * Shape:
 * ```
 * {
 *   dach: { amex: { ...partners } },
 *   us:   { chase, amex, bilt, capitalOne, citi: { ...partners } },
 * }
 * ```
 *
 * Use this for cross-region calculations and the ai-sdk `transfer-partner-optimizer` tool.
 */
export const TRANSFER_PARTNERS = {
  dach: {
    amex: AMEX_DACH_PARTNERS,
  },
  us: {
    chase: CHASE_PARTNERS,
    amex: AMEX_US_PARTNERS,
    bilt: BILT_PARTNERS,
    capitalOne: CAPITAL_ONE_PARTNERS,
    citi: CITI_PARTNERS,
  },
} as const;

/**
 * Backward-compatible alias for the legacy `AMEX_TRANSFER_PARTNERS_DACH` constant.
 * @deprecated Use `AMEX_DACH_PARTNERS` or `TRANSFER_PARTNERS.dach.amex` directly.
 */
export { AMEX_DACH_PARTNERS as AMEX_TRANSFER_PARTNERS_DACH } from './dach';

/**
 * Backward-compatible alias for the legacy `getAirlinePartners()` helper.
 * @deprecated Use `getDachAirlinePartners()` or `getAirlinePartnersIn(AMEX_DACH_PARTNERS)`.
 */
export { getDachAirlinePartners as getAirlinePartners } from './helpers';

/**
 * Backward-compatible alias for the legacy `getPartnersByEffectiveRate()` helper.
 * @deprecated Use `getDachPartnersByEffectiveRate()` or `sortPartnersByEffectiveRate(AMEX_DACH_PARTNERS)`.
 */
export { getDachPartnersByEffectiveRate as getPartnersByEffectiveRate } from './helpers';
