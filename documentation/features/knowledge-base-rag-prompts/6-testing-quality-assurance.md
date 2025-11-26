# Task Group 6: Testing & Quality Assurance

We're completing the Knowledge Base RAG System implementation with task group 6:

## Implement this task group and all sub-tasks:

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

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec
- All implementation files from Task Groups 1-5
- `@test-setup.ts` - Existing test setup

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/testing/test-writing.md` - Test writing standards
