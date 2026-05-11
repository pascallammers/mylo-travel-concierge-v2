/**
 * Configuration module exports.
 * Provides centralized configuration for various features.
 *
 * @module config
 */

export {
  KB_CONFIG,
  KB_MAX_FILE_SIZE_BYTES,
  KB_SUPPORTED_MIME_TYPES,
  isValidKBMimeType,
  getExtensionForMimeType,
  getSupportedFileTypesDisplay,
  type KBConfig,
  type KBSupportedMimeType,
} from './knowledge-base';

export {
  // Multi-region top-level map
  TRANSFER_PARTNERS,
  // Regional partner maps
  AMEX_DACH_PARTNERS,
  CHASE_PARTNERS,
  AMEX_US_PARTNERS,
  BILT_PARTNERS,
  CAPITAL_ONE_PARTNERS,
  CITI_PARTNERS,
  // Generic helpers
  calculatePartnerMilesIn,
  calculateRequiredSourcePoints,
  sortPartnersByEffectiveRate,
  getAirlinePartnersIn,
  formatTransferRatio,
  getLocalizedValue,
  // DACH-specific (preserved for backward compat)
  AMEX_TRANSFER_PARTNERS_DACH,
  calculatePartnerMiles,
  calculateRequiredAmexPoints,
  getPartnersByEffectiveRate,
  getAirlinePartners,
  getDachPartnersByEffectiveRate,
  getDachAirlinePartners,
  formatAmexDachTransferOptions,
  findDachTransferPartner,
  // Types
  type TransferPartner,
  type AmexTransferPartner,
  type Alliance,
  type LocalizedString,
  type PartnerMap,
  type PartnerType,
  type TransferLocale,
} from './transfer-engine';

/**
 * @deprecated Use `TransferLocale` from `transfer-engine` instead.
 */
export type { TransferLocale as AmexLocale } from './transfer-engine';
