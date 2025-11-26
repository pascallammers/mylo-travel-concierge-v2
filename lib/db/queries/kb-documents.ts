import 'server-only';

import { and, count, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { db } from '../index';
import { kbDocuments, type KBDocument, type KBDocumentStatus } from '../schema';
import { ChatSDKError } from '@/lib/errors';

// Re-export types for convenience
export type { KBDocument, KBDocumentStatus };

/**
 * Input data for creating a new KB document
 */
export interface CreateKBDocumentData {
  geminiFileName: string;
  geminiFileUri: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status?: KBDocumentStatus;
  statusMessage?: string;
  confidenceThreshold?: number;
  uploadedBy?: string;
  // File Search Store fields (new Gemini API)
  fileSearchStoreName?: string;
  fileSearchDocumentName?: string;
  fileSearchIndexedAt?: Date;
}

/**
 * Options for listing KB documents
 */
export interface ListKBDocumentsOptions {
  status?: KBDocumentStatus;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result for KB documents list
 */
export interface ListKBDocumentsResult {
  documents: KBDocument[];
  total: number;
  hasMore: boolean;
}

/**
 * Input data for updating a KB document
 */
export interface UpdateKBDocumentData {
  displayName?: string;
  status?: KBDocumentStatus;
  statusMessage?: string | null;
  indexedAt?: Date | null;
  chunkCount?: number | null;
  confidenceThreshold?: number;
  // File Search Store fields (new Gemini API)
  fileSearchStoreName?: string | null;
  fileSearchDocumentName?: string | null;
  fileSearchIndexedAt?: Date | null;
}

// ============================================
// Create Operations
// ============================================

/**
 * Creates a new Knowledge Base document record.
 * @param data - Document metadata to store
 * @returns The created document
 */
export async function createKBDocument(data: CreateKBDocumentData): Promise<KBDocument> {
  try {
    const [newDocument] = await db
      .insert(kbDocuments)
      .values({
        geminiFileName: data.geminiFileName,
        geminiFileUri: data.geminiFileUri,
        displayName: data.displayName,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        status: data.status ?? 'uploading',
        statusMessage: data.statusMessage,
        confidenceThreshold: data.confidenceThreshold ?? 70,
        uploadedBy: data.uploadedBy,
        // File Search Store fields (new Gemini API)
        fileSearchStoreName: data.fileSearchStoreName,
        fileSearchDocumentName: data.fileSearchDocumentName,
        fileSearchIndexedAt: data.fileSearchIndexedAt,
      })
      .returning();

    return newDocument;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create KB document: ' + error);
  }
}

// ============================================
// Read Operations
// ============================================

/**
 * Retrieves a KB document by its ID.
 * @param id - The document ID
 * @returns The document or null if not found
 */
export async function getKBDocumentById(id: string): Promise<KBDocument | null> {
  try {
    const [document] = await db
      .select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.id, id), isNull(kbDocuments.deletedAt)))
      .$withCache();

    return document ?? null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get KB document by id');
  }
}

/**
 * Retrieves a KB document by its Gemini file name.
 * @param geminiFileName - The Gemini file name (e.g., "files/abc123")
 * @returns The document or null if not found
 */
export async function getKBDocumentByGeminiName(geminiFileName: string): Promise<KBDocument | null> {
  try {
    const [document] = await db
      .select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.geminiFileName, geminiFileName), isNull(kbDocuments.deletedAt)))
      .$withCache();

    return document ?? null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get KB document by Gemini name');
  }
}

/**
 * Lists KB documents with pagination and optional filtering.
 * @param options - Listing options (status filter, pagination)
 * @returns Paginated list of documents
 */
export async function listKBDocuments(options: ListKBDocumentsOptions = {}): Promise<ListKBDocumentsResult> {
  const { status, includeDeleted = false, limit = 20, offset = 0 } = options;

  try {
    // Build where conditions
    const conditions: SQL<unknown>[] = [];

    if (!includeDeleted) {
      conditions.push(isNull(kbDocuments.deletedAt));
    }

    if (status) {
      conditions.push(eq(kbDocuments.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch documents with extended limit to check hasMore
    const extendedLimit = limit + 1;
    const documents = await db
      .select()
      .from(kbDocuments)
      .where(whereClause)
      .orderBy(desc(kbDocuments.createdAt))
      .limit(extendedLimit)
      .offset(offset)
      .$withCache();

    const hasMore = documents.length > limit;
    const resultDocuments = hasMore ? documents.slice(0, limit) : documents;

    // Get actual total count for pagination
    const [countResult] = await db
      .select({ value: count() })
      .from(kbDocuments)
      .where(whereClause);

    const total = countResult?.value ?? 0;

    return {
      documents: resultDocuments,
      total,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to list KB documents');
  }
}

/**
 * Retrieves all active KB documents (status = 'active', not deleted).
 * Used for querying the knowledge base.
 * @returns List of active documents
 */
export async function getActiveKBDocuments(): Promise<KBDocument[]> {
  try {
    return await db
      .select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.status, 'active'), isNull(kbDocuments.deletedAt)))
      .orderBy(desc(kbDocuments.createdAt))
      .$withCache();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get active KB documents');
  }
}

// ============================================
// Update Operations
// ============================================

/**
 * Updates a KB document with the provided data.
 * @param id - The document ID
 * @param data - Fields to update
 * @returns The updated document or null if not found
 */
export async function updateKBDocument(id: string, data: UpdateKBDocumentData): Promise<KBDocument | null> {
  try {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.statusMessage !== undefined) updateData.statusMessage = data.statusMessage;
    if (data.indexedAt !== undefined) updateData.indexedAt = data.indexedAt;
    if (data.chunkCount !== undefined) updateData.chunkCount = data.chunkCount;
    if (data.confidenceThreshold !== undefined) updateData.confidenceThreshold = data.confidenceThreshold;
    // File Search Store fields (new Gemini API)
    if (data.fileSearchStoreName !== undefined) updateData.fileSearchStoreName = data.fileSearchStoreName;
    if (data.fileSearchDocumentName !== undefined) updateData.fileSearchDocumentName = data.fileSearchDocumentName;
    if (data.fileSearchIndexedAt !== undefined) updateData.fileSearchIndexedAt = data.fileSearchIndexedAt;

    const [updated] = await db
      .update(kbDocuments)
      .set(updateData)
      .where(and(eq(kbDocuments.id, id), isNull(kbDocuments.deletedAt)))
      .returning();

    return updated ?? null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update KB document');
  }
}

/**
 * Updates the status of a KB document with an optional message.
 * @param id - The document ID
 * @param status - The new status
 * @param message - Optional status message
 * @returns The updated document or null if not found
 */
export async function updateKBDocumentStatus(
  id: string,
  status: KBDocumentStatus,
  message?: string,
): Promise<KBDocument | null> {
  try {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (message !== undefined) {
      updateData.statusMessage = message;
    }

    // Set indexedAt when transitioning to 'active'
    if (status === 'active') {
      updateData.indexedAt = new Date();
    }

    const [updated] = await db
      .update(kbDocuments)
      .set(updateData)
      .where(and(eq(kbDocuments.id, id), isNull(kbDocuments.deletedAt)))
      .returning();

    return updated ?? null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update KB document status');
  }
}

// ============================================
// Delete Operations
// ============================================

/**
 * Soft deletes a KB document by setting deletedAt timestamp.
 * @param id - The document ID
 * @returns The soft-deleted document or null if not found
 */
export async function softDeleteKBDocument(id: string): Promise<KBDocument | null> {
  try {
    const [deleted] = await db
      .update(kbDocuments)
      .set({
        deletedAt: new Date(),
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(and(eq(kbDocuments.id, id), isNull(kbDocuments.deletedAt)))
      .returning();

    return deleted ?? null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to soft delete KB document');
  }
}

/**
 * Bulk soft deletes multiple KB documents.
 * @param ids - Array of document IDs to delete
 * @returns Number of documents deleted
 */
export async function bulkSoftDeleteKBDocuments(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  try {
    const result = await db
      .update(kbDocuments)
      .set({
        deletedAt: new Date(),
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(and(inArray(kbDocuments.id, ids), isNull(kbDocuments.deletedAt)))
      .returning({ id: kbDocuments.id });

    return result.length;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to bulk delete KB documents');
  }
}
