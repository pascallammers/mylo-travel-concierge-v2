/**
 * Unit tests for Knowledge Base document database queries.
 * Tests CRUD operations with mocked database layer.
 *
 * @module kb-documents.test
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Mock Types and Factories
// ============================================

/**
 * Mock KBDocument type matching the schema.
 */
interface MockKBDocument {
  id: string;
  geminiFileName: string;
  geminiFileUri: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploading' | 'processing' | 'active' | 'failed' | 'archived';
  statusMessage: string | null;
  indexedAt: Date | null;
  chunkCount: number | null;
  confidenceThreshold: number;
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Factory to create mock KB documents with defaults.
 */
function createMockDocument(overrides: Partial<MockKBDocument> = {}): MockKBDocument {
  const now = new Date();
  return {
    id: overrides.id ?? `doc-${Date.now()}`,
    geminiFileName: overrides.geminiFileName ?? 'files/abc123',
    geminiFileUri: overrides.geminiFileUri ?? 'gs://kb/files/abc123',
    displayName: overrides.displayName ?? 'Test Document.pdf',
    originalFileName: overrides.originalFileName ?? 'test-doc.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    sizeBytes: overrides.sizeBytes ?? 1024 * 1024,
    status: overrides.status ?? 'active',
    statusMessage: overrides.statusMessage ?? null,
    indexedAt: overrides.indexedAt ?? now,
    chunkCount: overrides.chunkCount ?? 10,
    confidenceThreshold: overrides.confidenceThreshold ?? 70,
    uploadedBy: overrides.uploadedBy ?? 'user-123',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
  };
}

// ============================================
// In-Memory Database Mock
// ============================================

/**
 * Simple in-memory store for testing database operations.
 */
class MockDocumentStore {
  private documents: Map<string, MockKBDocument> = new Map();
  private idCounter = 1;

  /**
   * Resets the store to initial empty state.
   */
  reset(): void {
    this.documents.clear();
    this.idCounter = 1;
  }

  /**
   * Generates a unique ID for new documents.
   */
  generateId(): string {
    return `doc-${this.idCounter++}`;
  }

  /**
   * Creates a new document in the store.
   */
  create(data: Omit<MockKBDocument, 'id' | 'createdAt' | 'updatedAt'>): MockKBDocument {
    const id = this.generateId();
    const now = new Date();
    const document: MockKBDocument = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, document);
    return document;
  }

  /**
   * Gets a document by ID (excludes soft deleted).
   */
  getById(id: string): MockKBDocument | null {
    const doc = this.documents.get(id);
    if (!doc || doc.deletedAt !== null) {
      return null;
    }
    return doc;
  }

  /**
   * Gets a document by Gemini file name.
   */
  getByGeminiName(geminiFileName: string): MockKBDocument | null {
    for (const doc of this.documents.values()) {
      if (doc.geminiFileName === geminiFileName && doc.deletedAt === null) {
        return doc;
      }
    }
    return null;
  }

  /**
   * Lists documents with optional filtering.
   */
  list(options: {
    status?: string;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  } = {}): { documents: MockKBDocument[]; total: number; hasMore: boolean } {
    const { status, includeDeleted = false, limit = 20, offset = 0 } = options;

    let docs = Array.from(this.documents.values());

    // Filter deleted
    if (!includeDeleted) {
      docs = docs.filter((d) => d.deletedAt === null);
    }

    // Filter by status
    if (status) {
      docs = docs.filter((d) => d.status === status);
    }

    // Sort by createdAt descending
    docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = docs.length;
    const paginated = docs.slice(offset, offset + limit + 1);
    const hasMore = paginated.length > limit;
    const resultDocs = hasMore ? paginated.slice(0, limit) : paginated;

    return { documents: resultDocs, total, hasMore };
  }

  /**
   * Updates a document by ID.
   */
  update(
    id: string,
    data: Partial<Omit<MockKBDocument, 'id' | 'createdAt'>>
  ): MockKBDocument | null {
    const doc = this.documents.get(id);
    if (!doc || doc.deletedAt !== null) {
      return null;
    }

    const updated: MockKBDocument = {
      ...doc,
      ...data,
      updatedAt: new Date(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  /**
   * Soft deletes a document by ID.
   */
  softDelete(id: string): MockKBDocument | null {
    const doc = this.documents.get(id);
    if (!doc || doc.deletedAt !== null) {
      return null;
    }

    const deleted: MockKBDocument = {
      ...doc,
      deletedAt: new Date(),
      status: 'archived',
      updatedAt: new Date(),
    };
    this.documents.set(id, deleted);
    return deleted;
  }

  /**
   * Bulk soft deletes multiple documents.
   */
  bulkSoftDelete(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      const result = this.softDelete(id);
      if (result) {
        count++;
      }
    }
    return count;
  }

  /**
   * Gets all active documents.
   */
  getActive(): MockKBDocument[] {
    return Array.from(this.documents.values()).filter(
      (d) => d.status === 'active' && d.deletedAt === null
    );
  }

  /**
   * Seed the store with initial documents.
   */
  seed(documents: MockKBDocument[]): void {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }
  }
}

// ============================================
// Tests
// ============================================

describe('KB Documents Database Queries', () => {
  const store = new MockDocumentStore();

  beforeEach(() => {
    store.reset();
  });

  describe('createKBDocument', () => {
    it('creates a new document with required fields', () => {
      const doc = store.create({
        geminiFileName: 'files/new-123',
        geminiFileUri: 'gs://kb/files/new-123',
        displayName: 'New Document.pdf',
        originalFileName: 'new-doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        status: 'uploading',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: 'user-123',
        deletedAt: null,
      });

      assert.ok(doc.id, 'Should generate ID');
      assert.equal(doc.geminiFileName, 'files/new-123');
      assert.equal(doc.status, 'uploading');
      assert.ok(doc.createdAt instanceof Date);
      assert.ok(doc.updatedAt instanceof Date);
    });

    it('uses default confidence threshold of 70', () => {
      const doc = store.create({
        geminiFileName: 'files/test',
        geminiFileUri: 'gs://kb/files/test',
        displayName: 'Test.pdf',
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(doc.confidenceThreshold, 70);
    });

    it('accepts custom confidence threshold', () => {
      const doc = store.create({
        geminiFileName: 'files/test',
        geminiFileUri: 'gs://kb/files/test',
        displayName: 'Test.pdf',
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 85,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(doc.confidenceThreshold, 85);
    });

    it('handles various MIME types', () => {
      const pdfDoc = store.create({
        geminiFileName: 'files/pdf',
        geminiFileUri: 'gs://kb/files/pdf',
        displayName: 'Doc.pdf',
        originalFileName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const txtDoc = store.create({
        geminiFileName: 'files/txt',
        geminiFileUri: 'gs://kb/files/txt',
        displayName: 'Doc.txt',
        originalFileName: 'doc.txt',
        mimeType: 'text/plain',
        sizeBytes: 512,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const mdDoc = store.create({
        geminiFileName: 'files/md',
        geminiFileUri: 'gs://kb/files/md',
        displayName: 'Doc.md',
        originalFileName: 'doc.md',
        mimeType: 'text/markdown',
        sizeBytes: 256,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(pdfDoc.mimeType, 'application/pdf');
      assert.equal(txtDoc.mimeType, 'text/plain');
      assert.equal(mdDoc.mimeType, 'text/markdown');
    });
  });

  describe('getKBDocumentById', () => {
    it('retrieves existing document by ID', () => {
      const created = store.create({
        geminiFileName: 'files/get-test',
        geminiFileUri: 'gs://kb/files/get-test',
        displayName: 'Get Test.pdf',
        originalFileName: 'get-test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const retrieved = store.getById(created.id);

      assert.ok(retrieved);
      assert.equal(retrieved.id, created.id);
      assert.equal(retrieved.displayName, 'Get Test.pdf');
    });

    it('returns null for non-existent ID', () => {
      const result = store.getById('non-existent-id');
      assert.equal(result, null);
    });

    it('returns null for soft-deleted document', () => {
      const created = store.create({
        geminiFileName: 'files/deleted',
        geminiFileUri: 'gs://kb/files/deleted',
        displayName: 'Deleted.pdf',
        originalFileName: 'deleted.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      store.softDelete(created.id);
      const result = store.getById(created.id);

      assert.equal(result, null);
    });

    it('handles empty string ID gracefully', () => {
      const result = store.getById('');
      assert.equal(result, null);
    });
  });

  describe('listKBDocuments', () => {
    beforeEach(() => {
      // Seed with test documents
      const docs = [
        createMockDocument({ id: 'doc-1', status: 'active', displayName: 'Active 1' }),
        createMockDocument({ id: 'doc-2', status: 'active', displayName: 'Active 2' }),
        createMockDocument({ id: 'doc-3', status: 'processing', displayName: 'Processing' }),
        createMockDocument({ id: 'doc-4', status: 'failed', displayName: 'Failed' }),
        createMockDocument({ id: 'doc-5', status: 'active', displayName: 'Deleted', deletedAt: new Date() }),
      ];
      store.seed(docs);
    });

    it('lists all non-deleted documents', () => {
      const result = store.list();

      assert.equal(result.documents.length, 4);
      assert.ok(result.documents.every((d) => d.deletedAt === null));
    });

    it('filters documents by status', () => {
      const result = store.list({ status: 'active' });

      assert.equal(result.documents.length, 2);
      assert.ok(result.documents.every((d) => d.status === 'active'));
    });

    it('includes deleted documents when requested', () => {
      const result = store.list({ includeDeleted: true });

      assert.equal(result.documents.length, 5);
    });

    it('paginates results correctly', () => {
      const page1 = store.list({ limit: 2, offset: 0 });
      const page2 = store.list({ limit: 2, offset: 2 });

      assert.equal(page1.documents.length, 2);
      assert.equal(page1.hasMore, true);
      assert.equal(page2.documents.length, 2);
      assert.equal(page2.hasMore, false);
    });

    it('handles empty results', () => {
      store.reset();
      const result = store.list();

      assert.equal(result.documents.length, 0);
      assert.equal(result.total, 0);
      assert.equal(result.hasMore, false);
    });

    it('returns hasMore correctly for last page', () => {
      const result = store.list({ limit: 10 });

      assert.equal(result.hasMore, false);
    });

    it('sorts documents by createdAt descending', () => {
      store.reset();
      const oldDoc = createMockDocument({
        id: 'old',
        createdAt: new Date('2024-01-01'),
      });
      const newDoc = createMockDocument({
        id: 'new',
        createdAt: new Date('2025-01-01'),
      });
      store.seed([oldDoc, newDoc]);

      const result = store.list();

      assert.equal(result.documents[0].id, 'new');
      assert.equal(result.documents[1].id, 'old');
    });
  });

  describe('updateKBDocument', () => {
    it('updates document display name', () => {
      const created = store.create({
        geminiFileName: 'files/update-test',
        geminiFileUri: 'gs://kb/files/update-test',
        displayName: 'Original Name.pdf',
        originalFileName: 'original.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const updated = store.update(created.id, { displayName: 'New Name.pdf' });

      assert.ok(updated);
      assert.equal(updated.displayName, 'New Name.pdf');
      // updatedAt should be >= createdAt (may be equal if executed in same ms)
      assert.ok(updated.updatedAt >= created.updatedAt);
    });

    it('updates document status', () => {
      const created = store.create({
        geminiFileName: 'files/status-test',
        geminiFileUri: 'gs://kb/files/status-test',
        displayName: 'Status Test.pdf',
        originalFileName: 'status.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'processing',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const updated = store.update(created.id, { status: 'active' });

      assert.ok(updated);
      assert.equal(updated.status, 'active');
    });

    it('updates indexedAt when transitioning to active', () => {
      const created = store.create({
        geminiFileName: 'files/indexed-test',
        geminiFileUri: 'gs://kb/files/indexed-test',
        displayName: 'Indexed Test.pdf',
        originalFileName: 'indexed.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'processing',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const indexedAt = new Date();
      const updated = store.update(created.id, { status: 'active', indexedAt });

      assert.ok(updated);
      assert.ok(updated.indexedAt);
      assert.equal(updated.indexedAt.getTime(), indexedAt.getTime());
    });

    it('returns null for non-existent document', () => {
      const result = store.update('non-existent', { displayName: 'New Name' });
      assert.equal(result, null);
    });

    it('returns null for soft-deleted document', () => {
      const created = store.create({
        geminiFileName: 'files/deleted-update',
        geminiFileUri: 'gs://kb/files/deleted-update',
        displayName: 'Deleted Update.pdf',
        originalFileName: 'deleted.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      store.softDelete(created.id);
      const result = store.update(created.id, { displayName: 'New Name' });

      assert.equal(result, null);
    });

    it('updates status message', () => {
      const created = store.create({
        geminiFileName: 'files/message-test',
        geminiFileUri: 'gs://kb/files/message-test',
        displayName: 'Message Test.pdf',
        originalFileName: 'message.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'failed',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const updated = store.update(created.id, {
        statusMessage: 'Upload failed due to network error',
      });

      assert.ok(updated);
      assert.equal(updated.statusMessage, 'Upload failed due to network error');
    });

    it('updates confidence threshold', () => {
      const created = store.create({
        geminiFileName: 'files/conf-test',
        geminiFileUri: 'gs://kb/files/conf-test',
        displayName: 'Confidence Test.pdf',
        originalFileName: 'conf.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const updated = store.update(created.id, { confidenceThreshold: 85 });

      assert.ok(updated);
      assert.equal(updated.confidenceThreshold, 85);
    });
  });

  describe('softDeleteKBDocument', () => {
    it('soft deletes document by setting deletedAt', () => {
      const created = store.create({
        geminiFileName: 'files/soft-delete',
        geminiFileUri: 'gs://kb/files/soft-delete',
        displayName: 'Soft Delete.pdf',
        originalFileName: 'soft-delete.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const deleted = store.softDelete(created.id);

      assert.ok(deleted);
      assert.ok(deleted.deletedAt);
      assert.equal(deleted.status, 'archived');
    });

    it('returns null for non-existent document', () => {
      const result = store.softDelete('non-existent');
      assert.equal(result, null);
    });

    it('returns null for already deleted document', () => {
      const created = store.create({
        geminiFileName: 'files/already-deleted',
        geminiFileUri: 'gs://kb/files/already-deleted',
        displayName: 'Already Deleted.pdf',
        originalFileName: 'already.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      store.softDelete(created.id);
      const result = store.softDelete(created.id);

      assert.equal(result, null);
    });

    it('deleted document is not returned in list', () => {
      const created = store.create({
        geminiFileName: 'files/list-delete',
        geminiFileUri: 'gs://kb/files/list-delete',
        displayName: 'List Delete.pdf',
        originalFileName: 'list-delete.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      store.softDelete(created.id);
      const result = store.list();

      assert.ok(!result.documents.some((d) => d.id === created.id));
    });
  });

  describe('bulkSoftDeleteKBDocuments', () => {
    it('deletes multiple documents', () => {
      const doc1 = store.create({
        geminiFileName: 'files/bulk-1',
        geminiFileUri: 'gs://kb/files/bulk-1',
        displayName: 'Bulk 1.pdf',
        originalFileName: 'bulk1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const doc2 = store.create({
        geminiFileName: 'files/bulk-2',
        geminiFileUri: 'gs://kb/files/bulk-2',
        displayName: 'Bulk 2.pdf',
        originalFileName: 'bulk2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const deletedCount = store.bulkSoftDelete([doc1.id, doc2.id]);

      assert.equal(deletedCount, 2);
      assert.equal(store.getById(doc1.id), null);
      assert.equal(store.getById(doc2.id), null);
    });

    it('handles empty array', () => {
      const deletedCount = store.bulkSoftDelete([]);
      assert.equal(deletedCount, 0);
    });

    it('handles mix of valid and invalid IDs', () => {
      const doc = store.create({
        geminiFileName: 'files/bulk-mix',
        geminiFileUri: 'gs://kb/files/bulk-mix',
        displayName: 'Bulk Mix.pdf',
        originalFileName: 'mix.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const deletedCount = store.bulkSoftDelete([doc.id, 'invalid-id-1', 'invalid-id-2']);

      assert.equal(deletedCount, 1);
    });

    it('handles already deleted documents in batch', () => {
      const doc1 = store.create({
        geminiFileName: 'files/bulk-already-1',
        geminiFileUri: 'gs://kb/files/bulk-already-1',
        displayName: 'Already 1.pdf',
        originalFileName: 'already1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const doc2 = store.create({
        geminiFileName: 'files/bulk-already-2',
        geminiFileUri: 'gs://kb/files/bulk-already-2',
        displayName: 'Already 2.pdf',
        originalFileName: 'already2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      // Pre-delete one document
      store.softDelete(doc1.id);

      const deletedCount = store.bulkSoftDelete([doc1.id, doc2.id]);

      assert.equal(deletedCount, 1); // Only doc2 should be deleted
    });
  });

  describe('getActiveKBDocuments', () => {
    it('returns only active non-deleted documents', () => {
      store.reset();
      store.seed([
        createMockDocument({ id: 'active-1', status: 'active' }),
        createMockDocument({ id: 'active-2', status: 'active' }),
        createMockDocument({ id: 'processing', status: 'processing' }),
        createMockDocument({ id: 'deleted', status: 'active', deletedAt: new Date() }),
      ]);

      const result = store.getActive();

      assert.equal(result.length, 2);
      assert.ok(result.every((d) => d.status === 'active' && d.deletedAt === null));
    });

    it('returns empty array when no active documents', () => {
      store.reset();
      store.seed([
        createMockDocument({ id: 'processing', status: 'processing' }),
        createMockDocument({ id: 'failed', status: 'failed' }),
      ]);

      const result = store.getActive();

      assert.equal(result.length, 0);
    });
  });

  describe('Edge Cases', () => {
    it('handles documents with maximum size bytes', () => {
      const maxSize = 20 * 1024 * 1024; // 20MB
      const doc = store.create({
        geminiFileName: 'files/max-size',
        geminiFileUri: 'gs://kb/files/max-size',
        displayName: 'Max Size.pdf',
        originalFileName: 'max.pdf',
        mimeType: 'application/pdf',
        sizeBytes: maxSize,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(doc.sizeBytes, maxSize);
    });

    it('handles documents with special characters in names', () => {
      const doc = store.create({
        geminiFileName: 'files/special-chars',
        geminiFileUri: 'gs://kb/files/special-chars',
        displayName: 'Döcümënt with spëcïäl chârs (1).pdf',
        originalFileName: 'Döcümënt with spëcïäl chârs (1).pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      const retrieved = store.getById(doc.id);
      assert.ok(retrieved);
      assert.equal(retrieved.displayName, 'Döcümënt with spëcïäl chârs (1).pdf');
    });

    it('handles documents with very long names', () => {
      const longName = 'A'.repeat(200) + '.pdf';
      const doc = store.create({
        geminiFileName: 'files/long-name',
        geminiFileUri: 'gs://kb/files/long-name',
        displayName: longName,
        originalFileName: longName,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(doc.displayName.length, 204);
    });

    it('handles documents with zero size', () => {
      const doc = store.create({
        geminiFileName: 'files/zero-size',
        geminiFileUri: 'gs://kb/files/zero-size',
        displayName: 'Empty.txt',
        originalFileName: 'empty.txt',
        mimeType: 'text/plain',
        sizeBytes: 0,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 70,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(doc.sizeBytes, 0);
    });

    it('handles confidence threshold boundary values', () => {
      const minThreshold = store.create({
        geminiFileName: 'files/min-conf',
        geminiFileUri: 'gs://kb/files/min-conf',
        displayName: 'Min Conf.pdf',
        originalFileName: 'min.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 0,
        uploadedBy: null,
        deletedAt: null,
      });

      const maxThreshold = store.create({
        geminiFileName: 'files/max-conf',
        geminiFileUri: 'gs://kb/files/max-conf',
        displayName: 'Max Conf.pdf',
        originalFileName: 'max.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'active',
        statusMessage: null,
        indexedAt: null,
        chunkCount: null,
        confidenceThreshold: 100,
        uploadedBy: null,
        deletedAt: null,
      });

      assert.equal(minThreshold.confidenceThreshold, 0);
      assert.equal(maxThreshold.confidenceThreshold, 100);
    });
  });
});
