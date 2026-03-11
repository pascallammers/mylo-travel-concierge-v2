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
  AMEX_TRANSFER_PARTNERS_DACH,
  calculateRequiredAmexPoints,
  calculatePartnerMiles,
  getPartnersByEffectiveRate,
  getAirlinePartners,
  formatTransferRatio,
  getLocalizedValue,
  type AmexTransferPartner,
  type LocalizedString,
  type AmexLocale,
} from './amex-transfer-ratios';
