'use client';

import { useCallback, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useUpload, type FileStatus, type FileUploadState } from '../hooks/useUpload';

/**
 * Default configuration values.
 */
const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const DEFAULT_ACCEPTED_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];

/**
 * File extensions that correspond to accepted MIME types.
 */
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md';

/**
 * Props for the DocumentUploader component.
 */
export interface DocumentUploaderProps {
  /** Callback when upload completes successfully */
  onUploadComplete: () => void;
  /** Maximum number of files per upload (default: 10) */
  maxFiles?: number;
  /** Maximum file size in bytes (default: 20MB) */
  maxSizeBytes?: number;
  /** Accepted MIME types (default: PDF, TXT, MD) */
  acceptedTypes?: string[];
}

/**
 * Validation error for a file.
 */
interface ValidationError {
  file: File;
  error: string;
}

/**
 * Gets the status icon for a file upload state.
 */
function getStatusIcon(state: FileUploadState) {
  switch (state) {
    case 'pending':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'uploading':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

/**
 * Formats bytes to human-readable size.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * DocumentUploader - Handles single and bulk file uploads with drag-and-drop.
 *
 * Features:
 * - Drag-and-drop zone for file uploads
 * - Click-to-browse file selection
 * - Multiple file selection support
 * - File type validation (PDF, MD, TXT)
 * - File size validation with clear error messages
 * - Upload progress indicator per file
 * - Success/error status per file
 * - Callback onUploadComplete for parent notification
 *
 * @param props - Component props
 * @returns File uploader element
 *
 * @example
 * ```tsx
 * <DocumentUploader
 *   onUploadComplete={handleRefresh}
 *   maxFiles={10}
 *   maxSizeBytes={20 * 1024 * 1024}
 * />
 * ```
 */
export function DocumentUploader({
  onUploadComplete,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: DocumentUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    state,
    fileStatuses,
    uploadFiles,
    clear,
    removeFile,
    isUploading,
    overallProgress,
  } = useUpload();

  /**
   * Validates a single file.
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        return `Invalid file type. Accepted: PDF, TXT, MD`;
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        return `File too large. Max size: ${formatBytes(maxSizeBytes)}`;
      }

      return null;
    },
    [acceptedTypes, maxSizeBytes]
  );

  /**
   * Processes and validates selected files.
   */
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const errors: ValidationError[] = [];

      // Check max files limit
      if (fileArray.length > maxFiles) {
        errors.push({
          file: fileArray[0],
          error: `Too many files. Maximum ${maxFiles} files allowed per upload.`,
        });
        setValidationErrors(errors);
        return;
      }

      // Validate each file
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          errors.push({ file, error });
        } else {
          validFiles.push(file);
        }
      }

      setValidationErrors(errors);
      setStagedFiles(validFiles);
    },
    [maxFiles, validateFile]
  );

  /**
   * Handles drag over event.
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handles drag leave event.
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Handles file drop.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [isUploading, processFiles]
  );

  /**
   * Handles file input change.
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [processFiles]
  );

  /**
   * Opens file browser.
   */
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Removes a staged file.
   */
  const handleRemoveStagedFile = useCallback((index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Clears a validation error.
   */
  const handleClearError = useCallback((index: number) => {
    setValidationErrors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Starts the upload process.
   */
  const handleUpload = useCallback(async () => {
    if (stagedFiles.length === 0) return;

    await uploadFiles(stagedFiles);
    setStagedFiles([]);

    // Notify parent on success
    if (state === 'success' || state === 'partial') {
      onUploadComplete();
    }
  }, [stagedFiles, uploadFiles, state, onUploadComplete]);

  /**
   * Handles completion after uploads finish.
   */
  const handleDone = useCallback(() => {
    clear();
    setValidationErrors([]);
    onUploadComplete();
  }, [clear, onUploadComplete]);

  // Determine if we should show the upload zone or the file list
  const showUploadZone = state === 'idle' && fileStatuses.size === 0;
  const hasUploadedFiles = fileStatuses.size > 0;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Drop zone */}
      {showUploadZone && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBrowseClick();
            }
          }}
          aria-label="Upload documents. Click or drag and drop files here."
          className={cn(
            'relative flex flex-col items-center justify-center',
            'w-full min-h-[200px] rounded-lg border-2 border-dashed',
            'cursor-pointer transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <Upload
            className={cn(
              'h-10 w-10 mb-4',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className="text-lg font-medium">
            {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            PDF, TXT, MD • Max {formatBytes(maxSizeBytes)} per file •{' '}
            Up to {maxFiles} files
          </p>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-2">
          {validationErrors.map((err, index) => (
            <div
              key={`${err.file.name}-${index}`}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              role="alert"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{err.file.name}</span>
                <span className="text-destructive/80">{err.error}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => handleClearError(index)}
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Staged files (before upload) */}
      {stagedFiles.length > 0 && !hasUploadedFiles && (
        <div className="space-y-4">
          <div className="space-y-2">
            {stagedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleRemoveStagedFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setStagedFiles([])}
              disabled={isUploading}
            >
              Clear All
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || stagedFiles.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {stagedFiles.length} file
                  {stagedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Upload progress and results */}
      {hasUploadedFiles && (
        <div className="space-y-4">
          {/* Overall progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading files...</span>
                <span className="font-medium">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          {/* File statuses */}
          <div className="space-y-2">
            {Array.from(fileStatuses.values()).map((status) => (
              <div
                key={`${status.file.name}-${status.file.lastModified}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-3 rounded-lg',
                  status.state === 'success' && 'bg-green-50 dark:bg-green-950/30',
                  status.state === 'error' && 'bg-red-50 dark:bg-red-950/30',
                  status.state === 'uploading' && 'bg-blue-50 dark:bg-blue-950/30',
                  status.state === 'pending' && 'bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(status.state)}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{status.file.name}</p>
                    {status.error ? (
                      <p className="text-xs text-destructive">{status.error}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(status.file.size)}
                      </p>
                    )}
                  </div>
                </div>
                {status.state !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeFile(status.file.name)}
                    aria-label={`Remove ${status.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {!isUploading && (
            <div className="flex items-center justify-between gap-4">
              <Button variant="outline" onClick={handleBrowseClick}>
                Upload More
              </Button>
              <Button onClick={handleDone}>Done</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
