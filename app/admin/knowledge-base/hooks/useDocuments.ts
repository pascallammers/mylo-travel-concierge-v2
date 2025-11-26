'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Document status type matching backend schema.
 */
export type DocumentStatus =
  | 'uploading'
  | 'processing'
  | 'active'
  | 'failed'
  | 'archived';

/**
 * Document item from the API.
 */
export interface Document {
  id: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  indexedAt: string | null;
  geminiFileName: string;
  // File Search Store fields (new Gemini API)
  fileSearchStoreName?: string | null;
  fileSearchDocumentName?: string | null;
  fileSearchIndexedAt?: string | null;
}

/**
 * Pagination metadata from the API.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * List API response structure.
 */
interface ListResponse {
  documents: Document[];
  pagination: PaginationMeta;
}

/**
 * Delete API response structure.
 */
interface DeleteResponse {
  success: boolean;
  deletedCount: number;
  results: Array<{
    documentId: string;
    status: 'success' | 'error';
    error?: string;
  }>;
  errors?: Array<{
    documentId: string;
    status: 'error';
    error: string;
  }>;
}

/**
 * Loading state type.
 */
export type LoadingState = 'idle' | 'loading' | 'error';

/**
 * Return type for the useDocuments hook.
 */
interface UseDocumentsReturn {
  /** List of documents */
  documents: Document[];
  /** Pagination metadata */
  pagination: PaginationMeta | null;
  /** Loading state */
  loadingState: LoadingState;
  /** Error message if any */
  error: string | null;
  /** Currently selected document IDs */
  selectedIds: Set<string>;
  /** Fetch documents from API */
  fetchDocuments: () => Promise<void>;
  /** Refresh documents (alias for fetchDocuments) */
  refresh: () => Promise<void>;
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Set items per page */
  setLimit: (limit: number) => void;
  /** Filter by status */
  setStatusFilter: (status: DocumentStatus | 'all') => void;
  /** Current status filter */
  statusFilter: DocumentStatus | 'all';
  /** Toggle selection of a single document */
  toggleSelection: (id: string) => void;
  /** Select all documents on current page */
  selectAll: () => void;
  /** Deselect all documents */
  deselectAll: () => void;
  /** Check if all documents on page are selected */
  isAllSelected: boolean;
  /** Delete selected documents */
  deleteSelected: () => Promise<boolean>;
  /** Delete a single document */
  deleteDocument: (id: string) => Promise<boolean>;
  /** Is currently deleting */
  isDeleting: boolean;
  /** Current page */
  currentPage: number;
  /** Items per page limit */
  currentLimit: number;
}

/**
 * useDocuments - Custom hook for fetching and managing Knowledge Base documents.
 *
 * Features:
 * - Fetches documents from GET /api/admin/knowledge-base/list
 * - Manages pagination state (page, limit)
 * - Supports status filtering
 * - Handles selection state for bulk operations
 * - Bulk delete via POST /api/admin/knowledge-base/delete
 *
 * @param initialLimit - Initial items per page (default: 20)
 * @returns Document state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   documents,
 *   pagination,
 *   loadingState,
 *   selectedIds,
 *   toggleSelection,
 *   deleteSelected,
 *   refresh
 * } = useDocuments();
 * ```
 */
export function useDocuments(initialLimit = 20): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLimit, setCurrentLimit] = useState(initialLimit);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>(
    'all'
  );

  /**
   * Fetches documents from the API.
   */
  const fetchDocuments = useCallback(async (): Promise<void> => {
    setLoadingState('loading');
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: currentLimit.toString(),
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(
        `/api/admin/knowledge-base/list?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch documents (${response.status})`
        );
      }

      const data: ListResponse = await response.json();
      setDocuments(data.documents);
      setPagination(data.pagination);
      setLoadingState('idle');
    } catch (err) {
      console.error('[useDocuments] Fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch documents'
      );
      setLoadingState('error');
    }
  }, [currentPage, currentLimit, statusFilter]);

  /**
   * Navigate to a specific page.
   */
  const goToPage = useCallback((page: number): void => {
    setCurrentPage(page);
    setSelectedIds(new Set()); // Clear selection on page change
  }, []);

  /**
   * Set items per page limit.
   */
  const setLimit = useCallback((limit: number): void => {
    setCurrentLimit(limit);
    setCurrentPage(1); // Reset to first page
    setSelectedIds(new Set());
  }, []);

  /**
   * Set status filter and reset pagination.
   */
  const handleStatusFilter = useCallback(
    (status: DocumentStatus | 'all'): void => {
      setStatusFilter(status);
      setCurrentPage(1);
      setSelectedIds(new Set());
    },
    []
  );

  /**
   * Toggle selection of a single document.
   */
  const toggleSelection = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all documents on current page.
   */
  const selectAll = useCallback((): void => {
    setSelectedIds(new Set(documents.map((doc) => doc.id)));
  }, [documents]);

  /**
   * Deselect all documents.
   */
  const deselectAll = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if all documents on page are selected.
   */
  const isAllSelected =
    documents.length > 0 &&
    documents.every((doc) => selectedIds.has(doc.id));

  /**
   * Delete a single document by ID.
   */
  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      setIsDeleting(true);

      try {
        const response = await fetch('/api/admin/knowledge-base/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentIds: [id] }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to delete document'
          );
        }

        const data: DeleteResponse = await response.json();
        if (data.success) {
          // Remove from selection if present
          setSelectedIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          // Refresh the list
          await fetchDocuments();
          return true;
        }

        return false;
      } catch (err) {
        console.error('[useDocuments] Delete error:', err);
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [fetchDocuments]
  );

  /**
   * Delete all selected documents.
   */
  const deleteSelected = useCallback(async (): Promise<boolean> => {
    if (selectedIds.size === 0) return false;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/admin/knowledge-base/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 'Failed to delete documents'
        );
      }

      const data: DeleteResponse = await response.json();

      // Clear selection for successfully deleted items
      const successfulIds = data.results
        .filter((r) => r.status === 'success')
        .map((r) => r.documentId);

      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        for (const id of successfulIds) {
          newSet.delete(id);
        }
        return newSet;
      });

      // Refresh the list
      await fetchDocuments();

      return data.success;
    } catch (err) {
      console.error('[useDocuments] Bulk delete error:', err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, fetchDocuments]);

  // Fetch documents on mount and when filters change
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    pagination,
    loadingState,
    error,
    selectedIds,
    fetchDocuments,
    refresh: fetchDocuments,
    goToPage,
    setLimit,
    setStatusFilter: handleStatusFilter,
    statusFilter,
    toggleSelection,
    selectAll,
    deselectAll,
    isAllSelected,
    deleteSelected,
    deleteDocument,
    isDeleting,
    currentPage,
    currentLimit,
  };
}
