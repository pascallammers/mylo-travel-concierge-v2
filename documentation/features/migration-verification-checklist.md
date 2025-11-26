# Knowledge Base File Search Store Migration - Verification Checklist

## Overview
This checklist verifies the migration from legacy Gemini Files API to the new File Search Store implementation.

**Migration Strategy**: Hybrid approach - new uploads use File Search Store, legacy documents remain functional.

---

## Pre-Verification

- [ ] Database migration `0011_amazing_the_leader.sql` applied successfully
- [ ] Verify migration added new columns: `fileSearchStoreName`, `fileSearchDocumentName`, `fileSearchIndexedAt`
- [ ] No data loss from migration (verify existing documents intact)
- [ ] Backup created (if applicable in production)

---

## File Search Store Setup

- [ ] File Search Store created in Google AI Studio/Gemini console
- [ ] Store name matches `KB_CONFIG.fileSearchStoreName` in config
- [ ] Environment variable `GOOGLE_GENERATIVE_AI_API_KEY` is set
- [ ] API credentials working (test with simple query)
- [ ] Store is visible in Gemini File Manager

---

## Upload Functionality

### Single File Upload
- [ ] Upload PDF file (< 20MB) works
- [ ] Upload TXT file works
- [ ] Upload MD (Markdown) file works
- [ ] File size validation working (rejects files > 20MB)
- [ ] MIME type validation working (rejects unsupported types like .exe, .jpg)
- [ ] User-friendly error messages displayed

### Database Record Creation
- [ ] Database record created after successful upload
- [ ] `fileSearchStoreName` field populated correctly
- [ ] `fileSearchDocumentName` field populated correctly (format: `fileSearchStores/{id}/documents/{doc-id}`)
- [ ] `fileSearchIndexedAt` timestamp set
- [ ] `status` field set to 'active'
- [ ] Legacy fields still populated for backward compatibility:
  - [ ] `geminiFileName`
  - [ ] `geminiFileUri`

### Bulk Upload
- [ ] Bulk upload works (multiple files at once)
- [ ] Maximum 10 files enforced
- [ ] Partial success handled (some succeed, some fail)
- [ ] Progress indicators work correctly
- [ ] Results summary shows success/failure counts

### Indexing
- [ ] Indexing completes within 5 minutes for typical files
- [ ] Large files (10-20MB) index successfully
- [ ] Status updates shown during indexing
- [ ] Error handling for indexing failures

---

## Query Functionality

### Semantic Search
- [ ] Query returns answers for documents in File Search Store
- [ ] Confidence scores are reasonable (> 0.7 for relevant queries)
- [ ] NOT_FOUND signal returned for irrelevant queries
- [ ] Sources are returned with document references
- [ ] Chunk excerpts displayed correctly

### Intent Detection Integration
- [ ] Informational queries use KB (e.g., "What are travel tips for Japan?")
- [ ] Transactional queries skip KB (e.g., "Book a flight on 15.12")
- [ ] Intent detection works for German queries
- [ ] Intent detection works for English queries
- [ ] Ambiguous queries handled appropriately

### Fallback Behavior
- [ ] Fallback to web_search works when KB has no answer
- [ ] Low confidence responses trigger fallback
- [ ] NOT_FOUND signal triggers web search
- [ ] Confidence threshold (0.7) applied correctly

### Language Support
- [ ] German queries work correctly
- [ ] English queries work correctly
- [ ] Mixed language queries handled

### Response Quality
- [ ] Answers are relevant to queries
- [ ] Confidence scores correlate with answer quality
- [ ] Sources properly cited
- [ ] No hallucinations or incorrect information

---

## Delete Functionality

### Single Document Delete
- [ ] Delete new documents from File Search Store works
- [ ] Delete legacy documents from old Files API works
- [ ] Database soft delete happens (sets `deletedAt` timestamp)
- [ ] Deleted documents no longer appear in list
- [ ] Deleted documents no longer appear in query results
- [ ] Status updated to 'archived' on delete

### Bulk Delete
- [ ] Bulk delete works (multiple documents at once)
- [ ] Partial failures handled correctly (some succeed, some fail)
- [ ] Results show which documents were deleted
- [ ] Error messages clear for failed deletions

### File Search Store Cleanup
- [ ] Documents removed from File Search Store index
- [ ] Verify via Gemini console that documents are gone
- [ ] No orphaned documents left in File Search Store

### Error Handling
- [ ] Graceful handling if File Search Store deletion fails
- [ ] Soft delete still happens even if external deletion fails
- [ ] User informed of partial failures
- [ ] Error messages are actionable

---

## Admin UI

### Document List
- [ ] Document list loads correctly
- [ ] Shows all uploaded documents
- [ ] "Indexed" badge shows for new documents (green)
- [ ] "Legacy" badge shows for old documents (yellow)
- [ ] Tooltips work on badge hover
- [ ] File names displayed correctly
- [ ] Upload dates shown correctly
- [ ] File sizes shown in human-readable format

### Status Filters
- [ ] Filter by "Active" works
- [ ] Filter by "Processing" works
- [ ] Filter by "Failed" works
- [ ] Filter by "All" works
- [ ] Clear filters works

### Pagination
- [ ] Pagination works (20 items per page)
- [ ] Page navigation works
- [ ] "Load More" button works (if implemented)
- [ ] Total count displayed correctly

### Bulk Operations
- [ ] Bulk selection works (checkboxes)
- [ ] "Select All" works
- [ ] Bulk delete button enabled when items selected
- [ ] Bulk delete confirmation dialog shows
- [ ] Bulk operations provide feedback

### Search/Filter
- [ ] Search by filename works (if implemented)
- [ ] Filter by date range works (if implemented)

---

## Error Handling

### Upload Errors
- [ ] Invalid file types rejected with clear message
- [ ] File size limits enforced
- [ ] Gemini API errors handled gracefully
- [ ] Network errors handled gracefully
- [ ] User-friendly error messages shown
- [ ] Errors logged to console/server logs

### Query Errors
- [ ] File Search Store errors handled gracefully
- [ ] Timeout errors handled
- [ ] Empty results handled (show "No results found")
- [ ] API rate limit errors handled

### Delete Errors
- [ ] Non-existent document errors handled
- [ ] Already deleted document errors handled
- [ ] Permission errors handled
- [ ] Partial failure errors handled

### General Error Handling
- [ ] No console errors during normal operation
- [ ] No server errors during normal operation
- [ ] Error boundaries catch React errors (if applicable)
- [ ] Error messages localized (if applicable)

---

## Performance

### Upload Performance
- [ ] Upload time acceptable (< 30s for 10MB file)
- [ ] Parallel uploads work without blocking UI
- [ ] Progress indicators responsive
- [ ] No memory leaks during multiple uploads

### Query Performance
- [ ] Query response time < 5s for typical queries
- [ ] Multiple queries don't block UI
- [ ] Caching works (if implemented)
- [ ] No performance degradation with many documents

### List Performance
- [ ] List API response time < 2s
- [ ] Pagination doesn't slow down with many pages
- [ ] Filtering is fast
- [ ] Sorting is fast

### Memory & Resources
- [ ] No memory leaks observed during extended use
- [ ] CPU usage reasonable during indexing
- [ ] Network usage reasonable
- [ ] Browser/app remains responsive

---

## Logs & Monitoring

### Application Logs
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] File Search Store operations logged correctly
- [ ] Upload operations logged with document IDs
- [ ] Query operations logged with timing info
- [ ] Delete operations logged

### Migration Logs
- [ ] Migration status visible in logs
- [ ] Document counts logged (before/after)
- [ ] Any migration errors logged
- [ ] Timestamp of migration logged

### Monitoring (if applicable)
- [ ] Metrics for upload success rate
- [ ] Metrics for query success rate
- [ ] Metrics for average response time
- [ ] Alerts configured for errors

---

## Backward Compatibility

### Legacy Documents
- [ ] Existing documents remain queryable
- [ ] Legacy documents can be deleted
- [ ] Legacy documents show in admin UI with "Legacy" badge
- [ ] No breaking changes to existing functionality

### API Compatibility
- [ ] Existing API endpoints still work
- [ ] Response formats unchanged (or backward compatible)
- [ ] No breaking changes for API consumers

---

## Security

### Authentication & Authorization
- [ ] Upload endpoint requires authentication
- [ ] Delete endpoint requires authentication
- [ ] List endpoint requires authentication
- [ ] Admin-only endpoints properly secured

### Input Validation
- [ ] File type validation enforced server-side
- [ ] File size validation enforced server-side
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized outputs)

### Data Protection
- [ ] Sensitive data not logged
- [ ] API keys not exposed in client code
- [ ] CORS configured correctly
- [ ] HTTPS enforced (production)

---

## Production Readiness

### Testing
- [ ] All unit tests pass (26 integration tests)
- [ ] All KB tests pass (upload, list, delete, query, intent)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Test coverage maintained or improved

### Documentation
- [ ] Migration guide complete
- [ ] API documentation updated
- [ ] README updated (if applicable)
- [ ] Changelog updated
- [ ] Tasks document updated

### Deployment
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] File Search Store created
- [ ] Rollback plan documented
- [ ] Deployment tested in staging

### Post-Deployment
- [ ] Monitor error rates for 24-48 hours
- [ ] Verify no increase in error rates
- [ ] User feedback collected
- [ ] Performance metrics reviewed

---

## Known Issues & Limitations

- [ ] Indexing can take up to 5 minutes for large files
- [ ] Maximum file size is 20MB (Gemini API limit)
- [ ] Only PDF, TXT, and MD files supported
- [ ] Legacy documents not automatically migrated to File Search Store
- [ ] Query confidence threshold is fixed at 0.7 (configurable in code only)

---

## Sign-Off

### Tested By
- Name: _______________________
- Date: _______________________
- Environment: ☐ Development ☐ Staging ☐ Production

### Issues Found
List any issues discovered during verification:

1. _______________________
2. _______________________
3. _______________________

### Approved By
- Name: _______________________
- Date: _______________________
- Signature: _______________________

---

## Notes

Add any additional notes or observations:

_______________________
_______________________
_______________________
