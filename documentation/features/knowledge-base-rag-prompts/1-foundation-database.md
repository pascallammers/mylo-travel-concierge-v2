# Task Group 1: Foundation & Database

We're implementing the Knowledge Base RAG System by starting with task group 1:

## Implement this task group and all sub-tasks:

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

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec
- `@lib/db/schema.ts` - Existing schema patterns
- `@lib/db/queries.ts` - Existing query patterns

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/backend/models.md` - Database model standards
- `@droidz/standards/backend/migrations.md` - Migration standards
- `@droidz/standards/backend/queries.md` - Query function standards
