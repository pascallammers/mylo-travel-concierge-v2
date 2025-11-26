import { z } from 'zod';

/**
 * Knowledge Base configuration schema.
 * Validates and provides type-safe configuration values for the KB RAG system.
 */
const kbConfigSchema = z.object({
  /**
   * Maximum file size allowed for uploads in megabytes.
   * @default 20
   */
  maxFileSizeMB: z.coerce.number().int().positive().max(100).default(20),

  /**
   * Confidence threshold for KB query responses (0-1 scale).
   * Responses below this threshold trigger fallback to web search.
   * @default 0.70
   */
  confidenceThreshold: z.coerce.number().min(0).max(100).default(70).transform((val) => val / 100),

  /**
   * Maximum number of files allowed in a single bulk upload operation.
   * @default 10
   */
  maxBulkUploadFiles: z.coerce.number().int().positive().max(50).default(10),

  /**
   * Timeout in milliseconds for KB query operations.
   * @default 10000
   */
  queryTimeoutMs: z.coerce.number().int().positive().default(10000),

  /**
   * Name of the Gemini FileSearchStore for document indexing.
   * @default 'mylo-knowledge-base'
   */
  fileSearchStoreName: z.string().min(1).default('mylo-knowledge-base'),
});

/**
 * Configuration type inferred from the Zod schema.
 */
export type KBConfig = z.infer<typeof kbConfigSchema>;

/**
 * Supported MIME types for Knowledge Base document uploads.
 * Only PDF, plain text, and markdown files are allowed.
 */
export const KB_SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

/**
 * Type representing valid MIME types for KB uploads.
 */
export type KBSupportedMimeType = (typeof KB_SUPPORTED_MIME_TYPES)[number];

/**
 * Raw configuration values parsed from environment variables.
 * Use the parsed `KB_CONFIG` export for validated values.
 */
const rawConfig = {
  maxFileSizeMB: process.env.KB_MAX_FILE_SIZE_MB,
  confidenceThreshold: process.env.KB_CONFIDENCE_THRESHOLD,
  maxBulkUploadFiles: process.env.KB_MAX_BULK_UPLOAD_FILES,
  queryTimeoutMs: process.env.KB_QUERY_TIMEOUT_MS,
  fileSearchStoreName: process.env.KB_FILE_SEARCH_STORE_NAME,
};

/**
 * Validated Knowledge Base configuration.
 * All values are type-safe and have sensible defaults.
 *
 * @example
 * ```typescript
 * import { KB_CONFIG } from '@/lib/config/knowledge-base';
 *
 * // Check file size limits
 * if (fileSizeMB > KB_CONFIG.maxFileSizeMB) {
 *   throw new KBError(KBErrorCode.FILE_TOO_LARGE, 'File exceeds size limit');
 * }
 *
 * // Check confidence threshold
 * if (result.confidence >= KB_CONFIG.confidenceThreshold) {
 *   return result.answer;
 * }
 * ```
 */
export const KB_CONFIG = kbConfigSchema.parse(rawConfig);

/**
 * Maximum file size in bytes (derived from maxFileSizeMB).
 */
export const KB_MAX_FILE_SIZE_BYTES = KB_CONFIG.maxFileSizeMB * 1024 * 1024;

/**
 * Validates whether a given MIME type is supported for KB uploads.
 *
 * @param mimeType - The MIME type to validate
 * @returns True if the MIME type is supported, false otherwise
 *
 * @example
 * ```typescript
 * if (!isValidKBMimeType(file.type)) {
 *   throw new KBError(KBErrorCode.INVALID_FILE_TYPE, 'Unsupported file type');
 * }
 * ```
 */
export function isValidKBMimeType(mimeType: string): mimeType is KBSupportedMimeType {
  return (KB_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Gets the file extension for a given MIME type.
 *
 * @param mimeType - The MIME type to get extension for
 * @returns The file extension (including dot) or null if not supported
 *
 * @example
 * ```typescript
 * const ext = getExtensionForMimeType('application/pdf'); // '.pdf'
 * ```
 */
export function getExtensionForMimeType(mimeType: KBSupportedMimeType): string {
  const mimeToExtension: Record<KBSupportedMimeType, string> = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/markdown': '.md',
  };
  return mimeToExtension[mimeType];
}

/**
 * Gets a human-readable list of supported file types for user display.
 *
 * @returns Formatted string listing supported file types
 *
 * @example
 * ```typescript
 * const message = `Supported formats: ${getSupportedFileTypesDisplay()}`;
 * // "Supported formats: PDF, TXT, MD"
 * ```
 */
export function getSupportedFileTypesDisplay(): string {
  return 'PDF, TXT, MD';
}
