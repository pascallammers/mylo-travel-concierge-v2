# Knowledge Base RAG System - Task Breakdown

> **Spec Reference**: `/documentation/features/knowledge-base-rag.md`  
> **Created**: 2025-11-25  
> **Total Estimated Effort**: 45-55 hours

---

## Executive Summary

This task breakdown covers the implementation of a complete Knowledge Base RAG system. The project already has a **partially implemented** foundation that needs enhancement rather than building from scratch.

### Current State Analysis

| Component | Status | Gap Analysis |
|-----------|--------|--------------|
| Admin UI | ✅ Basic | Needs bulk upload, drag-drop, bulk delete |
| Gemini File Manager | ✅ Basic | Uses older Files API, needs optional FileSearchStore upgrade |
| KB Tool | ✅ Basic | Needs intent detection, confidence thresholds |
| KB Query Function | ✅ Basic | Needs confidence scoring, enhanced logic |
| API Routes | ✅ Basic | Needs bulk operations, pagination, DB integration |
| Database Schema | ❌ Missing | `kb_documents` table doesn't exist |
| Intent Detection | ❌ Missing | Not implemented |
| Confidence Threshold | ❌ Missing | Not implemented |

---

## Task Group 1: Foundation & Database

**Priority**: 🔴 Critical (Blocking)  
**Estimated Effort**: 6-8 hours  
**Dependencies**: None

This group establishes the database foundation required by all other components.

---

### Task 1.1: Create `kb_documents` Database Schema

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: None

**Description**: Add the `kb_documents` table to the Drizzle ORM schema to track document metadata. This table stores references to Gemini-hosted files along with display metadata and status tracking.

**Files to Modify**:
- `/lib/db/schema.ts` - Add kbDocuments table definition

**Acceptance Criteria**:
- [ ] `kbDocuments` table added to schema with all fields from spec
- [ ] Fields include: id, geminiFileName, geminiFileUri, displayName, originalFileName, mimeType, sizeBytes
- [ ] Status enum: 'uploading', 'processing', 'active', 'failed', 'archived'
- [ ] Audit fields: uploadedBy (FK to user), createdAt, updatedAt, deletedAt (soft delete)
- [ ] Optional fields: confidenceThreshold, indexedAt, chunkCount, statusMessage
- [ ] TypeScript type `KBDocument` exported
- [ ] Schema follows existing patterns in schema.ts

**Technical Notes**:
```typescript
// Key structure from spec
export const kbDocuments = pgTable('kb_documents', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  geminiFileName: text('gemini_file_name').notNull(),
  geminiFileUri: text('gemini_file_uri').notNull(),
  displayName: text('display_name').notNull(),
  // ... (see spec section 3.1)
});
```

---

### Task 1.2: Create Database Migration

**Priority**: High  
**Effort**: 1 hour  
**Dependencies**: Task 1.1

**Description**: Generate and validate the Drizzle migration for the new `kb_documents` table.

**Files to Create**:
- `/drizzle/migrations/XXXX_kb_documents.sql` - Migration file

**Acceptance Criteria**:
- [ ] Migration generated via `pnpm drizzle-kit generate`
- [ ] Migration includes table creation with all columns
- [ ] Indexes created: `idx_kb_documents_status`, `idx_kb_documents_gemini_name`
- [ ] Foreign key to `user` table for `uploaded_by` column
- [ ] Migration tested locally with `pnpm drizzle-kit push`
- [ ] Rollback strategy documented

---

### Task 1.3: Implement Database Query Functions

**Priority**: High  
**Effort**: 3-4 hours  
**Dependencies**: Task 1.2

**Description**: Create database query functions for CRUD operations on kb_documents. Follow the existing patterns in `/lib/db/queries.ts`.

**Files to Create/Modify**:
- `/lib/db/queries/kb-documents.ts` - New file for KB document queries

**Acceptance Criteria**:
- [ ] `createKBDocument(data)` - Insert new document record
- [ ] `getKBDocumentById(id)` - Fetch single document
- [ ] `getKBDocumentByGeminiName(geminiFileName)` - Fetch by Gemini reference
- [ ] `listKBDocuments(options)` - List with pagination, filtering by status
- [ ] `updateKBDocument(id, data)` - Update document metadata
- [ ] `updateKBDocumentStatus(id, status, message?)` - Update status specifically
- [ ] `softDeleteKBDocument(id)` - Set deletedAt timestamp
- [ ] `bulkSoftDeleteKBDocuments(ids)` - Bulk soft delete
- [ ] `getActiveKBDocuments()` - Get all active documents for querying
- [ ] All functions have proper JSDoc documentation
- [ ] File stays under 600 lines per AGENTS.md

---

## Task Group 2: Backend API Enhancement

**Priority**: 🔴 Critical  
**Estimated Effort**: 10-12 hours  
**Dependencies**: Task Group 1

This group enhances existing API routes and adds new endpoints for bulk operations and querying.

---

### Task 2.1: Enhance Upload API for Bulk Operations

**Priority**: High  
**Effort**: 4 hours  
**Dependencies**: Task 1.3

**Description**: Enhance the existing upload endpoint to support multiple file uploads in a single request and persist metadata to the database.

**Files to Modify**:
- `/app/api/admin/knowledge-base/upload/route.ts`

**Acceptance Criteria**:
- [ ] Accept multiple files via `files` field in FormData
- [ ] Validate file types (PDF, MD, TXT only)
- [ ] Validate file size (configurable max, default 20MB)
- [ ] Upload each file to Gemini File Manager
- [ ] Create `kb_documents` record for each successful upload
- [ ] Return structured response with per-file status
- [ ] Handle partial failures gracefully (some files succeed, some fail)
- [ ] Proper error messages for validation failures
- [ ] Transaction-safe database operations

**Response Format**:
```typescript
interface UploadResponse {
  success: boolean;
  results: Array<{
    fileName: string;
    status: 'success' | 'error';
    documentId?: string;
    error?: string;
  }>;
}
```

---

### Task 2.2: Enhance List API with Pagination & Filtering

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: Task 1.3

**Description**: Enhance the list endpoint to read from the database (not just Gemini), support pagination, and filtering by status.

**Files to Modify**:
- `/app/api/admin/knowledge-base/list/route.ts`

**Acceptance Criteria**:
- [ ] Read documents from `kb_documents` table (not just Gemini)
- [ ] Support `status` query parameter for filtering
- [ ] Support `page` and `limit` query parameters for pagination
- [ ] Default pagination: page=1, limit=20
- [ ] Return pagination metadata (total, hasMore)
- [ ] Only return non-deleted documents (deletedAt IS NULL)
- [ ] Sort by createdAt descending (newest first)

**Response Format**:
```typescript
interface ListResponse {
  documents: Array<{
    id: string;
    displayName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    createdAt: string;
    indexedAt?: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
```

---

### Task 2.3: Enhance Delete API for Bulk Operations

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: Task 1.3

**Description**: Enhance delete endpoint to support bulk deletion by document IDs.

**Files to Modify**:
- `/app/api/admin/knowledge-base/delete/route.ts`

**Acceptance Criteria**:
- [ ] Accept `documentIds: string[]` in request body
- [ ] Delete files from Gemini for each document
- [ ] Soft delete records in `kb_documents` table
- [ ] Return count of successfully deleted documents
- [ ] Return errors for any failed deletions
- [ ] Handle partial failures (some delete, some fail)
- [ ] Backward compatible with single-delete (single ID)

**Request/Response Format**:
```typescript
interface DeleteRequest {
  documentIds: string[];
}

interface DeleteResponse {
  success: boolean;
  deletedCount: number;
  errors?: Array<{ id: string; error: string }>;
}
```

---

### Task 2.4: Create Query API Endpoint (New)

**Priority**: Medium  
**Effort**: 3-4 hours  
**Dependencies**: Task 1.3, Task 3.2

**Description**: Create a new API endpoint for querying the knowledge base with confidence scoring. This endpoint is primarily for internal use by the KB tool.

**Files to Create**:
- `/app/api/knowledge-base/query/route.ts`

**Acceptance Criteria**:
- [ ] Accept `query` string and optional `confidenceThreshold`
- [ ] Query the knowledge base using enhanced query function
- [ ] Return status: 'found', 'not_found', 'low_confidence', 'error'
- [ ] Return answer and confidence score when found
- [ ] Respect configurable confidence threshold (default 70%)
- [ ] Return generic source indicator (no specific citations)
- [ ] Rate limiting consideration for abuse prevention
- [ ] Proper error handling with meaningful error codes

**Response Format**:
```typescript
interface QueryResponse {
  status: 'found' | 'not_found' | 'low_confidence' | 'error';
  answer?: string;
  confidence?: number;
  source?: 'internal';
}
```

---

## Task Group 3: Chat System Integration

**Priority**: 🔴 Critical  
**Estimated Effort**: 10-12 hours  
**Dependencies**: Task Group 1

This group implements the core intent detection and KB tool enhancement for smart query routing.

---

### Task 3.1: Implement Intent Detection Logic

**Priority**: High  
**Effort**: 4 hours  
**Dependencies**: None (can start in parallel with Group 1)

**Description**: Create an intent detector that classifies user queries as transactional (flight searches, bookings) or informational (travel tips, destination info).

**Files to Create**:
- `/lib/utils/intent-detector.ts`

**Acceptance Criteria**:
- [ ] Export `QueryIntent` type: 'transactional' | 'informational' | 'ambiguous'
- [ ] Export `IntentResult` interface with intent, confidence, signals
- [ ] Implement `detectIntent(query: string): IntentResult` function
- [ ] TRANSACTIONAL patterns: flight keywords + dates, booking requests, price queries
- [ ] INFORMATIONAL patterns: tips/advice, best time questions, destination info
- [ ] Support both English and German patterns (per existing codebase)
- [ ] Return confidence score (0-1) based on pattern matches
- [ ] Return signals array for debugging/logging
- [ ] File stays under 600 lines per AGENTS.md
- [ ] Unit tests achieve >85% accuracy on test cases

**Example Implementation**:
```typescript
const TRANSACTIONAL_PATTERNS = [
  /\b(fl[uü]g|flight|fliegen|fly)\b.*\b\d{1,2}[\./]\d{1,2}/i,
  /\b(buchen|book|reserv|bestell)\b/i,
  // ... more patterns
];

export function detectIntent(query: string): IntentResult {
  // Implementation per spec section 6.2
}
```

---

### Task 3.2: Enhance Knowledge Base Query Function

**Priority**: High  
**Effort**: 3 hours  
**Dependencies**: Task 1.3

**Description**: Enhance the existing KB query function to support confidence thresholds and better status reporting.

**Files to Modify**:
- `/lib/tools/knowledge-base-query.ts`

**Acceptance Criteria**:
- [ ] Add `confidenceThreshold` option (default 0.70)
- [ ] Add confidence scoring to response
- [ ] Add 'low_confidence' status when below threshold
- [ ] Integrate with database to get active documents
- [ ] Return structured result with confidence metrics
- [ ] Signal for fallback behavior (__KB_LOW_CONFIDENCE__, __KB_NOT_FOUND__)
- [ ] Maintain backward compatibility with existing callers
- [ ] JSDoc documentation for all public interfaces

**Enhanced Interface**:
```typescript
interface KnowledgeBaseQueryOptions {
  confidenceThreshold?: number;
  maxResults?: number;
}

interface KnowledgeBaseQueryResult {
  status: 'found' | 'not_found' | 'low_confidence' | 'empty' | 'error';
  answer?: string;
  confidence?: number;
  reason?: string;
}
```

---

### Task 3.3: Update Knowledge Base Tool

**Priority**: High  
**Effort**: 2-3 hours  
**Dependencies**: Task 3.1, Task 3.2

**Description**: Enhance the KB tool to integrate intent detection and improved response handling.

**Files to Modify**:
- `/lib/tools/knowledge-base.ts`

**Acceptance Criteria**:
- [ ] Enhanced tool description with clear use/skip guidance
- [ ] Integrate `detectIntent` for query classification
- [ ] Skip KB search for clearly transactional queries
- [ ] Use enhanced query function with confidence threshold
- [ ] Return signals for fallback: __KB_LOW_CONFIDENCE__, __KB_NOT_FOUND__
- [ ] Clean answer format (no "[Knowledge Base]" prefix for seamless integration)
- [ ] Proper error handling returning __KB_ERROR__
- [ ] Configurable confidence threshold via environment/config

---

### Task 3.4: Update Chat System Prompts

**Priority**: Medium  
**Effort**: 2 hours  
**Dependencies**: Task 3.3

**Description**: Update the system prompts in actions.ts to provide better guidance on KB tool usage and fallback behavior.

**Files to Modify**:
- `/app/actions.ts` (groupInstructions.web section)

**Acceptance Criteria**:
- [ ] Add explicit guidance on when to skip KB (transactional queries)
- [ ] Add explicit guidance on when to use KB (informational queries)
- [ ] Document intent signals for skipping KB
- [ ] Document fallback behavior for low confidence/not found
- [ ] Keep existing 2-tool limit for KB→web_search fallback
- [ ] Update instructions to match new tool behavior
- [ ] Ensure seamless answer integration (no explicit source citations)

---

## Task Group 4: Admin UI Enhancement

**Priority**: 🟡 High  
**Estimated Effort**: 12-14 hours  
**Dependencies**: Task Group 2

This group enhances the admin interface with bulk operations, drag-drop upload, and improved UX.

---

### Task 4.1: Create DocumentUploader Component

**Priority**: High  
**Effort**: 4 hours  
**Dependencies**: Task 2.1

**Description**: Create a new upload component with drag-and-drop support and multi-file selection.

**Files to Create**:
- `/app/admin/knowledge-base/components/DocumentUploader.tsx`

**Acceptance Criteria**:
- [ ] Drag-and-drop zone for file uploads
- [ ] Click-to-browse file selection
- [ ] Support multiple file selection
- [ ] File type validation (PDF, MD, TXT)
- [ ] File size validation with clear error messages
- [ ] Upload progress indicator per file
- [ ] Success/error status per file
- [ ] Clear/reset functionality
- [ ] Callback `onUploadComplete` for parent notification
- [ ] Configurable max files (default: 10)
- [ ] Configurable max size (default: 20MB)
- [ ] Responsive design for mobile
- [ ] Uses existing UI components (Card, Button, etc.)
- [ ] File stays under 600 lines per AGENTS.md

**Props Interface**:
```typescript
interface DocumentUploaderProps {
  onUploadComplete: () => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
}
```

---

### Task 4.2: Create useUpload Custom Hook

**Priority**: Medium  
**Effort**: 2 hours  
**Dependencies**: Task 2.1

**Description**: Create a custom hook to manage upload state and API calls.

**Files to Create**:
- `/app/admin/knowledge-base/hooks/useUpload.ts`

**Acceptance Criteria**:
- [ ] Manage upload state: idle, uploading, success, error
- [ ] Track per-file progress and status
- [ ] Handle FormData construction for multiple files
- [ ] Call bulk upload API endpoint
- [ ] Parse and expose upload results
- [ ] Provide reset/clear functionality
- [ ] Error handling with user-friendly messages
- [ ] TypeScript types for all state and results

---

### Task 4.3: Create DocumentList Component

**Priority**: High  
**Effort**: 4 hours  
**Dependencies**: Task 2.2, Task 2.3

**Description**: Enhanced document list with pagination, bulk selection, and delete operations.

**Files to Create**:
- `/app/admin/knowledge-base/components/DocumentList.tsx`
- `/app/admin/knowledge-base/components/DocumentRow.tsx`
- `/app/admin/knowledge-base/components/StatusBadge.tsx`

**Acceptance Criteria**:
- [ ] Table display with sortable columns
- [ ] Checkbox selection for bulk operations
- [ ] "Select all" checkbox
- [ ] Pagination controls (prev/next, page info)
- [ ] Status filter dropdown
- [ ] Refresh button
- [ ] Loading state with skeleton
- [ ] Empty state with helpful message
- [ ] StatusBadge component for visual status indication
- [ ] DocumentRow component for single row rendering
- [ ] Bulk delete button (enabled when items selected)
- [ ] Confirmation dialog for delete operations
- [ ] Uses existing Table, Checkbox, Button components
- [ ] Each file stays under 600 lines

---

### Task 4.4: Create useDocuments Custom Hook

**Priority**: Medium  
**Effort**: 2 hours  
**Dependencies**: Task 2.2

**Description**: Create a custom hook to manage document list state, fetching, and pagination.

**Files to Create**:
- `/app/admin/knowledge-base/hooks/useDocuments.ts`

**Acceptance Criteria**:
- [ ] Fetch documents from list API
- [ ] Manage pagination state (page, limit)
- [ ] Support status filtering
- [ ] Provide refresh functionality
- [ ] Loading and error states
- [ ] Selection state management
- [ ] Bulk delete operation
- [ ] Optimistic updates for better UX
- [ ] TypeScript types for all state

---

### Task 4.5: Refactor Main Page to Use New Components

**Priority**: High  
**Effort**: 2-3 hours  
**Dependencies**: Task 4.1, Task 4.3, Task 4.4

**Description**: Refactor the existing admin page to use the new modular components.

**Files to Modify**:
- `/app/admin/knowledge-base/page.tsx`

**Acceptance Criteria**:
- [ ] Replace inline upload UI with DocumentUploader component
- [ ] Replace inline list UI with DocumentList component
- [ ] Wire up hooks (useDocuments, useUpload)
- [ ] Remove duplicated state management
- [ ] Ensure all existing functionality preserved
- [ ] Add any missing wrapper/layout elements
- [ ] Test all interactions end-to-end
- [ ] File stays under 600 lines (likely much smaller now)

---

## Task Group 5: Configuration & Error Handling

**Priority**: 🟡 High  
**Estimated Effort**: 3-4 hours  
**Dependencies**: Task Groups 1-2

This group establishes configuration patterns and robust error handling.

---

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
- [ ] Error codes: UPLOAD_FAILED, INVALID_FILE_TYPE, FILE_TOO_LARGE, etc.
- [ ] Include error details for debugging
- [ ] Utility functions for error handling
- [ ] User-friendly error message mapping
- [ ] JSDoc documentation

---

## Task Group 6: Testing & Quality Assurance

**Priority**: 🟢 Required  
**Estimated Effort**: 8-10 hours  
**Dependencies**: All previous groups

This group ensures reliability through comprehensive testing.

---

### Task 6.1: Unit Tests for Database Queries

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: Task 1.3

**Description**: Create unit tests for all KB document database operations.

**Files to Create**:
- `/lib/db/queries/kb-documents.test.ts`

**Acceptance Criteria**:
- [ ] Tests for createKBDocument
- [ ] Tests for getKBDocumentById
- [ ] Tests for listKBDocuments with pagination
- [ ] Tests for updateKBDocument
- [ ] Tests for softDeleteKBDocument
- [ ] Tests for bulkSoftDeleteKBDocuments
- [ ] Edge cases: empty results, invalid IDs, etc.
- [ ] Mock database for isolation

---

### Task 6.2: Unit Tests for Intent Detector

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: Task 3.1

**Description**: Create comprehensive tests for intent detection accuracy.

**Files to Create**:
- `/lib/utils/intent-detector.test.ts`

**Acceptance Criteria**:
- [ ] Tests for transactional query detection
- [ ] Tests for informational query detection
- [ ] Tests for ambiguous query handling
- [ ] Tests for German language queries
- [ ] Tests for English language queries
- [ ] Edge cases: mixed signals, empty queries
- [ ] Accuracy validation (>85% on test suite)
- [ ] Test cases documented for future reference

**Example Test Cases**:
```typescript
const transactionalQueries = [
  "Flug von Berlin nach Paris am 15.12",
  "Book a flight to Tokyo for March 2025",
  "Preise für Flüge nach London",
];

const informationalQueries = [
  "Best time to visit Bali?",
  "Tipps für Reisen nach Thailand",
  "What should I know about traveling to Japan?",
];
```

---

### Task 6.3: Unit Tests for KB Query Function

**Priority**: High  
**Effort**: 2 hours  
**Dependencies**: Task 3.2

**Description**: Test the enhanced KB query function with confidence scoring.

**Files to Create**:
- `/lib/tools/knowledge-base-query.test.ts`

**Acceptance Criteria**:
- [ ] Tests for successful query with high confidence
- [ ] Tests for low confidence response
- [ ] Tests for not found response
- [ ] Tests for empty KB handling
- [ ] Tests for error handling
- [ ] Tests for confidence threshold configuration
- [ ] Mock Gemini model responses
- [ ] Mock database queries

---

### Task 6.4: API Route Integration Tests

**Priority**: Medium  
**Effort**: 2-3 hours  
**Dependencies**: Task Group 2

**Description**: Create integration tests for API endpoints.

**Files to Create**:
- `/app/api/admin/knowledge-base/__tests__/upload.test.ts`
- `/app/api/admin/knowledge-base/__tests__/list.test.ts`
- `/app/api/admin/knowledge-base/__tests__/delete.test.ts`

**Acceptance Criteria**:
- [ ] Tests for upload with valid files
- [ ] Tests for upload with invalid file types
- [ ] Tests for bulk upload
- [ ] Tests for list pagination
- [ ] Tests for list filtering
- [ ] Tests for single delete
- [ ] Tests for bulk delete
- [ ] Tests for error responses
- [ ] Mock file uploads and database

---

### Task 6.5: Component Tests for Admin UI

**Priority**: Low  
**Effort**: 2 hours  
**Dependencies**: Task Group 4

**Description**: Create component tests for admin UI components.

**Files to Create**:
- `/app/admin/knowledge-base/components/__tests__/DocumentUploader.test.tsx`
- `/app/admin/knowledge-base/components/__tests__/DocumentList.test.tsx`

**Acceptance Criteria**:
- [ ] Tests for file selection
- [ ] Tests for drag-and-drop
- [ ] Tests for validation errors
- [ ] Tests for upload progress display
- [ ] Tests for document list rendering
- [ ] Tests for selection/deselection
- [ ] Tests for bulk delete
- [ ] Tests for pagination controls
- [ ] Tests for empty state

---

## Task Dependencies Graph

```
Group 1: Foundation (Week 1)
├── 1.1 Schema ─────┐
├── 1.2 Migration ──┼─> Group 2, 3, 4
└── 1.3 Queries ────┘

Group 2: APIs (Week 1-2)
├── 2.1 Upload API ──────┐
├── 2.2 List API ────────┼─> Group 4 (UI)
├── 2.3 Delete API ──────┤
└── 2.4 Query API ───────┘

Group 3: Chat Integration (Week 2)
├── 3.1 Intent Detector ─┐
├── 3.2 KB Query Enhance ┼─> 3.3 KB Tool ─> 3.4 Prompts
└────────────────────────┘

Group 4: Admin UI (Week 2-3)
├── 4.1 Uploader ───┐
├── 4.2 useUpload ──┤
├── 4.3 List ───────┼─> 4.5 Page Refactor
├── 4.4 useDocuments┤
└───────────────────┘

Group 5: Config (Parallel)
├── 5.1 KB Config
└── 5.2 Error Types

Group 6: Testing (Week 3-4)
├── 6.1 DB Query Tests
├── 6.2 Intent Tests
├── 6.3 KB Query Tests
├── 6.4 API Tests
└── 6.5 UI Tests
```

---

## Implementation Order (Recommended)

### Sprint 1 (Foundation) - Days 1-3
1. Task 5.1: KB Configuration (can start immediately)
2. Task 5.2: Error Types (can start immediately)
3. Task 1.1: Database Schema
4. Task 1.2: Migration
5. Task 1.3: Database Queries
6. Task 3.1: Intent Detector (parallel with DB work)

### Sprint 2 (APIs & Core) - Days 4-7
7. Task 2.1: Upload API Enhancement
8. Task 2.2: List API Enhancement
9. Task 2.3: Delete API Enhancement
10. Task 3.2: KB Query Enhancement
11. Task 3.3: KB Tool Update
12. Task 3.4: Chat Prompt Updates

### Sprint 3 (UI) - Days 8-11
13. Task 4.2: useUpload Hook
14. Task 4.1: DocumentUploader Component
15. Task 4.4: useDocuments Hook
16. Task 4.3: DocumentList Component
17. Task 4.5: Page Refactor

### Sprint 4 (Testing) - Days 12-14
18. Task 2.4: Query API (if not done earlier)
19. Task 6.1: DB Query Tests
20. Task 6.2: Intent Detector Tests
21. Task 6.3: KB Query Tests
22. Task 6.4: API Integration Tests
23. Task 6.5: UI Component Tests

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gemini API changes | High | Low | Pin API version, monitor deprecations |
| Confidence scoring accuracy | Medium | Medium | Start with 70%, tune based on feedback |
| Intent detection false positives | Medium | Medium | Conservative patterns, allow ambiguous |
| Bulk upload performance | Low | Low | Implement progress tracking, chunking |
| Database migration issues | Medium | Low | Test in staging, prepare rollback |

---

## Success Metrics

- [ ] Admins can upload ≥10 files in single batch
- [ ] Upload success rate ≥95%
- [ ] Intent detection accuracy ≥85%
- [ ] KB query response time <2 seconds
- [ ] All unit tests passing
- [ ] No TypeScript errors
- [ ] All files <600 lines
- [ ] Documentation complete

---

## Notes for Implementers

1. **Database First**: Always implement database changes before API changes
2. **Parallel Work**: Tasks 3.1 (Intent) and 5.x (Config/Errors) can start in parallel with Group 1
3. **Testing Throughout**: Write tests as you implement, not at the end
4. **Existing Patterns**: Follow patterns established in existing codebase files
5. **UI Last**: Build backend/API completely before enhancing UI
6. **Backward Compatibility**: Keep existing single-file operations working during migration
