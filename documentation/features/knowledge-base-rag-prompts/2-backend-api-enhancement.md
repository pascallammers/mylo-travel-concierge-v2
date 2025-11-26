# Task Group 2: Backend API Enhancement

We're continuing the Knowledge Base RAG System implementation with task group 2:

## Implement this task group and all sub-tasks:

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

---

### Task 2.4: Create Query API Endpoint (New)

**Priority**: Medium  
**Effort**: 3-4 hours  
**Dependencies**: Task 1.3, Task 3.2

**Description**: Create a new API endpoint for querying the knowledge base with confidence scoring.

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

---

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec
- `@app/api/admin/knowledge-base/` - Existing API routes
- `@lib/gemini-file-manager.ts` - Gemini file operations

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/backend/api.md` - API design standards
- `@droidz/standards/backend/queries.md` - Query function standards
