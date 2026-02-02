---
phase: 03-observability-enhancement
plan: 01
subsystem: database, api, ui
tags: [drizzle, postgres, cron, vercel, admin]

# Dependency graph
requires:
  - phase: 01-llm-airport-resolution
    provides: flight search tool with no-results handling
provides:
  - failedSearchLogs database table with 30-day TTL
  - logFailedSearch/getFailedSearchLogs/deleteExpiredLogs query functions
  - Flight search integration logging failures
  - Vercel Cron job for automatic cleanup (daily 2 AM)
  - Admin UI page with date/text filtering
affects: [admin-features, monitoring, analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Non-blocking database logging in tool execution
    - Vercel Cron with CRON_SECRET bearer auth
    - Admin API route with role-based access

key-files:
  created:
    - lib/db/queries/failed-search.ts
    - app/api/cron/cleanup-failed-searches/route.ts
    - app/api/admin/failed-searches/route.ts
    - app/admin/failed-searches/page.tsx
  modified:
    - lib/db/schema.ts
    - lib/tools/flight-search.ts
    - vercel.json
    - components/admin/admin-nav.tsx

key-decisions:
  - "Non-blocking logging: await logFailedSearch but catch errors to not block tool execution"
  - "30-day TTL via expiresAt column with $defaultFn, not DB-level TTL"
  - "Cron runs at 2 AM UTC for off-peak cleanup"

patterns-established:
  - "Failed search logging pattern: capture query/airports/dates/errorType on no-results"
  - "Admin API pattern: getUser + getUserRole check before data access"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 03 Plan 01: Failed Search Logging Summary

**Database-backed failed search logging with 30-day TTL, Vercel Cron cleanup, and admin UI with filtering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T11:08:58Z
- **Completed:** 2026-02-02T11:12:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- failedSearchLogs table with expiresAt column for automatic 30-day TTL
- Integrated logging in flight-search.ts on no-results/provider-unavailable
- Vercel Cron job for daily cleanup of expired logs
- Admin page with date range and text search filters

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failedSearchLogs schema and query functions** - `c367f1f` (feat)
2. **Task 2: Integrate logging into flight-search.ts and add cron cleanup** - `7e8132f` (feat)
3. **Task 3: Create admin UI for viewing failed search logs** - `07361ff` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added failedSearchLogs table definition
- `lib/db/queries/failed-search.ts` - CRUD operations for failed search logs
- `lib/tools/flight-search.ts` - Integration of logFailedSearch on failures
- `app/api/cron/cleanup-failed-searches/route.ts` - Cron endpoint with CRON_SECRET auth
- `vercel.json` - Added cleanup cron job (0 2 * * *)
- `app/api/admin/failed-searches/route.ts` - Admin API with role check
- `app/admin/failed-searches/page.tsx` - Admin UI with filters and table
- `components/admin/admin-nav.tsx` - Added nav item for failed searches

## Decisions Made
- Non-blocking logging: Wrapped logFailedSearch in try/catch to prevent tool failures from blocking
- Used German labels in admin UI for consistency with existing admin pages
- Color-coded error type badges (yellow for no_results, red for provider errors)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified.

## User Setup Required

None - no external service configuration required. CRON_SECRET environment variable should already be configured for existing cron jobs.

## Next Phase Readiness
- Failed search monitoring infrastructure complete
- Ready for 03-02: Search Session Persistence
- No blockers

---
*Phase: 03-observability-enhancement*
*Completed: 2026-02-02*
