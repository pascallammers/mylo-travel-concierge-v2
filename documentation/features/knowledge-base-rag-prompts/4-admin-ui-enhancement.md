# Task Group 4: Admin UI Enhancement

We're continuing the Knowledge Base RAG System implementation with task group 4:

## Implement this task group and all sub-tasks:

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

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec (Section 5)
- `@app/admin/knowledge-base/page.tsx` - Existing admin page
- `@components/ui/` - Existing UI components

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/frontend/components.md` - Component standards
- `@droidz/standards/frontend/css.md` - CSS/Tailwind standards
- `@droidz/standards/frontend/responsive.md` - Responsive design
- `@droidz/standards/frontend/accessibility.md` - Accessibility
