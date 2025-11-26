import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  listKBDocuments,
  type KBDocument,
  type KBDocumentStatus,
} from '@/lib/db/queries/kb-documents';
import { KBError, KBErrorCode, isKBError } from '@/lib/errors';

/**
 * Document item in the list response.
 */
interface DocumentListItem {
  id: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: KBDocumentStatus;
  createdAt: string;
  indexedAt: string | null;
  geminiFileName: string;
  // File Search Store fields (new Gemini API)
  fileSearchStoreName: string | null;
  fileSearchDocumentName: string | null;
  fileSearchIndexedAt: string | null;
}

/**
 * Pagination metadata for list responses.
 */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Response structure for the list API.
 */
interface ListResponse {
  documents: DocumentListItem[];
  pagination: PaginationMeta;
}

/**
 * Schema for validating query parameters.
 */
const queryParamsSchema = z.object({
  status: z
    .enum(['uploading', 'processing', 'active', 'failed', 'archived'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Transforms a KBDocument to a list item for API response.
 *
 * @param doc - The database document
 * @returns Formatted document for API response
 */
function transformDocument(doc: KBDocument): DocumentListItem {
  return {
    id: doc.id,
    displayName: doc.displayName,
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    indexedAt: doc.indexedAt ? doc.indexedAt.toISOString() : null,
    geminiFileName: doc.geminiFileName,
    // File Search Store fields (new Gemini API)
    fileSearchStoreName: doc.fileSearchStoreName ?? null,
    fileSearchDocumentName: doc.fileSearchDocumentName ?? null,
    fileSearchIndexedAt: doc.fileSearchIndexedAt
      ? doc.fileSearchIndexedAt.toISOString()
      : null,
  };
}

/**
 * GET /api/admin/knowledge-base/list
 *
 * Lists Knowledge Base documents with pagination and optional filtering.
 *
 * Query Parameters:
 * - status: Filter by document status (uploading, processing, active, failed, archived)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - The incoming request
 * @returns JSON response with documents and pagination metadata
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const parseResult = queryParamsSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
    });

    if (!parseResult.success) {
      return Response.json(
        {
          error: {
            code: 'INVALID_PARAMS',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { status, page, limit } = parseResult.data;
    const offset = (page - 1) * limit;

    // Fetch documents from database
    const result = await listKBDocuments({
      status,
      limit,
      offset,
      includeDeleted: false,
    });

    // Transform documents for response
    const documents = result.documents.map(transformDocument);

    const response: ListResponse = {
      documents,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('[KB List] Error fetching documents:', error);

    if (isKBError(error)) {
      return error.toResponse();
    }

    return new KBError(
      KBErrorCode.QUERY_FAILED,
      'Failed to list documents',
      error
    ).toResponse();
  }
}
