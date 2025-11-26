'use client';

import { useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { DocumentUploader } from './components/DocumentUploader';
import { DocumentList } from './components/DocumentList';
import { useDocuments } from './hooks/useDocuments';

/**
 * KnowledgeBasePage - Admin page for managing Knowledge Base documents.
 *
 * Features:
 * - Drag-and-drop file upload with bulk support
 * - Document list with pagination and filtering
 * - Bulk selection and delete operations
 * - Status indicators for each document
 *
 * @returns Knowledge Base admin page
 */
export default function KnowledgeBasePage() {
  const {
    documents,
    pagination,
    loadingState,
    error,
    selectedIds,
    statusFilter,
    isAllSelected,
    isDeleting,
    currentPage,
    refresh,
    setStatusFilter,
    toggleSelection,
    selectAll,
    deselectAll,
    deleteSelected,
    deleteDocument,
    goToPage,
  } = useDocuments(20);

  /**
   * Handles upload completion - refreshes the document list.
   */
  const handleUploadComplete = useCallback(() => {
    toast.success('Files uploaded successfully');
    refresh();
  }, [refresh]);

  /**
   * Handles document deletion with toast notifications.
   */
  const handleDeleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteDocument(id);
      if (success) {
        toast.success('Document deleted successfully');
      } else {
        toast.error('Failed to delete document');
      }
      return success;
    },
    [deleteDocument]
  );

  /**
   * Handles bulk delete with toast notifications.
   */
  const handleDeleteSelected = useCallback(async (): Promise<boolean> => {
    const count = selectedIds.size;
    const success = await deleteSelected();
    if (success) {
      toast.success(`${count} document${count !== 1 ? 's' : ''} deleted successfully`);
    } else {
      toast.error('Failed to delete some documents');
    }
    return success;
  }, [deleteSelected, selectedIds.size]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Manage documents for the AI Knowledge Base. Upload PDFs, text, or
          markdown files to enable intelligent responses.
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload PDF, Text, or Markdown files to be indexed by the AI.
            Supports bulk upload of up to 10 files at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploader onUploadComplete={handleUploadComplete} />
        </CardContent>
      </Card>

      {/* Document List Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Documents{' '}
            {pagination && (
              <span className="text-muted-foreground font-normal text-lg">
                ({pagination.total})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            List of documents in the Knowledge Base. Select documents for bulk
            actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentList
            documents={documents}
            pagination={pagination}
            isLoading={loadingState === 'loading'}
            error={error}
            selectedIds={selectedIds}
            statusFilter={statusFilter}
            isAllSelected={isAllSelected}
            isDeleting={isDeleting}
            currentPage={currentPage}
            onRefresh={refresh}
            onStatusFilterChange={setStatusFilter}
            onToggleSelect={toggleSelection}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onDeleteSelected={handleDeleteSelected}
            onDeleteDocument={handleDeleteDocument}
            onPageChange={goToPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
