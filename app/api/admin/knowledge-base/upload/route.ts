import { NextRequest } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { GeminiFileManager } from '@/lib/gemini-file-manager';
import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';
import { createKBDocument } from '@/lib/db/queries/kb-documents';
import {
  KB_CONFIG,
  KB_MAX_FILE_SIZE_BYTES,
  KB_SUPPORTED_MIME_TYPES,
  isValidKBMimeType,
  getSupportedFileTypesDisplay,
} from '@/lib/config/knowledge-base';
import { KBError, KBErrorCode, isKBError } from '@/lib/errors';

/**
 * Result for a single file upload attempt.
 */
interface FileUploadResult {
  fileName: string;
  status: 'success' | 'error';
  documentId?: string;
  error?: string;
}

/**
 * Response structure for the upload API.
 */
interface UploadResponse {
  success: boolean;
  results: FileUploadResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Validates a single file before upload.
 *
 * @param file - The file to validate
 * @throws KBError if validation fails
 */
function validateFile(file: File): void {
  // Validate file size
  if (file.size > KB_MAX_FILE_SIZE_BYTES) {
    throw new KBError(
      KBErrorCode.FILE_TOO_LARGE,
      `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB but max is ${KB_CONFIG.maxFileSizeMB}MB`,
      { fileName: file.name, size: file.size, maxSize: KB_MAX_FILE_SIZE_BYTES }
    );
  }

  // Validate MIME type
  if (!isValidKBMimeType(file.type)) {
    throw new KBError(
      KBErrorCode.INVALID_FILE_TYPE,
      `File "${file.name}" has unsupported type "${file.type}". Supported: ${getSupportedFileTypesDisplay()}`,
      { fileName: file.name, mimeType: file.type, supported: KB_SUPPORTED_MIME_TYPES }
    );
  }
}

/**
 * Processes a single file upload: validates, uploads to Gemini, and creates DB record.
 *
 * @param file - The file to process
 * @returns Result of the upload attempt
 */
/**
 * Sanitizes a filename for use in file paths and HTTP headers.
 * Removes diacritics (ü→u, ö→o, ä→a) and replaces non-ASCII characters.
 */
function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x00-\x7F]/g, '_');  // Replace non-ASCII with underscore
}

async function processFileUpload(file: File): Promise<FileUploadResult> {
  const tempDir = '/tmp';
  const safeFileName = sanitizeFilename(file.name);
  const tempFilePath = join(tempDir, `kb-${Date.now()}-${safeFileName}`);

  try {
    // Validate file
    validateFile(file);

    // Write to temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tempFilePath, buffer);

    // Upload to Gemini Legacy Files API (for backward compatibility)
    const geminiFile = await GeminiFileManager.uploadFile(
      tempFilePath,
      safeFileName,
      file.type
    );

    // Upload to Gemini File Search Store (for RAG querying)
    const fileSearchResult = await geminiFileSearchStore.uploadFile(
      tempFilePath,
      safeFileName,
      {
        mimeType: file.type,
        chunkingConfig: {
          maxTokensPerChunk: 512,
          maxOverlapTokens: 50
        }
      }
    );

    // Create database record with both legacy and new file search store fields
    const document = await createKBDocument({
      // Legacy Gemini Files API fields
      geminiFileName: geminiFile.name,
      geminiFileUri: geminiFile.uri,
      displayName: file.name,
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      // File Search Store fields
      fileSearchStoreName: fileSearchResult.storeName,
      fileSearchDocumentName: fileSearchResult.documentName,
      fileSearchIndexedAt: new Date(),
      // Status is 'active' since File Search Store already indexed the document
      status: 'active',
    });

    return {
      fileName: file.name,
      status: 'success',
      documentId: document.id,
    };
  } catch (error) {
    console.error(`[KB Upload] Failed to process file "${file.name}":`, error);

    const errorMessage = isKBError(error)
      ? error.userMessage
      : 'Failed to upload file. Please try again.';

    return {
      fileName: file.name,
      status: 'error',
      error: errorMessage,
    };
  } finally {
    // Clean up temp file
    await unlink(tempFilePath).catch(() => {
      // Ignore cleanup errors
    });
  }
}

/**
 * POST /api/admin/knowledge-base/upload
 *
 * Handles bulk file uploads to the Knowledge Base.
 * Accepts multiple files via the `files` field in FormData.
 *
 * @param request - The incoming request with FormData
 * @returns JSON response with per-file upload results
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const formData = await request.formData();
    const files: File[] = [];

    // Collect all files from FormData (supports both 'file' and 'files' keys)
    const fileEntries = formData.getAll('files');
    const singleFile = formData.get('file');

    // Handle files[] array
    for (const entry of fileEntries) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }

    // Handle single file (backward compatibility)
    if (singleFile instanceof File) {
      files.push(singleFile);
    }

    // Check if any files were provided
    if (files.length === 0) {
      return new KBError(
        KBErrorCode.INVALID_FILE_TYPE,
        'No files provided in request'
      ).toResponse();
    }

    // Check bulk upload limit
    if (files.length > KB_CONFIG.maxBulkUploadFiles) {
      return new KBError(
        KBErrorCode.BULK_LIMIT_EXCEEDED,
        `Too many files. Maximum ${KB_CONFIG.maxBulkUploadFiles} files per upload, got ${files.length}`,
        { count: files.length, max: KB_CONFIG.maxBulkUploadFiles }
      ).toResponse();
    }

    // Process each file
    const results: FileUploadResult[] = [];
    for (const file of files) {
      const result = await processFileUpload(file);
      results.push(result);
    }

    // Calculate summary
    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;

    const response: UploadResponse = {
      success: failed === 0,
      results,
      summary: {
        total: files.length,
        successful,
        failed,
      },
    };

    // Return 207 Multi-Status if there are partial failures
    const statusCode = failed === 0 ? 200 : failed === files.length ? 400 : 207;

    return Response.json(response, { status: statusCode });
  } catch (error) {
    console.error('[KB Upload] Unexpected error:', error);

    if (isKBError(error)) {
      return error.toResponse();
    }

    return new KBError(
      KBErrorCode.UPLOAD_FAILED,
      'Unexpected error during upload',
      error
    ).toResponse();
  }
}
