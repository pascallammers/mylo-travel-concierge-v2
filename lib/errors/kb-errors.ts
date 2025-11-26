/**
 * Knowledge Base Error Module
 *
 * Provides domain-specific error types and handling utilities for the
 * Knowledge Base RAG system. These errors are used for file operations,
 * query processing, and Gemini API interactions.
 *
 * @module kb-errors
 */

/**
 * Error codes specific to Knowledge Base operations.
 * Used for programmatic error handling and user-friendly message mapping.
 */
export enum KBErrorCode {
  /** File upload to Gemini failed */
  UPLOAD_FAILED = 'KB_UPLOAD_FAILED',
  /** File type is not supported (must be PDF, TXT, or MD) */
  INVALID_FILE_TYPE = 'KB_INVALID_FILE_TYPE',
  /** File exceeds maximum size limit */
  FILE_TOO_LARGE = 'KB_FILE_TOO_LARGE',
  /** Document indexing in FileSearchStore failed */
  INDEXING_FAILED = 'KB_INDEXING_FAILED',
  /** Knowledge base query operation failed */
  QUERY_FAILED = 'KB_QUERY_FAILED',
  /** Document deletion failed */
  DELETE_FAILED = 'KB_DELETE_FAILED',
  /** Gemini API returned an error */
  GEMINI_API_ERROR = 'KB_GEMINI_API_ERROR',
  /** API rate limit exceeded */
  RATE_LIMITED = 'KB_RATE_LIMITED',
  /** Query timed out */
  QUERY_TIMEOUT = 'KB_QUERY_TIMEOUT',
  /** Document not found in database or Gemini */
  DOCUMENT_NOT_FOUND = 'KB_DOCUMENT_NOT_FOUND',
  /** Invalid query input */
  INVALID_QUERY = 'KB_INVALID_QUERY',
  /** Bulk upload exceeded maximum file count */
  BULK_LIMIT_EXCEEDED = 'KB_BULK_LIMIT_EXCEEDED',
}

/**
 * HTTP status codes mapped to KB error codes.
 */
const KB_ERROR_STATUS_CODES: Record<KBErrorCode, number> = {
  [KBErrorCode.UPLOAD_FAILED]: 500,
  [KBErrorCode.INVALID_FILE_TYPE]: 400,
  [KBErrorCode.FILE_TOO_LARGE]: 413,
  [KBErrorCode.INDEXING_FAILED]: 500,
  [KBErrorCode.QUERY_FAILED]: 500,
  [KBErrorCode.DELETE_FAILED]: 500,
  [KBErrorCode.GEMINI_API_ERROR]: 502,
  [KBErrorCode.RATE_LIMITED]: 429,
  [KBErrorCode.QUERY_TIMEOUT]: 504,
  [KBErrorCode.DOCUMENT_NOT_FOUND]: 404,
  [KBErrorCode.INVALID_QUERY]: 400,
  [KBErrorCode.BULK_LIMIT_EXCEEDED]: 400,
};

/**
 * User-friendly messages for each KB error code.
 * Used for display in the UI without exposing internal details.
 */
const KB_ERROR_MESSAGES: Record<KBErrorCode, string> = {
  [KBErrorCode.UPLOAD_FAILED]:
    'Failed to upload the document. Please try again.',
  [KBErrorCode.INVALID_FILE_TYPE]:
    'This file type is not supported. Please upload PDF, TXT, or MD files.',
  [KBErrorCode.FILE_TOO_LARGE]:
    'The file is too large. Please upload a smaller file.',
  [KBErrorCode.INDEXING_FAILED]:
    'Failed to index the document. Please try uploading again.',
  [KBErrorCode.QUERY_FAILED]:
    'Failed to search the knowledge base. Please try again.',
  [KBErrorCode.DELETE_FAILED]:
    'Failed to delete the document. Please try again.',
  [KBErrorCode.GEMINI_API_ERROR]:
    'The AI service is temporarily unavailable. Please try again later.',
  [KBErrorCode.RATE_LIMITED]:
    'Too many requests. Please wait a moment before trying again.',
  [KBErrorCode.QUERY_TIMEOUT]:
    'The search took too long. Please try a simpler query.',
  [KBErrorCode.DOCUMENT_NOT_FOUND]:
    'The requested document was not found.',
  [KBErrorCode.INVALID_QUERY]:
    'Please provide a valid search query.',
  [KBErrorCode.BULK_LIMIT_EXCEEDED]:
    'Too many files selected. Please reduce the number of files.',
};

/**
 * Custom error class for Knowledge Base operations.
 * Extends the native Error class with KB-specific properties.
 *
 * @example
 * ```typescript
 * // Throwing a KBError
 * throw new KBError(
 *   KBErrorCode.FILE_TOO_LARGE,
 *   `File size ${sizeInMB}MB exceeds limit of ${maxSizeMB}MB`
 * );
 *
 * // Catching and handling KBErrors
 * try {
 *   await uploadDocument(file);
 * } catch (error) {
 *   if (isKBError(error)) {
 *     return error.toResponse();
 *   }
 *   throw error;
 * }
 * ```
 */
export class KBError extends Error {
  public readonly name = 'KBError';
  public readonly code: KBErrorCode;
  public readonly details: unknown;
  public readonly statusCode: number;
  public readonly userMessage: string;

  /**
   * Creates a new KBError instance.
   *
   * @param code - The KB error code identifying the error type
   * @param message - Detailed error message for logging (not shown to users)
   * @param details - Optional additional context (e.g., original error, file info)
   */
  constructor(code: KBErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.statusCode = KB_ERROR_STATUS_CODES[code];
    this.userMessage = KB_ERROR_MESSAGES[code];

    // Maintains proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KBError);
    }
  }

  /**
   * Converts the error to an HTTP Response object.
   * Suitable for use in API route handlers.
   *
   * @returns Response object with appropriate status code and JSON body
   *
   * @example
   * ```typescript
   * export async function POST(req: Request) {
   *   try {
   *     await handleUpload(req);
   *   } catch (error) {
   *     if (error instanceof KBError) {
   *       return error.toResponse();
   *     }
   *     return new Response('Internal Server Error', { status: 500 });
   *   }
   * }
   * ```
   */
  public toResponse(): Response {
    // Log detailed error for debugging
    console.error(`[KBError] ${this.code}:`, this.message, this.details);

    return Response.json(
      {
        error: {
          code: this.code,
          message: this.userMessage,
        },
      },
      { status: this.statusCode }
    );
  }

  /**
   * Creates a JSON-serializable representation of the error.
   * Useful for structured logging and error tracking.
   *
   * @returns Object containing error details
   */
  public toJSON(): {
    code: KBErrorCode;
    message: string;
    userMessage: string;
    statusCode: number;
    details?: unknown;
  } {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * Type guard to check if an error is a KBError instance.
 *
 * @param error - The error to check
 * @returns True if the error is a KBError instance
 *
 * @example
 * ```typescript
 * try {
 *   await queryKnowledgeBase(query);
 * } catch (error) {
 *   if (isKBError(error)) {
 *     // Handle KB-specific error
 *     console.log(`KB Error: ${error.code}`);
 *   } else {
 *     // Handle generic error
 *     throw error;
 *   }
 * }
 * ```
 */
export function isKBError(error: unknown): error is KBError {
  return error instanceof KBError;
}

/**
 * Checks if a KBError is a validation error (file type, size, query).
 *
 * @param error - The KBError to check
 * @returns True if the error is related to input validation
 */
export function isKBValidationError(error: KBError): boolean {
  return [
    KBErrorCode.INVALID_FILE_TYPE,
    KBErrorCode.FILE_TOO_LARGE,
    KBErrorCode.INVALID_QUERY,
    KBErrorCode.BULK_LIMIT_EXCEEDED,
  ].includes(error.code);
}

/**
 * Checks if a KBError is a transient error that may succeed on retry.
 *
 * @param error - The KBError to check
 * @returns True if the error is potentially recoverable via retry
 */
export function isKBRetryableError(error: KBError): boolean {
  return [
    KBErrorCode.UPLOAD_FAILED,
    KBErrorCode.QUERY_FAILED,
    KBErrorCode.GEMINI_API_ERROR,
    KBErrorCode.RATE_LIMITED,
    KBErrorCode.QUERY_TIMEOUT,
  ].includes(error.code);
}

/**
 * Checks if a KBError indicates the system is rate limited.
 *
 * @param error - The KBError to check
 * @returns True if rate limited
 */
export function isKBRateLimited(error: KBError): boolean {
  return error.code === KBErrorCode.RATE_LIMITED;
}

/**
 * Gets the user-friendly message for a KB error code.
 *
 * @param code - The KB error code
 * @returns User-friendly error message
 */
export function getKBErrorMessage(code: KBErrorCode): string {
  return KB_ERROR_MESSAGES[code];
}

/**
 * Creates a KBError from an unknown caught error.
 * Wraps non-KBError exceptions in a generic QUERY_FAILED error.
 *
 * @param error - The caught error
 * @param context - Optional context about where the error occurred
 * @returns A KBError instance
 *
 * @example
 * ```typescript
 * try {
 *   await geminiClient.query(query);
 * } catch (error) {
 *   throw wrapAsKBError(error, 'Failed during Gemini query');
 * }
 * ```
 */
export function wrapAsKBError(error: unknown, context?: string): KBError {
  if (isKBError(error)) {
    return error;
  }

  const message =
    error instanceof Error
      ? `${context ? `${context}: ` : ''}${error.message}`
      : context ?? 'Unknown error occurred';

  return new KBError(KBErrorCode.QUERY_FAILED, message, error);
}

/**
 * Creates a file validation error with details.
 *
 * @param fileName - Name of the invalid file
 * @param fileSize - Size of the file in bytes
 * @param mimeType - MIME type of the file
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns A KBError for the specific validation failure
 *
 * @example
 * ```typescript
 * const error = createFileValidationError(
 *   'document.exe',
 *   1024 * 1024,
 *   'application/x-executable',
 *   20 * 1024 * 1024
 * );
 * // Returns KBError with INVALID_FILE_TYPE code
 * ```
 */
export function createFileValidationError(
  fileName: string,
  fileSize: number,
  mimeType: string,
  maxSizeBytes: number
): KBError {
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);

  // Check file size first
  if (fileSize > maxSizeBytes) {
    return new KBError(
      KBErrorCode.FILE_TOO_LARGE,
      `File "${fileName}" is ${fileSizeMB}MB but max allowed is ${maxSizeMB}MB`,
      { fileName, fileSize, mimeType, maxSizeBytes }
    );
  }

  // Check MIME type
  const supportedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  if (!supportedTypes.includes(mimeType)) {
    return new KBError(
      KBErrorCode.INVALID_FILE_TYPE,
      `File "${fileName}" has unsupported type "${mimeType}"`,
      { fileName, fileSize, mimeType }
    );
  }

  // Fallback - shouldn't reach here
  return new KBError(
    KBErrorCode.UPLOAD_FAILED,
    `File "${fileName}" failed validation`,
    { fileName, fileSize, mimeType }
  );
}
