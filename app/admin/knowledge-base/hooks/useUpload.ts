'use client';

import { useState, useCallback } from 'react';

/**
 * File upload states.
 */
export type FileUploadState = 'pending' | 'uploading' | 'success' | 'error';

/**
 * Individual file status during upload.
 */
export interface FileStatus {
  file: File;
  state: FileUploadState;
  progress: number;
  error?: string;
  documentId?: string;
}

/**
 * Overall upload state.
 */
export type UploadState = 'idle' | 'uploading' | 'success' | 'error' | 'partial';

/**
 * Upload API response for a single file.
 */
interface FileUploadResult {
  fileName: string;
  status: 'success' | 'error';
  documentId?: string;
  error?: string;
}

/**
 * Upload API response structure.
 */
interface UploadResponse {
  success: boolean;
  results: FileUploadResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Return type for the useUpload hook.
 */
interface UseUploadReturn {
  /** Current upload state */
  state: UploadState;
  /** Status of each file */
  fileStatuses: Map<string, FileStatus>;
  /** Upload files to the API */
  uploadFiles: (files: File[]) => Promise<void>;
  /** Reset upload state */
  reset: () => void;
  /** Clear all file statuses */
  clear: () => void;
  /** Remove a specific file from the queue */
  removeFile: (fileName: string) => void;
  /** Check if currently uploading */
  isUploading: boolean;
  /** Overall progress (0-100) */
  overallProgress: number;
}

/**
 * useUpload - Custom hook for managing file uploads to the Knowledge Base.
 *
 * Features:
 * - Tracks per-file upload status and progress
 * - Handles FormData construction for bulk uploads
 * - Calls POST /api/admin/knowledge-base/upload
 * - Provides reset/clear functionality
 *
 * @returns Upload state and control functions
 *
 * @example
 * ```tsx
 * const { uploadFiles, state, fileStatuses, reset } = useUpload();
 *
 * const handleUpload = async (files: File[]) => {
 *   await uploadFiles(files);
 *   if (state === 'success') {
 *     onUploadComplete();
 *   }
 * };
 * ```
 */
export function useUpload(): UseUploadReturn {
  const [state, setState] = useState<UploadState>('idle');
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileStatus>>(
    new Map()
  );

  /**
   * Generates a unique key for a file based on name and size.
   */
  const getFileKey = useCallback((file: File): string => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }, []);

  /**
   * Uploads files to the Knowledge Base API.
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;

      // Initialize file statuses
      const newStatuses = new Map<string, FileStatus>();
      for (const file of files) {
        const key = getFileKey(file);
        newStatuses.set(key, {
          file,
          state: 'pending',
          progress: 0,
        });
      }
      setFileStatuses(newStatuses);
      setState('uploading');

      // Update all files to uploading state
      for (const file of files) {
        const key = getFileKey(file);
        newStatuses.set(key, {
          file,
          state: 'uploading',
          progress: 10, // Start at 10%
        });
      }
      setFileStatuses(new Map(newStatuses));

      // Build FormData
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      try {
        // Update progress to 50% (uploading)
        for (const file of files) {
          const key = getFileKey(file);
          const current = newStatuses.get(key);
          if (current) {
            newStatuses.set(key, { ...current, progress: 50 });
          }
        }
        setFileStatuses(new Map(newStatuses));

        const response = await fetch('/api/admin/knowledge-base/upload', {
          method: 'POST',
          body: formData,
        });

        const data: UploadResponse = await response.json();

        // Update file statuses based on results
        for (const result of data.results) {
          const matchingFile = files.find((f) => f.name === result.fileName);
          if (matchingFile) {
            const key = getFileKey(matchingFile);
            newStatuses.set(key, {
              file: matchingFile,
              state: result.status === 'success' ? 'success' : 'error',
              progress: 100,
              documentId: result.documentId,
              error: result.error,
            });
          }
        }
        setFileStatuses(new Map(newStatuses));

        // Determine overall state
        const { successful, failed, total } = data.summary;
        if (failed === 0) {
          setState('success');
        } else if (successful === 0) {
          setState('error');
        } else {
          setState('partial');
        }
      } catch (error) {
        // Mark all files as error
        for (const file of files) {
          const key = getFileKey(file);
          const current = newStatuses.get(key);
          if (current && current.state !== 'success') {
            newStatuses.set(key, {
              ...current,
              state: 'error',
              progress: 100,
              error:
                error instanceof Error
                  ? error.message
                  : 'Upload failed. Please try again.',
            });
          }
        }
        setFileStatuses(new Map(newStatuses));
        setState('error');
      }
    },
    [getFileKey]
  );

  /**
   * Resets upload state to idle while keeping file statuses.
   */
  const reset = useCallback((): void => {
    setState('idle');
  }, []);

  /**
   * Clears all file statuses and resets state.
   */
  const clear = useCallback((): void => {
    setState('idle');
    setFileStatuses(new Map());
  }, []);

  /**
   * Removes a specific file from the status map.
   */
  const removeFile = useCallback(
    (fileName: string): void => {
      const newStatuses = new Map(fileStatuses);
      // Find the key by file name
      for (const [key, status] of newStatuses) {
        if (status.file.name === fileName) {
          newStatuses.delete(key);
          break;
        }
      }
      setFileStatuses(newStatuses);

      // Reset state if no files remain
      if (newStatuses.size === 0) {
        setState('idle');
      }
    },
    [fileStatuses]
  );

  /**
   * Calculates overall progress across all files.
   */
  const overallProgress =
    fileStatuses.size === 0
      ? 0
      : Math.round(
          Array.from(fileStatuses.values()).reduce(
            (sum, status) => sum + status.progress,
            0
          ) / fileStatuses.size
        );

  return {
    state,
    fileStatuses,
    uploadFiles,
    reset,
    clear,
    removeFile,
    isUploading: state === 'uploading',
    overallProgress,
  };
}
