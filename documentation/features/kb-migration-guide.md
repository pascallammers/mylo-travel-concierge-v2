# Knowledge Base Migration Guide

## Overview

This guide covers the migration of Knowledge Base documents from the legacy Gemini Files API to the new File Search Stores API. The new API provides improved RAG (Retrieval-Augmented Generation) capabilities with better semantic search and automatic document chunking.

## Table of Contents

1. [Understanding the Migration](#understanding-the-migration)
2. [Critical Limitations](#critical-limitations)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Migration Options](#migration-options)
5. [Running the Migration Script](#running-the-migration-script)
6. [Verification](#verification)
7. [Rollback Plan](#rollback-plan)
8. [Troubleshooting](#troubleshooting)

---

## Understanding the Migration

### What Changed?

**Before (Legacy Files API):**
- Documents stored using Gemini Files API (`files/abc123`)
- Basic file storage without specialized RAG features
- Manual chunking and retrieval required

**After (File Search Stores API):**
- Documents stored in specialized File Search Stores (`fileSearchStores/xyz789`)
- Automatic chunking with configurable parameters
- Semantic search with grounding and citation support
- Better integration with Gemini's RAG capabilities

### Database Schema Updates

New fields added to `kb_documents` table:
- `fileSearchStoreName` - The File Search Store resource name
- `fileSearchDocumentName` - The indexed document name in the store
- `fileSearchIndexedAt` - Timestamp when document was indexed

Legacy fields (preserved for compatibility):
- `geminiFileName` - Original Gemini Files API reference
- `geminiFileUri` - Original file URI

---

## Critical Limitations

### ⚠️ File Download Not Supported

**The Gemini Files API does not provide a download endpoint.** This means:

1. ❌ **Cannot automatically migrate existing documents** that only exist in Gemini's storage
2. ✅ **Can only migrate if original files are available locally**
3. 🔄 **Must manually re-upload documents** for migration in most cases

### Why This Matters

When documents were originally uploaded:
1. Files were temporarily saved to `/tmp`
2. Uploaded to Gemini Files API
3. Temporary files were deleted
4. **No local copy was retained**

**Result:** Original files are not available for re-upload to the new File Search Store.

### ⚠️ Script Execution Limitation

The migration script imports server-side modules that use the `server-only` package. This package prevents execution outside of Next.js Server Components context. Due to this:

- ✅ The script serves as **documentation** of the migration process
- ✅ The script's logic can be adapted for custom migration needs
- ❌ The script **cannot be executed directly** with standard Node.js/tsx
- ✅ **Option A (Fresh Re-Upload)** is the recommended migration path

**Recommended Approach:** Use the admin interface to re-upload documents rather than attempting automated migration.

---

## Pre-Migration Checklist

### 1. Backup Database

Before making any changes, create a full database backup:

```bash
# Using pg_dump (adjust connection details)
pg_dump -h localhost -U postgres -d mylo_db > kb_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Document Inventory

Check which documents need migration:

```sql
-- Query documents that need migration
SELECT 
  id,
  display_name,
  original_file_name,
  size_bytes,
  created_at,
  CASE 
    WHEN file_search_document_name IS NOT NULL THEN 'Migrated'
    ELSE 'Needs Migration'
  END as migration_status
FROM kb_documents
WHERE deleted_at IS NULL
  AND status = 'active'
ORDER BY created_at DESC;
```

This will show:
- Total number of documents
- How many are already migrated
- List of documents that need migration

### 3. Check Available Local Files

Verify if you have local copies of the original files:

```bash
# Check your upload directories or backup locations
ls -lh /path/to/uploads/
```

**Note:** In most cases, original files will NOT be available locally as they were deleted after upload.

### 4. User Communication

Plan to communicate with users about the migration:
- Which documents need re-upload
- Why re-upload is necessary (improved search capabilities)
- How to re-upload through the admin interface
- Timeline for migration completion

---

## Migration Options

### Option A: Fresh Re-Upload (Recommended)

**Best for:** Most use cases where original files are accessible

**Process:**
1. Keep existing documents as "legacy" references
2. Have users re-upload documents through the admin interface
3. New uploads automatically use File Search Stores
4. Mark old documents as archived once migration is confirmed

**Advantages:**
- Clean migration with full validation
- Ensures file integrity
- Tests the new upload flow
- No risk of data corruption

**Implementation:**
```bash
# No script needed - use the admin UI
# Documents uploaded after the File Search Store integration
# automatically use the new system
```

### Option B: Manual Migration with Local Files

**Best for:** When you have local copies of original files

**Process:**
1. Locate original files locally
2. Modify migration script to accept file path mapping
3. Run migration with local file references
4. Verify migrated documents

**Implementation:**

Create a file mapping CSV (`file-mapping.csv`):
```csv
documentId,localFilePath
doc-id-1,/path/to/original/file1.pdf
doc-id-2,/path/to/original/file2.txt
```

Modify the migration script to use this mapping (see below).

### Option C: Dual-System Operation (Transitional)

**Best for:** Gradual migration without disruption

**Process:**
1. Keep both systems operational
2. Query falls back to old system for unmigrated documents
3. Gradually re-upload important documents
4. Eventually phase out legacy system

**Advantages:**
- No downtime
- Gradual migration
- Lower risk

**Implementation:**
Already supported in the current code - the knowledge base query tool checks both systems.

---

## Reference: Migration Script

### Script Purpose

The migration script at `scripts/migrate-kb-to-file-search-store.ts` serves as:

1. **Documentation** - Shows the intended migration process
2. **Reference** - Demonstrates how to interact with both APIs
3. **Template** - Can be adapted for custom migration scenarios

### Why the Script Cannot Run Directly

Due to the `server-only` package restriction in imported modules, the script cannot execute in a standalone Node.js context. This is a Next.js architectural constraint that affects any code importing server-side database queries.

### Script Features (For Reference)

The script demonstrates:

- ✅ Identifying documents that need migration
- ✅ Batch processing with rate limiting
- ✅ Dry-run mode for testing
- ✅ Error handling and reporting
- ✅ Progress tracking and summaries
- ✅ Idempotent operations (safe to re-run)

### What the Script Would Do

If it could run, the migration process would:

1. Fetch all active KB documents from database
2. Filter documents missing `fileSearchDocumentName`
3. For each document:
   - Download file from local storage (if available)
   - Upload to File Search Store with chunking config
   - Update database with new references
4. Generate summary report

### Actual Migration Process

**Since the script cannot run directly, follow Option A (Fresh Re-Upload) instead:**

1. Access the admin Knowledge Base interface
2. Review the list of existing documents
3. Re-upload documents through the UI
4. New uploads automatically use File Search Store
5. Mark old documents as archived once verified

---

## Verification

### 1. Check Migration Results

Review the script output:

```
=== MIGRATION SUMMARY ===
Total Documents:     15
✓ Successfully Migrated: 0
⊘ Skipped:           15
✗ Failed:            0
===========================
```

### 2. Verify Database Records

Check that migrated documents have the new fields populated:

```sql
SELECT 
  id,
  display_name,
  gemini_file_name,
  file_search_document_name,
  file_search_indexed_at,
  status
FROM kb_documents
WHERE file_search_document_name IS NOT NULL
ORDER BY file_search_indexed_at DESC;
```

### 3. Test Queries

Query the knowledge base to ensure documents are retrievable:

```bash
# Use the admin interface or API to test queries
curl -X POST http://localhost:3000/api/knowledge-base/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the hotel policies?"}'
```

### 4. Check Gemini Console

Verify documents appear in the Google AI Studio:
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Navigate to File Search Stores
3. Confirm your store (`mylo-knowledge-base`) contains the documents

---

## Rollback Plan

### If Migration Fails Completely

1. **Restore Database Backup:**
   ```bash
   psql -h localhost -U postgres -d mylo_db < kb_backup_YYYYMMDD_HHMMSS.sql
   ```

2. **Verify Restoration:**
   ```sql
   SELECT COUNT(*) FROM kb_documents;
   ```

3. **Clear File Search Store (if needed):**
   ```typescript
   // Use the admin interface or create a cleanup script
   import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';
   
   const docs = await geminiFileSearchStore.listDocuments();
   for (const doc of docs) {
     await geminiFileSearchStore.deleteDocument(doc.name);
   }
   ```

### If Partial Migration

If some documents migrated successfully but others failed:

1. **Keep successful migrations** - they're already in the new system
2. **Review failed documents** - check error logs for specific issues
3. **Manual intervention** - handle failed cases individually

**To clear File Search Store for specific documents:**

```sql
-- Reset migration fields for failed documents
UPDATE kb_documents
SET 
  file_search_document_name = NULL,
  file_search_store_name = NULL,
  file_search_indexed_at = NULL
WHERE id IN ('failed-doc-id-1', 'failed-doc-id-2');
```

---

## Troubleshooting

### Common Issues

#### Issue: "Original file not available"

**Symptom:**
```
[Migration] Document doc-123 cannot be automatically migrated
[Migration] Reason: Original file not available locally
[Migration] Gemini Files API does not support file downloads
```

**Solution:**
Use Option A (Fresh Re-Upload) - re-upload documents through admin interface.

#### Issue: Rate Limiting from Gemini

**Symptom:**
```
Error: 429 Too Many Requests
```

**Solution:**
1. Increase `delayBetweenBatches` in the script
2. Reduce `batchSize`
3. Run migration during off-peak hours

```typescript
// Modify these values in the script
const config = {
  batchSize: 2,              // Process 2 at a time instead of 5
  delayBetweenBatches: 5000, // 5 seconds instead of 2
  // ...
};
```

#### Issue: "Store creation returned no name"

**Symptom:**
```
KBError: Store creation returned no name
```

**Solution:**
1. Check `GOOGLE_GENERATIVE_AI_API_KEY` is set correctly
2. Verify API key has permissions for File Search Stores
3. Check Google AI API quotas and limits

#### Issue: Database Connection Errors

**Symptom:**
```
Error: Failed to get active KB documents
```

**Solution:**
1. Verify database connection string in `.env.local`
2. Ensure database is running
3. Check database credentials

#### Issue: TypeScript Import Errors

**Symptom:**
```
Error: Cannot find module '@/lib/...'
```

**Solution:**
Run the script using tsx with the correct tsconfig:

```bash
npx tsx --tsconfig tsconfig.json scripts/migrate-kb-to-file-search-store.ts --dry-run
```

---

## Additional Notes

### Performance Considerations

- **Batch Processing:** Script processes 5 documents at a time by default
- **Rate Limiting:** 2-second delay between batches to avoid API limits
- **Timeout:** Each upload operation has a timeout (defined in the File Search Store service)

### Monitoring

Monitor the migration progress:

1. **Console Output:** Real-time progress and errors
2. **Database Queries:** Check migration status
3. **Google AI Studio:** Verify documents in File Search Store

### Post-Migration

After successful migration:

1. **Archive Legacy Documents:**
   ```sql
   UPDATE kb_documents
   SET status = 'archived'
   WHERE file_search_document_name IS NULL
     AND deleted_at IS NULL;
   ```

2. **Clean Up Legacy Files (Optional):**
   - Consider removing old Gemini Files API references after verification
   - Keep as backup for a grace period

3. **Update Documentation:**
   - Document which files were migrated
   - Note any files that require re-upload
   - Update user guides

---

## Support

For issues or questions:

1. Check this guide's Troubleshooting section
2. Review the migration script logs
3. Check the main project README.md
4. Consult the Gemini File Search Stores API documentation

---

## Summary Checklist

- [ ] Database backed up
- [ ] Dry run completed successfully
- [ ] File availability assessed
- [ ] Migration strategy chosen (A, B, or C)
- [ ] Migration script executed
- [ ] Results verified in database
- [ ] Documents testable through queries
- [ ] Error logs reviewed
- [ ] Rollback plan prepared (if needed)
- [ ] Post-migration cleanup scheduled
- [ ] Users notified of any required re-uploads

---

**Last Updated:** 2024-11-25
**Migration Script Version:** 1.0.0
**Compatibility:** Mylo Travel Concierge v2
