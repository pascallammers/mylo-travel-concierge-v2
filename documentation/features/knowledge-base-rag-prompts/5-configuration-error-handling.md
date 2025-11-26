# Task Group 5: Configuration & Error Handling

We're continuing the Knowledge Base RAG System implementation with task group 5:

## Implement this task group and all sub-tasks:

### Task 5.1: Create KB Configuration Module

**Priority**: Medium  
**Effort**: 1-2 hours  
**Dependencies**: None

**Description**: Create a centralized configuration module for Knowledge Base settings.

**Files to Create**:
- `/lib/config/knowledge-base.ts`

**Acceptance Criteria**:
- [ ] Export `KB_CONFIG` object with all settings
- [ ] Settings from environment variables with defaults
- [ ] `maxFileSizeMB`: File size limit (default: 20)
- [ ] `confidenceThreshold`: Query confidence threshold (default: 0.70)
- [ ] `supportedMimeTypes`: Array of allowed MIME types
- [ ] `maxBulkUploadFiles`: Max files per upload (default: 10)
- [ ] `queryTimeoutMs`: Query timeout (default: 10000)
- [ ] Type-safe configuration object
- [ ] JSDoc documentation

**Example Structure**:
```typescript
export const KB_CONFIG = {
  maxFileSizeMB: parseInt(process.env.KB_MAX_FILE_SIZE_MB || '20'),
  confidenceThreshold: parseInt(process.env.KB_CONFIDENCE_THRESHOLD || '70') / 100,
  supportedMimeTypes: [
    'application/pdf',
    'text/plain',
    'text/markdown',
  ],
  maxBulkUploadFiles: 10,
  queryTimeoutMs: 10000,
};
```

---

### Task 5.2: Implement KB Error Types & Handling

**Priority**: Medium  
**Effort**: 2 hours  
**Dependencies**: None

**Description**: Create structured error types and handling utilities for consistent error reporting.

**Files to Create**:
- `/lib/errors/kb-errors.ts`

**Acceptance Criteria**:
- [ ] Export `KBErrorCode` enum with all error codes
- [ ] Export `KBError` class extending Error
- [ ] Error codes: UPLOAD_FAILED, INVALID_FILE_TYPE, FILE_TOO_LARGE, INDEXING_FAILED, QUERY_FAILED, DELETE_FAILED, GEMINI_API_ERROR, RATE_LIMITED
- [ ] Include error details for debugging
- [ ] Utility functions for error handling
- [ ] User-friendly error message mapping
- [ ] JSDoc documentation

**Example Structure**:
```typescript
export enum KBErrorCode {
  UPLOAD_FAILED = 'KB_UPLOAD_FAILED',
  INVALID_FILE_TYPE = 'KB_INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'KB_FILE_TOO_LARGE',
  INDEXING_FAILED = 'KB_INDEXING_FAILED',
  QUERY_FAILED = 'KB_QUERY_FAILED',
  DELETE_FAILED = 'KB_DELETE_FAILED',
  GEMINI_API_ERROR = 'KB_GEMINI_API_ERROR',
  RATE_LIMITED = 'KB_RATE_LIMITED',
}

export class KBError extends Error {
  constructor(
    public code: KBErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'KBError';
  }
}
```

---

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec (Section 8, 9)
- `@lib/config/` - Existing config patterns (if any)
- `@lib/errors/` - Existing error patterns (if any)

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/global/error-handling.md` - Error handling standards
- `@droidz/standards/global/validation.md` - Validation standards
