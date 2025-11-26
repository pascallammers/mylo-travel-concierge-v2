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
