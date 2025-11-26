'use client';

import { useCallback, memo, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Trash2, FileText, FileType, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge, type MigrationStatus } from './StatusBadge';
import type { Document } from '../hooks/useDocuments';

/**
 * Props for the DocumentRow component.
 */
interface DocumentRowProps {
  /** Document data to display */
  document: Document;
  /** Whether this document is selected */
  isSelected: boolean;
  /** Callback when selection changes */
  onToggleSelect: (id: string) => void;
  /** Callback when delete button is clicked */
  onDelete: (id: string) => void;
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
}

/**
 * Gets the appropriate icon for a MIME type.
 *
 * @param mimeType - The file's MIME type
 * @returns React element for the icon
 */
function getFileIcon(mimeType: string) {
  switch (mimeType) {
    case 'application/pdf':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'text/markdown':
      return <FileType className="h-4 w-4 text-purple-500" />;
    case 'text/plain':
      return <File className="h-4 w-4 text-gray-500" />;
    default:
      return <FileText className="h-4 w-4 text-blue-500" />;
  }
}

/**
 * Formats bytes to human-readable size.
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a date string to local date format.
 *
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * DocumentRow - Renders a single document row in the document list table.
 *
 * Features:
 * - Checkbox for bulk selection
 * - File icon based on MIME type
 * - Display name and size
 * - Status badge
 * - Created date
 * - Delete action button
 *
 * @param props - Component props
 * @returns Table row element
 *
 * @example
 * ```tsx
 * <DocumentRow
 *   document={doc}
 *   isSelected={selectedIds.has(doc.id)}
 *   onToggleSelect={toggleSelection}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export const DocumentRow = memo(function DocumentRow({
  document,
  isSelected,
  onToggleSelect,
  onDelete,
  isDeleting = false,
}: DocumentRowProps) {
  const handleCheckboxChange = useCallback(() => {
    onToggleSelect(document.id);
  }, [document.id, onToggleSelect]);

  const handleDelete = useCallback(() => {
    onDelete(document.id);
  }, [document.id, onDelete]);

  /**
   * Determines migration status based on File Search Store fields.
   * Document is "indexed" if it has a fileSearchDocumentName, otherwise "legacy".
   */
  const migrationStatus: MigrationStatus = useMemo(() => {
    return document.fileSearchDocumentName ? 'indexed' : 'legacy';
  }, [document.fileSearchDocumentName]);

  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'transition-colors',
        isSelected && 'bg-muted/50'
      )}
    >
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          aria-label={`Select ${document.displayName}`}
        />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          {getFileIcon(document.mimeType)}
          <span className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
            {document.displayName}
          </span>
        </div>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <span className="text-muted-foreground text-sm">
          {document.mimeType.split('/')[1]?.toUpperCase() || 'Unknown'}
        </span>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <span className="text-muted-foreground text-sm">
          {formatBytes(document.sizeBytes)}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex gap-2 items-center">
          <StatusBadge status={document.status} />
          <StatusBadge status={migrationStatus} />
        </div>
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        <span className="text-muted-foreground text-sm">
          {formatDate(document.createdAt)}
        </span>
      </TableCell>

      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Delete ${document.displayName}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
});
