import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GeminiFileManager } from '@/lib/gemini-file-manager';
import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';
import {
  getKBDocumentById,
  bulkSoftDeleteKBDocuments,
} from '@/lib/db/queries/kb-documents';
import { KBError, KBErrorCode, isKBError } from '@/lib/errors';

/**
 * Result for a single document deletion attempt.
 */
interface DeleteResult {
  documentId: string;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Response structure for the delete API.
 */
interface DeleteResponse {
  success: boolean;
  deletedCount: number;
  results: DeleteResult[];
  errors?: DeleteResult[];
}

/**
 * Schema for validating the delete request body.
 * Supports both single ID and array of IDs for backward compatibility.
 */
const deleteRequestSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).optional(),
  documentId: z.string().min(1).optional(),
  // Legacy support for 'name' field (Gemini file name)
  name: z.string().min(1).optional(),
}).refine(
  (data) => data.documentIds || data.documentId || data.name,
  { message: 'At least one of documentIds, documentId, or name is required' }
);

/**
 * Deletes a single document by ID (soft delete in DB, delete from Gemini).
 * Handles both new File Search Store documents and legacy Files API documents.
 *
 * @param documentId - The document ID to delete
 * @returns Result of the deletion attempt
 */
async function deleteDocument(documentId: string): Promise<DeleteResult> {
  try {
    // Fetch document to get Gemini file references
    const document = await getKBDocumentById(documentId);

    if (!document) {
      return {
        documentId,
        status: 'error',
        error: 'Document not found',
      };
    }

    // Delete from File Search Store (new API) if available
    if (document.fileSearchDocumentName) {
      try {
        await geminiFileSearchStore.deleteDocument(document.fileSearchDocumentName);
        console.log(`[KB Delete] Deleted from File Search Store: ${document.fileSearchDocumentName}`);
      } catch (fileSearchError) {
        console.warn(
          `[KB Delete] File Search Store deletion failed for ${document.fileSearchDocumentName}, continuing with soft delete:`,
          fileSearchError
        );
        // Continue with soft delete even if File Search Store deletion fails
      }
    }

    // Delete from legacy Files API if available (backward compatibility)
    if (document.geminiFileName) {
      try {
        await GeminiFileManager.deleteFile(document.geminiFileName);
        console.log(`[KB Delete] Deleted from legacy Files API: ${document.geminiFileName}`);
      } catch (geminiError) {
        console.warn(
          `[KB Delete] Legacy Files API deletion failed for ${document.geminiFileName}, continuing with soft delete:`,
          geminiError
        );
        // Continue with soft delete even if Gemini deletion fails
      }
    }

    return {
      documentId,
      status: 'success',
    };
  } catch (error) {
    console.error(`[KB Delete] Failed to delete document ${documentId}:`, error);

    const errorMessage = isKBError(error)
      ? error.userMessage
      : 'Failed to delete document';

    return {
      documentId,
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Deletes a document by Gemini file name (legacy support).
 *
 * @param name - The Gemini file name
 * @returns Response for the deletion
 */
async function handleLegacyDelete(name: string): Promise<Response> {
  try {
    await GeminiFileManager.deleteFile(name);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[KB Delete] Legacy delete error:', error);
    return new KBError(
      KBErrorCode.DELETE_FAILED,
      `Failed to delete file: ${name}`,
      error
    ).toResponse();
  }
}

/**
 * POST /api/admin/knowledge-base/delete
 *
 * Deletes Knowledge Base documents. Supports bulk deletion.
 *
 * Request Body:
 * - documentIds: string[] - Array of document IDs to delete
 * - documentId: string - Single document ID (backward compatibility)
 * - name: string - Gemini file name (legacy support)
 *
 * @param request - The incoming request
 * @returns JSON response with deletion results
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = deleteRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return Response.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { documentIds, documentId, name } = parseResult.data;

    // Handle legacy 'name' field (Gemini file name)
    if (name && !documentIds && !documentId) {
      return handleLegacyDelete(name);
    }

    // Build list of IDs to delete
    const idsToDelete: string[] = [];

    if (documentIds) {
      idsToDelete.push(...documentIds);
    }

    if (documentId && !idsToDelete.includes(documentId)) {
      idsToDelete.push(documentId);
    }

    if (idsToDelete.length === 0) {
      return new KBError(
        KBErrorCode.INVALID_QUERY,
        'No document IDs provided for deletion'
      ).toResponse();
    }

    // Process each deletion (for Gemini file deletion)
    const results: DeleteResult[] = [];
    const successfulIds: string[] = [];

    for (const id of idsToDelete) {
      const result = await deleteDocument(id);
      results.push(result);
      if (result.status === 'success') {
        successfulIds.push(id);
      }
    }

    // Bulk soft delete successful documents from database
    let deletedCount = 0;
    if (successfulIds.length > 0) {
      deletedCount = await bulkSoftDeleteKBDocuments(successfulIds);
    }

    // Collect errors
    const errors = results.filter((r) => r.status === 'error');

    const response: DeleteResponse = {
      success: errors.length === 0,
      deletedCount,
      results,
      ...(errors.length > 0 && { errors }),
    };

    // Return 207 Multi-Status if there are partial failures
    const statusCode =
      errors.length === 0 ? 200 : errors.length === idsToDelete.length ? 400 : 207;

    return Response.json(response, { status: statusCode });
  } catch (error) {
    console.error('[KB Delete] Unexpected error:', error);

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        },
        { status: 400 }
      );
    }

    if (isKBError(error)) {
      return error.toResponse();
    }

    return new KBError(
      KBErrorCode.DELETE_FAILED,
      'Unexpected error during deletion',
      error
    ).toResponse();
  }
}

/**
 * DELETE /api/admin/knowledge-base/delete
 *
 * Legacy support for DELETE method with query parameter.
 *
 * Query Parameters:
 * - name: Gemini file name to delete
 *
 * @param request - The incoming request
 * @returns JSON response with deletion result
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return new KBError(
      KBErrorCode.INVALID_QUERY,
      'File name is required in query parameter'
    ).toResponse();
  }

  return handleLegacyDelete(name);
}
