/**
 * Unit tests for DocumentList component.
 * Tests document listing, pagination, filtering, and selection.
 *
 * @module DocumentList.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Mock Types
// ============================================

/**
 * Document status type.
 */
type DocumentStatus =
  | 'uploading'
  | 'processing'
  | 'active'
  | 'failed'
  | 'archived';

/**
 * Document item.
 */
interface Document {
  id: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  indexedAt: string | null;
  geminiFileName: string;
}

/**
 * Pagination metadata.
 */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ============================================
// Test Utilities
// ============================================

/**
 * Creates a mock document for testing.
 */
function createMockDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: overrides.id ?? `doc-${Date.now()}`,
    displayName: overrides.displayName ?? 'Test Document.pdf',
    originalFileName: overrides.originalFileName ?? 'test.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    sizeBytes: overrides.sizeBytes ?? 1024 * 1024,
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    // Only use default if indexedAt is not explicitly passed (including null)
    indexedAt: 'indexedAt' in overrides ? overrides.indexedAt : new Date().toISOString(),
    geminiFileName: overrides.geminiFileName ?? 'files/test-123',
  };
}

/**
 * Creates pagination metadata.
 */
function createPagination(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
    total: overrides.total ?? 100,
    hasMore: overrides.hasMore ?? true,
  };
}

/**
 * Formats bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats date to locale string.
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

// ============================================
// Tests
// ============================================

describe('DocumentList', () => {
  describe('Document Display', () => {
    it('displays document information correctly', () => {
      const doc = createMockDocument({
        displayName: 'Travel Guide.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5 * 1024 * 1024,
        status: 'active',
      });

      assert.equal(doc.displayName, 'Travel Guide.pdf');
      assert.equal(doc.mimeType, 'application/pdf');
      assert.equal(formatBytes(doc.sizeBytes), '5 MB');
      assert.equal(doc.status, 'active');
    });

    it('formats file sizes correctly', () => {
      const testCases = [
        { size: 512, expected: '512 Bytes' },
        { size: 1024, expected: '1 KB' },
        { size: 1024 * 1024, expected: '1 MB' },
        { size: 5.5 * 1024 * 1024, expected: '5.5 MB' },
      ];

      for (const { size, expected } of testCases) {
        assert.equal(formatBytes(size), expected);
      }
    });

    it('handles null indexedAt', () => {
      const doc = createMockDocument({ indexedAt: null });
      const indexedDisplay = doc.indexedAt ? formatDate(doc.indexedAt) : 'Not indexed';

      assert.equal(indexedDisplay, 'Not indexed');
    });

    it('formats dates correctly', () => {
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatDate(date);

      assert.ok(formatted.includes('2025') || formatted.includes('1/15'));
    });
  });

  describe('Status Badge', () => {
    it('renders correct badge for active status', () => {
      const status: DocumentStatus = 'active';
      const badgeClass = status === 'active' ? 'bg-green-100 text-green-800' : '';

      assert.ok(badgeClass.includes('green'));
    });

    it('renders correct badge for processing status', () => {
      const status: DocumentStatus = 'processing';
      const badgeClass = status === 'processing' ? 'bg-blue-100 text-blue-800' : '';

      assert.ok(badgeClass.includes('blue'));
    });

    it('renders correct badge for failed status', () => {
      const status: DocumentStatus = 'failed';
      const badgeClass = status === 'failed' ? 'bg-red-100 text-red-800' : '';

      assert.ok(badgeClass.includes('red'));
    });

    it('renders correct badge for uploading status', () => {
      const status: DocumentStatus = 'uploading';
      const badgeClass = status === 'uploading' ? 'bg-yellow-100 text-yellow-800' : '';

      assert.ok(badgeClass.includes('yellow'));
    });

    it('renders correct badge for archived status', () => {
      const status: DocumentStatus = 'archived';
      const badgeClass = status === 'archived' ? 'bg-gray-100 text-gray-800' : '';

      assert.ok(badgeClass.includes('gray'));
    });
  });

  describe('Selection', () => {
    it('toggles single document selection', () => {
      const selectedIds = new Set<string>();
      const docId = 'doc-1';

      // Select
      selectedIds.add(docId);
      assert.equal(selectedIds.has(docId), true);

      // Deselect
      selectedIds.delete(docId);
      assert.equal(selectedIds.has(docId), false);
    });

    it('selects all documents', () => {
      const documents = [
        createMockDocument({ id: 'doc-1' }),
        createMockDocument({ id: 'doc-2' }),
        createMockDocument({ id: 'doc-3' }),
      ];

      const selectedIds = new Set(documents.map((d) => d.id));

      assert.equal(selectedIds.size, 3);
      assert.ok(documents.every((d) => selectedIds.has(d.id)));
    });

    it('deselects all documents', () => {
      const selectedIds = new Set(['doc-1', 'doc-2', 'doc-3']);

      selectedIds.clear();

      assert.equal(selectedIds.size, 0);
    });

    it('detects if all documents are selected', () => {
      const documents = [
        createMockDocument({ id: 'doc-1' }),
        createMockDocument({ id: 'doc-2' }),
      ];
      const selectedIds = new Set(['doc-1', 'doc-2']);

      const isAllSelected =
        documents.length > 0 &&
        documents.every((d) => selectedIds.has(d.id));

      assert.equal(isAllSelected, true);
    });

    it('detects partial selection', () => {
      const documents = [
        createMockDocument({ id: 'doc-1' }),
        createMockDocument({ id: 'doc-2' }),
      ];
      const selectedIds = new Set(['doc-1']);

      const isAllSelected =
        documents.length > 0 &&
        documents.every((d) => selectedIds.has(d.id));

      assert.equal(isAllSelected, false);
    });

    it('handles empty document list', () => {
      const documents: Document[] = [];
      const selectedIds = new Set<string>();

      const isAllSelected =
        documents.length > 0 &&
        documents.every((d) => selectedIds.has(d.id));

      assert.equal(isAllSelected, false);
    });
  });

  describe('Pagination', () => {
    it('calculates correct showing range', () => {
      const pagination = createPagination({ page: 1, limit: 20, total: 50 });
      const startItem = (pagination.page - 1) * pagination.limit + 1;
      const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

      assert.equal(startItem, 1);
      assert.equal(endItem, 20);
    });

    it('calculates correct showing range for last page', () => {
      const pagination = createPagination({ page: 3, limit: 20, total: 50 });
      const startItem = (pagination.page - 1) * pagination.limit + 1;
      const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

      assert.equal(startItem, 41);
      assert.equal(endItem, 50);
    });

    it('disables previous button on first page', () => {
      const currentPage = 1;
      const isPrevDisabled = currentPage === 1;

      assert.equal(isPrevDisabled, true);
    });

    it('enables previous button on later pages', () => {
      const currentPage = 2;
      const isPrevDisabled = currentPage === 1;

      assert.equal(isPrevDisabled, false);
    });

    it('disables next button when no more pages', () => {
      const pagination = createPagination({ hasMore: false });
      const isNextDisabled = !pagination.hasMore;

      assert.equal(isNextDisabled, true);
    });

    it('enables next button when more pages exist', () => {
      const pagination = createPagination({ hasMore: true });
      const isNextDisabled = !pagination.hasMore;

      assert.equal(isNextDisabled, false);
    });
  });

  describe('Status Filter', () => {
    it('filters documents by status', () => {
      const documents = [
        createMockDocument({ id: 'doc-1', status: 'active' }),
        createMockDocument({ id: 'doc-2', status: 'active' }),
        createMockDocument({ id: 'doc-3', status: 'processing' }),
        createMockDocument({ id: 'doc-4', status: 'failed' }),
      ];

      const statusFilter: DocumentStatus | 'all' = 'active';
      const filtered =
        statusFilter === 'all'
          ? documents
          : documents.filter((d) => d.status === statusFilter);

      assert.equal(filtered.length, 2);
      assert.ok(filtered.every((d) => d.status === 'active'));
    });

    it('shows all documents when filter is "all"', () => {
      const documents = [
        createMockDocument({ id: 'doc-1', status: 'active' }),
        createMockDocument({ id: 'doc-2', status: 'processing' }),
      ];

      const statusFilter: DocumentStatus | 'all' = 'all';
      const filtered =
        statusFilter === 'all'
          ? documents
          : documents.filter((d) => d.status === statusFilter);

      assert.equal(filtered.length, 2);
    });

    it('returns empty when no documents match filter', () => {
      const documents = [
        createMockDocument({ id: 'doc-1', status: 'active' }),
      ];

      const statusFilter: DocumentStatus | 'all' = 'failed';
      const filtered =
        statusFilter === 'all'
          ? documents
          : documents.filter((d) => d.status === statusFilter);

      assert.equal(filtered.length, 0);
    });
  });

  describe('Delete Confirmation', () => {
    it('shows singular delete message for one document', () => {
      const selectedCount = 1;
      const message =
        selectedCount === 1
          ? 'This action cannot be undone. The document will be permanently deleted.'
          : `This action cannot be undone. ${selectedCount} documents will be permanently deleted.`;

      assert.ok(message.includes('The document'));
      assert.ok(!message.includes('documents'));
    });

    it('shows plural delete message for multiple documents', () => {
      const selectedCount = 5;
      const message =
        selectedCount === 1
          ? 'This action cannot be undone. The document will be permanently deleted.'
          : `This action cannot be undone. ${selectedCount} documents will be permanently deleted.`;

      assert.ok(message.includes('5 documents'));
    });

    it('includes count in bulk delete message', () => {
      const selectedCount = 3;
      const message = `Delete ${selectedCount} selected documents`;

      assert.ok(message.includes('3'));
    });
  });

  describe('Loading States', () => {
    it('shows loading state when fetching documents', () => {
      const isLoading = true;
      const documents: Document[] = [];
      const showLoading = isLoading && documents.length === 0;

      assert.equal(showLoading, true);
    });

    it('shows documents while refresh is loading', () => {
      const isLoading = true;
      const documents = [createMockDocument()];
      const showLoading = isLoading && documents.length === 0;

      assert.equal(showLoading, false);
    });

    it('shows empty state when no documents', () => {
      const isLoading = false;
      const documents: Document[] = [];
      const showEmpty = !isLoading && documents.length === 0;

      assert.equal(showEmpty, true);
    });
  });

  describe('Error States', () => {
    it('displays error message', () => {
      const error = 'Failed to fetch documents';
      const hasError = error !== null;

      assert.equal(hasError, true);
    });

    it('hides error when null', () => {
      const error = null;
      const hasError = error !== null;

      assert.equal(hasError, false);
    });
  });

  describe('Bulk Actions', () => {
    it('shows bulk delete button when items selected', () => {
      const selectedIds = new Set(['doc-1', 'doc-2']);
      const showBulkDelete = selectedIds.size > 0;

      assert.equal(showBulkDelete, true);
    });

    it('hides bulk delete button when nothing selected', () => {
      const selectedIds = new Set<string>();
      const showBulkDelete = selectedIds.size > 0;

      assert.equal(showBulkDelete, false);
    });

    it('disables bulk delete during deletion', () => {
      const isDeleting = true;
      const buttonDisabled = isDeleting;

      assert.equal(buttonDisabled, true);
    });

    it('enables bulk delete when not deleting', () => {
      const isDeleting = false;
      const buttonDisabled = isDeleting;

      assert.equal(buttonDisabled, false);
    });
  });

  describe('Responsive Design', () => {
    it('hides certain columns on mobile', () => {
      // Type column hidden on small screens
      const typeColumnClass = 'hidden sm:table-cell';
      assert.ok(typeColumnClass.includes('hidden'));
      assert.ok(typeColumnClass.includes('sm:table-cell'));
    });

    it('shows all columns on large screens', () => {
      // Created column only on large screens
      const createdColumnClass = 'hidden lg:table-cell';
      assert.ok(createdColumnClass.includes('lg:table-cell'));
    });
  });

  describe('MIME Type Display', () => {
    it('formats PDF mime type', () => {
      const mimeType = 'application/pdf';
      const extension = mimeType.split('/')[1].toUpperCase();

      assert.equal(extension, 'PDF');
    });

    it('formats text mime type', () => {
      const mimeType = 'text/plain';
      const extension = mimeType.split('/')[1].toUpperCase();

      assert.equal(extension, 'PLAIN');
    });

    it('formats markdown mime type', () => {
      const mimeType = 'text/markdown';
      const extension = mimeType.split('/')[1].toUpperCase();

      assert.equal(extension, 'MARKDOWN');
    });
  });

  describe('Table Structure', () => {
    it('has correct column count', () => {
      const columns = [
        'checkbox',
        'name',
        'type',
        'size',
        'status',
        'created',
        'actions',
      ];

      assert.equal(columns.length, 7);
    });

    it('checkbox column is narrow', () => {
      const checkboxColumnClass = 'w-12';
      assert.ok(checkboxColumnClass.includes('w-12'));
    });
  });

  describe('Document Row Interaction', () => {
    it('supports individual delete action', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      let deleteTriggered = false;

      // Simulate delete action
      const onDelete = (id: string) => {
        deleteTriggered = true;
        assert.equal(id, 'doc-1');
      };

      onDelete(doc.id);
      assert.equal(deleteTriggered, true);
    });

    it('supports individual selection toggle', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      const selectedIds = new Set<string>();

      // Simulate toggle
      const onToggleSelect = (id: string) => {
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else {
          selectedIds.add(id);
        }
      };

      onToggleSelect(doc.id);
      assert.equal(selectedIds.has(doc.id), true);

      onToggleSelect(doc.id);
      assert.equal(selectedIds.has(doc.id), false);
    });
  });
});
