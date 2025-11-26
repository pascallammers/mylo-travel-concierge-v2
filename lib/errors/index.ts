/**
 * Error handling module exports.
 * Provides domain-specific error types for the application.
 *
 * @module errors
 */

export {
  KBError,
  KBErrorCode,
  isKBError,
  isKBValidationError,
  isKBRetryableError,
  isKBRateLimited,
  getKBErrorMessage,
  wrapAsKBError,
  createFileValidationError,
} from './kb-errors';
