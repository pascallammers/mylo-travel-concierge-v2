/**
 * Knowledge Base Admin Hooks
 *
 * Custom hooks for managing Knowledge Base documents.
 */

export { useUpload } from './useUpload';
export type {
  FileUploadState,
  FileStatus,
  UploadState,
} from './useUpload';

export { useDocuments } from './useDocuments';
export type {
  Document,
  DocumentStatus,
  PaginationMeta,
  LoadingState,
} from './useDocuments';
