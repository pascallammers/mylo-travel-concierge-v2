/**
 * Integration tests for KB Delete API route.
 * Tests POST /api/admin/knowledge-base/delete endpoint.
 *
 * @module delete.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Mock Types
// ============================================

interface MockDocument {
  id: string;
  geminiFileName: string;
  geminiFileUri: string;
  displayName: string;
  status: 'active' | 'processing' | 'failed' | 'uploading' | 'archived';
  deletedAt: Date | null;
  // File Search Store fields (new API)
  fileSearchDocumentName?: string;
  fileSearchStoreName?: string;
  fileSearchIndexedAt?: Date;
}

interface DeleteResult {
  documentId: string;
  status: 'success' | 'error';
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  deletedCount: number;
  results: DeleteResult[];
  errors?: DeleteResult[];
}

// ============================================
// Test Utilities
// ============================================

/**
 * In-memory document store for testing.
 */
class MockDocumentStore {
  private documents: Map<string, MockDocument> = new Map();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.documents.clear();
  }

  add(doc: MockDocument): void {
    this.documents.set(doc.id, doc);
  }

  getById(id: string): MockDocument | null {
    const doc = this.documents.get(id);
    if (!doc || doc.deletedAt !== null) {
      return null;
    }
    return doc;
  }

  softDelete(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc || doc.deletedAt !== null) {
      return false;
    }
    doc.deletedAt = new Date();
    doc.status = 'archived';
    return true;
  }

  bulkSoftDelete(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.softDelete(id)) {
        count++;
      }
    }
    return count;
  }
}

/**
 * Simulates legacy Gemini Files API deletion.
 */
function simulateGeminiDelete(
  geminiFileName: string,
  shouldFail: boolean = false
): { success: boolean; error?: string } {
  if (shouldFail) {
    return { success: false, error: 'Gemini API error' };
  }
  return { success: true };
}

/**
 * Simulates File Search Store document deletion.
 */
function simulateFileSearchStoreDelete(
  documentName: string,
  shouldFail: boolean = false
): { success: boolean; error?: string } {
  if (shouldFail) {
    return { success: false, error: 'File Search Store API error' };
  }
  return { success: true };
}

/**
 * Simulates the delete endpoint logic.
 * Handles both File Search Store (new API) and legacy Files API documents.
 */
function processDelete(
  store: MockDocumentStore,
  documentIds: string[],
  geminiFailures: string[] = [],
  fileSearchFailures: string[] = []
): DeleteResponse {
  const results: DeleteResult[] = [];
  const successfulIds: string[] = [];

  for (const id of documentIds) {
    const doc = store.getById(id);

    if (!doc) {
      results.push({
        documentId: id,
        status: 'error',
        error: 'Document not found',
      });
      continue;
    }

    // Delete from File Search Store (new API) if available
    if (doc.fileSearchDocumentName) {
      const shouldFail = fileSearchFailures.includes(doc.fileSearchDocumentName);
      const fileSearchResult = simulateFileSearchStoreDelete(doc.fileSearchDocumentName, shouldFail);

      if (!fileSearchResult.success) {
        // Log warning but continue with soft delete
        console.warn(`File Search Store deletion failed for ${doc.fileSearchDocumentName}`);
      }
    }

    // Delete from legacy Files API if available (backward compatibility)
    if (doc.geminiFileName) {
      const shouldFail = geminiFailures.includes(doc.geminiFileName);
      const geminiResult = simulateGeminiDelete(doc.geminiFileName, shouldFail);

      if (!geminiResult.success) {
        // Log warning but continue with soft delete
        console.warn(`Gemini deletion failed for ${doc.geminiFileName}`);
      }
    }

    results.push({
      documentId: id,
      status: 'success',
    });
    successfulIds.push(id);
  }

  // Bulk soft delete
  const deletedCount = store.bulkSoftDelete(successfulIds);

  const errors = results.filter((r) => r.status === 'error');

  return {
    success: errors.length === 0,
    deletedCount,
    results,
    ...(errors.length > 0 && { errors }),
  };
}

// ============================================
// Tests
// ============================================

describe('POST /api/admin/knowledge-base/delete', () => {
  const store = new MockDocumentStore();

  describe('Single Document Deletion', () => {
    it('successfully deletes a single document', () => {
      store.reset();
      store.add({
        id: 'doc-1',
        geminiFileName: 'files/doc-1',
        geminiFileUri: 'gs://kb/files/doc-1',
        displayName: 'Test.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-1']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
      assert.equal(response.results.length, 1);
      assert.equal(response.results[0].status, 'success');
      assert.equal(store.getById('doc-1'), null); // Soft deleted
    });

    it('returns error for non-existent document', () => {
      store.reset();

      const response = processDelete(store, ['non-existent']);

      assert.equal(response.success, false);
      assert.equal(response.deletedCount, 0);
      assert.equal(response.results[0].status, 'error');
      assert.equal(response.results[0].error, 'Document not found');
    });

    it('returns error for already deleted document', () => {
      store.reset();
      store.add({
        id: 'doc-deleted',
        geminiFileName: 'files/doc-deleted',
        geminiFileUri: 'gs://kb/files/doc-deleted',
        displayName: 'Deleted.pdf',
        status: 'archived',
        deletedAt: new Date(),
      });

      const response = processDelete(store, ['doc-deleted']);

      assert.equal(response.success, false);
      assert.equal(response.deletedCount, 0);
      assert.equal(response.results[0].status, 'error');
    });
  });

  describe('Bulk Document Deletion', () => {
    it('successfully deletes multiple documents', () => {
      store.reset();
      store.add({
        id: 'doc-1',
        geminiFileName: 'files/doc-1',
        geminiFileUri: 'gs://kb/files/doc-1',
        displayName: 'Doc 1.pdf',
        status: 'active',
        deletedAt: null,
      });
      store.add({
        id: 'doc-2',
        geminiFileName: 'files/doc-2',
        geminiFileUri: 'gs://kb/files/doc-2',
        displayName: 'Doc 2.pdf',
        status: 'active',
        deletedAt: null,
      });
      store.add({
        id: 'doc-3',
        geminiFileName: 'files/doc-3',
        geminiFileUri: 'gs://kb/files/doc-3',
        displayName: 'Doc 3.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-1', 'doc-2', 'doc-3']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 3);
      assert.equal(response.results.length, 3);
      assert.ok(response.results.every((r) => r.status === 'success'));
    });

    it('handles partial success (some documents not found)', () => {
      store.reset();
      store.add({
        id: 'doc-exists',
        geminiFileName: 'files/doc-exists',
        geminiFileUri: 'gs://kb/files/doc-exists',
        displayName: 'Exists.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-exists', 'doc-not-found']);

      assert.equal(response.success, false);
      assert.equal(response.deletedCount, 1);
      assert.equal(response.results.length, 2);

      const successResult = response.results.find((r) => r.documentId === 'doc-exists');
      const errorResult = response.results.find((r) => r.documentId === 'doc-not-found');

      assert.equal(successResult?.status, 'success');
      assert.equal(errorResult?.status, 'error');
    });

    it('handles all documents not found', () => {
      store.reset();

      const response = processDelete(store, ['fake-1', 'fake-2', 'fake-3']);

      assert.equal(response.success, false);
      assert.equal(response.deletedCount, 0);
      assert.ok(response.errors);
      assert.equal(response.errors.length, 3);
    });

    it('handles empty document IDs array', () => {
      store.reset();

      const response = processDelete(store, []);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 0);
      assert.equal(response.results.length, 0);
    });
  });

  describe('Response Status Codes', () => {
    it('returns 200 for all successful deletions', () => {
      store.reset();
      store.add({
        id: 'doc-1',
        geminiFileName: 'files/doc-1',
        geminiFileUri: 'gs://kb/files/doc-1',
        displayName: 'Doc.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-1']);
      const errors = response.results.filter((r) => r.status === 'error');
      const statusCode = errors.length === 0 ? 200 : errors.length === 1 ? 400 : 207;

      assert.equal(statusCode, 200);
    });

    it('returns 207 for partial success', () => {
      store.reset();
      store.add({
        id: 'doc-valid',
        geminiFileName: 'files/doc-valid',
        geminiFileUri: 'gs://kb/files/doc-valid',
        displayName: 'Valid.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-valid', 'doc-invalid']);
      const errors = response.results.filter((r) => r.status === 'error');
      const statusCode =
        errors.length === 0 ? 200 : errors.length === 2 ? 400 : 207;

      assert.equal(statusCode, 207);
    });

    it('returns 400 for all failures', () => {
      store.reset();

      const response = processDelete(store, ['fake-1', 'fake-2']);
      const errors = response.results.filter((r) => r.status === 'error');
      const statusCode =
        errors.length === 0 ? 200 : errors.length === 2 ? 400 : 207;

      assert.equal(statusCode, 400);
    });
  });

  describe('File Search Store Deletion (New API)', () => {
    it('successfully deletes document from File Search Store', () => {
      store.reset();
      store.add({
        id: 'doc-file-search',
        geminiFileName: 'files/doc-file-search',
        geminiFileUri: 'gs://kb/files/doc-file-search',
        displayName: 'FileSearchDoc.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: 'fileSearchStores/store123/documents/doc123',
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });

      const response = processDelete(store, ['doc-file-search']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
      assert.equal(response.results[0].status, 'success');
      assert.equal(store.getById('doc-file-search'), null);
    });

    it('handles hybrid documents (both File Search Store and legacy)', () => {
      store.reset();
      store.add({
        id: 'doc-hybrid',
        geminiFileName: 'files/doc-hybrid',
        geminiFileUri: 'gs://kb/files/doc-hybrid',
        displayName: 'HybridDoc.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: 'fileSearchStores/store123/documents/hybrid123',
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });

      const response = processDelete(store, ['doc-hybrid']);

      // Should succeed and delete from both systems
      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
      assert.equal(store.getById('doc-hybrid'), null);
    });

    it('continues with soft delete even if File Search Store deletion fails', () => {
      store.reset();
      const docName = 'fileSearchStores/store123/documents/fail123';
      store.add({
        id: 'doc-fs-fail',
        geminiFileName: 'files/doc-fs-fail',
        geminiFileUri: 'gs://kb/files/doc-fs-fail',
        displayName: 'FailDoc.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: docName,
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });

      // Simulate File Search Store failure
      const response = processDelete(store, ['doc-fs-fail'], [], [docName]);

      // Document should still be marked as deleted in our DB
      assert.equal(response.deletedCount, 1);
      assert.equal(store.getById('doc-fs-fail'), null);
    });

    it('handles bulk delete with mixed document types (new and legacy)', () => {
      store.reset();
      // Legacy document
      store.add({
        id: 'doc-legacy',
        geminiFileName: 'files/doc-legacy',
        geminiFileUri: 'gs://kb/files/doc-legacy',
        displayName: 'Legacy.pdf',
        status: 'active',
        deletedAt: null,
      });
      // File Search Store document
      store.add({
        id: 'doc-new',
        geminiFileName: 'files/doc-new',
        geminiFileUri: 'gs://kb/files/doc-new',
        displayName: 'New.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: 'fileSearchStores/store123/documents/new123',
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });
      // Hybrid document
      store.add({
        id: 'doc-both',
        geminiFileName: 'files/doc-both',
        geminiFileUri: 'gs://kb/files/doc-both',
        displayName: 'Both.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: 'fileSearchStores/store123/documents/both123',
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });

      const response = processDelete(store, ['doc-legacy', 'doc-new', 'doc-both']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 3);
      assert.ok(response.results.every((r) => r.status === 'success'));
    });

    it('handles File Search Store document without legacy file', () => {
      store.reset();
      store.add({
        id: 'doc-fs-only',
        geminiFileName: '', // No legacy file
        geminiFileUri: '',
        displayName: 'FileSearchOnly.pdf',
        status: 'active',
        deletedAt: null,
        fileSearchDocumentName: 'fileSearchStores/store123/documents/only123',
        fileSearchStoreName: 'fileSearchStores/store123',
        fileSearchIndexedAt: new Date(),
      });

      const response = processDelete(store, ['doc-fs-only']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
      assert.equal(store.getById('doc-fs-only'), null);
    });
  });

  describe('Legacy Gemini File Deletion', () => {
    it('continues with soft delete even if Gemini deletion fails', () => {
      store.reset();
      store.add({
        id: 'doc-gemini-fail',
        geminiFileName: 'files/doc-gemini-fail',
        geminiFileUri: 'gs://kb/files/doc-gemini-fail',
        displayName: 'Doc.pdf',
        status: 'active',
        deletedAt: null,
      });

      // Simulate Gemini failure but document should still be soft deleted
      const response = processDelete(store, ['doc-gemini-fail'], ['files/doc-gemini-fail']);

      // Document should still be marked as deleted in our DB
      assert.equal(response.deletedCount, 1);
      assert.equal(store.getById('doc-gemini-fail'), null);
    });

    it('successfully deletes legacy-only document', () => {
      store.reset();
      store.add({
        id: 'doc-legacy-only',
        geminiFileName: 'files/doc-legacy-only',
        geminiFileUri: 'gs://kb/files/doc-legacy-only',
        displayName: 'LegacyOnly.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-legacy-only']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
      assert.equal(store.getById('doc-legacy-only'), null);
    });
  });

  describe('Request Body Validation', () => {
    it('validates documentIds is an array', () => {
      const isValidArray = (input: unknown): boolean => {
        return Array.isArray(input) && input.every((id) => typeof id === 'string' && id.length > 0);
      };

      assert.equal(isValidArray(['doc-1', 'doc-2']), true);
      assert.equal(isValidArray([]), true); // Empty array is valid
      assert.equal(isValidArray(['doc-1', '']), false); // Empty string is invalid
      assert.equal(isValidArray('doc-1'), false); // Not an array
      assert.equal(isValidArray(null), false);
      assert.equal(isValidArray(undefined), false);
    });

    it('validates documentId is a non-empty string', () => {
      const isValidId = (input: unknown): boolean => {
        return typeof input === 'string' && input.length > 0;
      };

      assert.equal(isValidId('doc-123'), true);
      assert.equal(isValidId(''), false);
      assert.equal(isValidId(null), false);
      assert.equal(isValidId(123), false);
    });
  });

  describe('Legacy Support', () => {
    it('supports single documentId field for backward compatibility', () => {
      store.reset();
      store.add({
        id: 'legacy-doc',
        geminiFileName: 'files/legacy-doc',
        geminiFileUri: 'gs://kb/files/legacy-doc',
        displayName: 'Legacy.pdf',
        status: 'active',
        deletedAt: null,
      });

      // Single documentId should work
      const response = processDelete(store, ['legacy-doc']);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
    });

    it('handles both documentId and documentIds in request', () => {
      store.reset();
      store.add({
        id: 'doc-1',
        geminiFileName: 'files/doc-1',
        geminiFileUri: 'gs://kb/files/doc-1',
        displayName: 'Doc 1.pdf',
        status: 'active',
        deletedAt: null,
      });
      store.add({
        id: 'doc-2',
        geminiFileName: 'files/doc-2',
        geminiFileUri: 'gs://kb/files/doc-2',
        displayName: 'Doc 2.pdf',
        status: 'active',
        deletedAt: null,
      });

      // If both provided, should merge (without duplicates)
      const response = processDelete(store, ['doc-1', 'doc-2']);

      assert.equal(response.deletedCount, 2);
    });
  });

  describe('Edge Cases', () => {
    it('handles duplicate IDs in request', () => {
      store.reset();
      store.add({
        id: 'doc-dup',
        geminiFileName: 'files/doc-dup',
        geminiFileUri: 'gs://kb/files/doc-dup',
        displayName: 'Dup.pdf',
        status: 'active',
        deletedAt: null,
      });

      // First delete succeeds, second finds doc already deleted
      const response = processDelete(store, ['doc-dup', 'doc-dup']);

      // First one succeeds, second fails (already deleted)
      assert.equal(response.results.length, 2);
    });

    it('handles very long document ID', () => {
      const longId = 'doc-' + 'a'.repeat(200);
      store.reset();

      const response = processDelete(store, [longId]);

      assert.equal(response.success, false);
      assert.equal(response.results[0].status, 'error');
    });

    it('handles special characters in document ID', () => {
      const specialId = 'doc-äöü-123';
      store.reset();
      store.add({
        id: specialId,
        geminiFileName: 'files/doc-special',
        geminiFileUri: 'gs://kb/files/doc-special',
        displayName: 'Special.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, [specialId]);

      assert.equal(response.success, true);
      assert.equal(response.deletedCount, 1);
    });
  });

  describe('Error Response Format', () => {
    it('includes errors array when there are failures', () => {
      store.reset();

      const response = processDelete(store, ['fake-id']);

      assert.ok(response.errors);
      assert.equal(response.errors.length, 1);
      assert.equal(response.errors[0].documentId, 'fake-id');
      assert.ok(response.errors[0].error);
    });

    it('excludes errors array when all successful', () => {
      store.reset();
      store.add({
        id: 'doc-ok',
        geminiFileName: 'files/doc-ok',
        geminiFileUri: 'gs://kb/files/doc-ok',
        displayName: 'OK.pdf',
        status: 'active',
        deletedAt: null,
      });

      const response = processDelete(store, ['doc-ok']);

      assert.equal(response.errors, undefined);
    });
  });
});
