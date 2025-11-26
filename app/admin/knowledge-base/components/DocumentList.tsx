'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentRow } from './DocumentRow';
import type { Document, DocumentStatus, PaginationMeta } from '../hooks/useDocuments';

/**
 * Props for the DocumentList component.
 */
interface DocumentListProps {
  /** List of documents to display */
  documents: Document[];
  /** Pagination metadata */
  pagination: PaginationMeta | null;
  /** Whether documents are loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Set of selected document IDs */
  selectedIds: Set<string>;
  /** Current status filter */
  statusFilter: DocumentStatus | 'all';
  /** Whether all documents on page are selected */
  isAllSelected: boolean;
  /** Whether delete operation is in progress */
  isDeleting: boolean;
  /** Current page number */
  currentPage: number;
  /** Callback to refresh the document list */
  onRefresh: () => void;
  /** Callback when status filter changes */
  onStatusFilterChange: (status: DocumentStatus | 'all') => void;
  /** Callback to toggle selection of a document */
  onToggleSelect: (id: string) => void;
  /** Callback to select all documents */
  onSelectAll: () => void;
  /** Callback to deselect all documents */
  onDeselectAll: () => void;
  /** Callback to delete selected documents */
  onDeleteSelected: () => Promise<boolean>;
  /** Callback to delete a single document */
  onDeleteDocument: (id: string) => Promise<boolean>;
  /** Callback to go to a specific page */
  onPageChange: (page: number) => void;
}

/**
 * DocumentList - Displays uploaded documents in a table with pagination.
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - "Select all" checkbox
 * - Pagination controls
 * - Status filter dropdown
 * - Refresh button
 * - Bulk delete button with confirmation
 * - Loading and empty states
 *
 * @param props - Component props
 * @returns Document list table element
 *
 * @example
 * ```tsx
 * <DocumentList
 *   documents={documents}
 *   pagination={pagination}
 *   isLoading={loadingState === 'loading'}
 *   selectedIds={selectedIds}
 *   onRefresh={refresh}
 *   onDeleteSelected={deleteSelected}
 *   // ... other props
 * />
 * ```
 */
export function DocumentList({
  documents,
  pagination,
  isLoading,
  error,
  selectedIds,
  statusFilter,
  isAllSelected,
  isDeleting,
  currentPage,
  onRefresh,
  onStatusFilterChange,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onDeleteDocument,
  onPageChange,
}: DocumentListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  /**
   * Handles the select all checkbox change.
   */
  const handleSelectAllChange = useCallback(() => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [isAllSelected, onSelectAll, onDeselectAll]);

  /**
   * Opens delete confirmation dialog for selected items.
   */
  const handleBulkDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
    setSingleDeleteId(null);
  }, []);

  /**
   * Opens delete confirmation dialog for a single item.
   */
  const handleSingleDeleteClick = useCallback((id: string) => {
    setDeleteDialogOpen(true);
    setSingleDeleteId(id);
  }, []);

  /**
   * Confirms and executes the delete operation.
   */
  const handleConfirmDelete = useCallback(async () => {
    if (singleDeleteId) {
      await onDeleteDocument(singleDeleteId);
    } else {
      await onDeleteSelected();
    }
    setDeleteDialogOpen(false);
    setSingleDeleteId(null);
  }, [singleDeleteId, onDeleteDocument, onDeleteSelected]);

  /**
   * Navigates to the previous page.
   */
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  /**
   * Navigates to the next page.
   */
  const handleNextPage = useCallback(() => {
    if (pagination?.hasMore) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, pagination?.hasMore, onPageChange]);

  // Calculate delete message
  const deleteCount = singleDeleteId ? 1 : selectedIds.size;
  const deleteMessage = deleteCount === 1
    ? 'This action cannot be undone. The document will be permanently deleted from the Knowledge Base.'
    : `This action cannot be undone. ${deleteCount} documents will be permanently deleted from the Knowledge Base.`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as DocumentStatus | 'all')
            }
          >
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="uploading">Uploading</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh document list"
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteClick}
              disabled={isDeleting}
              aria-label={`Delete ${selectedIds.size} selected documents`}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected && documents.length > 0}
                  onCheckedChange={handleSelectAllChange}
                  aria-label="Select all documents"
                  disabled={documents.length === 0}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && documents.length === 0 ? (
              // Loading State
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading documents...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8" />
                    <p className="font-medium">No documents found</p>
                    <p className="text-sm">
                      Upload some documents to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Document Rows
              documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  isSelected={selectedIds.has(doc.id)}
                  onToggleSelect={onToggleSelect}
                  onDelete={handleSingleDeleteClick}
                  isDeleting={isDeleting}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pagination.limit + 1} to{' '}
            {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
            {pagination.total} documents
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!pagination.hasMore}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteCount === 1 ? 'Document' : `${deleteCount} Documents`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
