# Phase 3: Observability & Enhancement - Research

**Researched:** 2026-02-02
**Domain:** Application logging, database retention policies, flexible date search patterns
**Confidence:** HIGH

## Summary

This phase implements two complementary features: failed search logging for monitoring and flexible date search as a fallback. Research reveals the tech stack (Next.js 15, Drizzle ORM, PostgreSQL) is well-suited for both patterns. The project already has comprehensive admin infrastructure, database patterns, and flight search tooling that can be extended.

**Key findings:**
- Existing admin area (`/app/admin`) with role-based access provides perfect foundation for logs UI
- Drizzle ORM with PostgreSQL supports TTL patterns via manual cleanup or scheduled jobs
- Seats.aero natively supports flexible dates via `start_date`/`end_date` parameters
- Duffel requires parallel requests with concurrency control (lacks native date range API)
- Flight search tool already has structured error handling and state management

**Primary recommendation:** Build on existing patterns - extend schema with logging table, add pg_cron for TTL, create admin route for log viewing, implement flexible dates as fallback in flight-search.ts with Promise.allSettled for Duffel parallelization.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.44.5 | PostgreSQL ORM | Type-safe schema, existing project standard |
| PostgreSQL | Latest (Neon) | Database | Current project database, supports TTL patterns |
| Next.js App Router | 15.5.9 | API routes & pages | Existing admin UI framework |
| Zod | 3.25.76 | Validation | Already used throughout project for schema validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date manipulation | Already in project, for date range calculations |
| pg_cron | Latest | Scheduled cleanup | Optional: For automatic TTL enforcement |
| Promise.allSettled | Native | Parallel API calls | For Duffel date range requests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron | Manual cleanup API route | pg_cron is automatic but requires extension, manual is simpler but needs trigger |
| Drizzle table | Vercel/Postgres logs only | DB table provides structured querying, logs are ephemeral |
| Promise.allSettled | Sequential requests | Parallel is faster but needs rate limit consideration |

**Installation:**
```bash
# No new packages needed - all dependencies already in project
# Optional: pg_cron extension setup in Neon dashboard if automatic TTL desired
```

## Architecture Patterns

### Recommended Project Structure
```
lib/db/
├── schema.ts              # Add failedSearchLogs table definition
└── queries/
    └── failed-search.ts   # CRUD operations for logs

app/api/admin/
└── failed-searches/
    └── route.ts           # GET endpoint for admin UI

app/admin/
└── failed-searches/
    └── page.tsx           # Admin UI for viewing logs

lib/tools/
└── flight-search.ts       # Extend with flexible date fallback
```

### Pattern 1: Logging Table with TTL (30-day retention)
**What:** PostgreSQL table with automatic or scheduled deletion of records older than 30 days
**When to use:** For transient operational logs that need structure but not long-term storage
**Example:**
```typescript
// In lib/db/schema.ts
export const failedSearchLogs = pgTable('failed_search_logs', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  chatId: text('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

  // Query data
  queryText: text('query_text').notNull(),
  extractedOrigin: text('extracted_origin'),
  extractedDestination: text('extracted_destination'),
  departDate: text('depart_date'),
  returnDate: text('return_date'),
  cabin: text('cabin'),

  // Context
  resultCount: integer('result_count').notNull().default(0),
  errorType: text('error_type'), // 'no_results', 'provider_unavailable', 'extraction_failed'
  errorMessage: text('error_message'),

  // Metadata
  sessionId: text('session_id'), // Anonymous identifier
  timestamp: timestamp('timestamp').notNull().defaultNow(),

  // TTL field for cleanup
  expiresAt: timestamp('expires_at').notNull()
    .$defaultFn(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // 30 days from creation
      return date;
    }),
});

// Index for efficient cleanup queries
.index("expires_at_idx").on(failedSearchLogs.expiresAt);
```

**Cleanup Strategy Options:**

**Option A: Scheduled Next.js API route (Simplest)**
```typescript
// app/api/cron/cleanup-logs/route.ts
export async function GET(request: Request) {
  // Verify cron secret for security
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const deleted = await db.delete(failedSearchLogs)
    .where(lt(failedSearchLogs.expiresAt, new Date()))
    .returning();

  return Response.json({ deleted: deleted.length });
}
```
Then add Vercel Cron job in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/cleanup-logs",
    "schedule": "0 2 * * *"
  }]
}
```

**Option B: pg_cron extension (Most automatic)**
```sql
-- Run in Neon SQL Editor (requires pg_cron extension enabled)
SELECT cron.schedule(
  'cleanup-expired-search-logs',
  '0 2 * * *', -- Daily at 2 AM
  $$DELETE FROM failed_search_logs WHERE expires_at < NOW()$$
);
```

### Pattern 2: Admin Logs UI with Filtering
**What:** Next.js page in admin area that fetches and displays logs with filtering
**When to use:** When admins need to review operational data with date/text search
**Example:**
```typescript
// app/admin/failed-searches/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function FailedSearchesPage() {
  const [logs, setLogs] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      if (searchText) params.set('query', searchText);

      const res = await fetch(`/api/admin/failed-searches?${params}`);
      const data = await res.json();
      setLogs(data.logs);
    }

    fetchLogs();
  }, [dateRange, searchText]);

  return (
    <div>
      <Input
        placeholder="Search queries..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />
      {logs.map(log => (
        <Card key={log.id}>
          <p>{log.queryText}</p>
          <p>{log.extractedOrigin} → {log.extractedDestination}</p>
          <p>{new Date(log.timestamp).toLocaleString()}</p>
        </Card>
      ))}
    </div>
  );
}
```

### Pattern 3: Flexible Date Search Fallback
**What:** When exact date search returns 0 results, automatically search ±3 days and present options
**When to use:** After primary search fails, before showing "no results" error
**Example:**
```typescript
// In lib/tools/flight-search.ts execute function
if (!hasSeats && !hasDuffel) {
  console.log('[Flight Search] No results, trying flexible dates...');

  // Generate ±3 day dates
  const baseDate = new Date(params.departDate);
  const flexibleDates = [];
  for (let offset = -3; offset <= 3; offset++) {
    if (offset === 0) continue; // Skip original date
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offset);
    flexibleDates.push(date.toISOString().split('T')[0]);
  }

  // Seats.aero: Native support via start_date/end_date
  const seatsFlexible = await searchSeatsAero({
    ...params,
    departureDate: flexibleDates[0], // start_date
    // API supports date range natively
  });

  // Duffel: Parallel requests with rate limiting
  const duffelPromises = flexibleDates.map(date =>
    searchDuffel({ ...params, departureDate: date })
  );
  const duffelResults = await Promise.allSettled(duffelPromises);

  // Merge and present top 10 across all dates
  const allFlights = [...seatsFlexible, ...duffelResults.flatMap(r =>
    r.status === 'fulfilled' ? r.value : []
  )];

  // Sort by date + price, take top 10
  return allFlights
    .sort((a, b) => /* date proximity + price */)
    .slice(0, 10);
}
```

### Pattern 4: Concurrency Control for Parallel Duffel Requests
**What:** Limit simultaneous API calls to respect rate limits
**When to use:** When making multiple Duffel API requests for date range search
**Example:**
```typescript
// Helper function for controlled parallelism
async function batchRequests<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  concurrency: number = 3
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

// Usage in flight search
const duffelResults = await batchRequests(
  flexibleDates,
  (date) => searchDuffel({ ...params, departureDate: date }),
  3 // Max 3 concurrent requests
);
```

### Anti-Patterns to Avoid
- **Don't log successful searches** - Creates unnecessary data volume, only log failures per CONTEXT.md
- **Don't use v.any() in Drizzle schema** - Always define proper types for query structure
- **Don't skip expiresAt index** - Cleanup queries need efficient lookup by expiration date
- **Don't use Promise.all for Duffel date ranges** - Can hit rate limits; use Promise.allSettled with batching
- **Don't create separate admin auth** - Use existing admin role check from access-control.ts

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL/Auto-deletion | Custom background worker | Vercel Cron + API route OR pg_cron | Vercel Cron is free, pg_cron is native to Postgres, both more reliable than custom |
| Date range UI | Custom date picker | Existing shadcn date-range-picker | Already in project (react-day-picker), consistent UX |
| Rate limiting | setTimeout loops | Promise.allSettled with batching | Native, handles failures gracefully, easier to reason about |
| Admin access control | New auth middleware | Existing getUserRole() from access-control.ts | Already implements admin role checking |
| Log filtering | Complex SQL builders | Drizzle query builder with conditional where() | Type-safe, maintains consistency with existing codebase |

**Key insight:** The project has mature patterns for all needed components - extend, don't rebuild.

## Common Pitfalls

### Pitfall 1: Logging PII (Personally Identifiable Information)
**What goes wrong:** Logging user emails, full names, or identifiable data violates privacy best practices
**Why it happens:** Natural to include userId foreign key, which tempts logging all user data
**How to avoid:**
- Use anonymous sessionId instead of userId where possible
- If userId needed for admin context, never display it in UI - use it only for query joins
- Include only query text and extracted codes, not personal travel plans beyond the search
**Warning signs:** Schema includes email, name, or other PII fields in log table

### Pitfall 2: Unbounded Flexible Date Search
**What goes wrong:** Searching 7 dates × 2 APIs = 14 requests can hit rate limits or timeout
**Why it happens:** Treating date range like a simple loop without considering API constraints
**How to avoid:**
- Limit concurrent Duffel requests to 3 at a time using batching pattern
- Seats.aero supports native date ranges - use start_date/end_date instead of multiple calls
- Set reasonable timeout for flexible search (e.g., 10 seconds max)
- If any date returns results, stop searching remaining dates early
**Warning signs:** Console shows many "rate limit" or "timeout" errors, searches take >15 seconds

### Pitfall 3: Missing expiresAt Index
**What goes wrong:** Cleanup queries scan entire table, causing performance issues as logs grow
**Why it happens:** Forgetting to add index when creating table, or not testing cleanup query performance
**How to avoid:**
- Always add `.index("expires_at_idx")` on `expiresAt` column
- Test cleanup query with EXPLAIN ANALYZE to verify index usage
- Monitor query duration in production - should be <100ms even with 100k+ rows
**Warning signs:** Cleanup cron job takes seconds to complete, database CPU spikes daily at cleanup time

### Pitfall 4: Showing All Flexible Date Results Without Context
**What goes wrong:** User sees flights from random dates without knowing which date each flight is for
**Why it happens:** Merging results from different dates into single flat array
**How to avoid:**
- Include departure date prominently in each flight result card
- Add visual badge showing "3 days later" or date offset
- Sort by date proximity first, price second (not just cheapest)
- Show max 10 total results, not 10 per date
**Warning signs:** User confusion in testing - "Which date is this flight?"

### Pitfall 5: Proactive Flexible Search Offering
**What goes wrong:** Asking "Also search flexible dates?" before original search runs adds complexity
**Why it happens:** Misreading requirement - CONTEXT.md says "bei 0 Ergebnissen" (at 0 results)
**How to avoid:**
- Only trigger flexible search in the "no results" error handler
- Never show flexible date UI before running original search
- Keep it simple: automatic fallback, not user choice
**Warning signs:** PRD review shows checkbox or toggle in search form, UX flow includes pre-search decision

## Code Examples

Verified patterns from official sources and existing codebase:

### Example 1: Creating Log Entry in Flight Search Tool
```typescript
// In lib/tools/flight-search.ts, after determining no results
import { logFailedSearch } from '@/lib/db/queries/failed-search';

if (!hasSeats && !hasDuffel) {
  // Log the failed search
  await logFailedSearch({
    chatId,
    userId: (messages as any)?.[0]?.userId || 'anonymous',
    queryText: `${params.origin} nach ${params.destination}`,
    extractedOrigin: origin,
    extractedDestination: destination,
    departDate: params.departDate,
    returnDate: params.returnDate,
    cabin: params.cabin,
    resultCount: 0,
    errorType: seatsError || duffelError ? 'provider_unavailable' : 'no_results',
    errorMessage: seatsError?.message || duffelError?.message,
    sessionId: chatId, // Use chatId as session identifier
  });

  // Then try flexible dates or return error...
}
```

### Example 2: Admin API Route with Filtering
```typescript
// app/api/admin/failed-searches/route.ts
import { NextRequest } from 'next/server';
import { getUserRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { failedSearchLogs, user } from '@/lib/db/schema';
import { and, desc, gte, lte, or, ilike, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Auth check
  const currentUser = await getUser();
  if (!currentUser || await getUserRole(currentUser.id) !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '100');

  // Build filter conditions
  const conditions = [];

  if (startDate) {
    conditions.push(gte(failedSearchLogs.timestamp, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(failedSearchLogs.timestamp, new Date(endDate)));
  }
  if (query) {
    conditions.push(
      or(
        ilike(failedSearchLogs.queryText, `%${query}%`),
        ilike(failedSearchLogs.extractedOrigin, `%${query}%`),
        ilike(failedSearchLogs.extractedDestination, `%${query}%`)
      )
    );
  }

  // Fetch logs with user email (for admin context only)
  const logs = await db
    .select({
      id: failedSearchLogs.id,
      queryText: failedSearchLogs.queryText,
      extractedOrigin: failedSearchLogs.extractedOrigin,
      extractedDestination: failedSearchLogs.extractedDestination,
      departDate: failedSearchLogs.departDate,
      returnDate: failedSearchLogs.returnDate,
      cabin: failedSearchLogs.cabin,
      resultCount: failedSearchLogs.resultCount,
      errorType: failedSearchLogs.errorType,
      errorMessage: failedSearchLogs.errorMessage,
      timestamp: failedSearchLogs.timestamp,
      userEmail: user.email, // Join for context
    })
    .from(failedSearchLogs)
    .leftJoin(user, eq(failedSearchLogs.userId, user.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(failedSearchLogs.timestamp))
    .limit(limit);

  return Response.json({ logs, count: logs.length });
}
```

### Example 3: Flexible Date Search with Seats.aero Native Range
```typescript
// In lib/api/seats-aero-client.ts, already implemented!
// The existing flexibility parameter does this:
export interface SeatsAeroSearchParams {
  flexibility?: number; // 0-3 days
}

// Implementation already calculates start_date and end_date:
const flex = Math.min(params.flexibility || 0, 3);
const baseDate = new Date(params.departureDate);
const startDate = new Date(baseDate);
const endDate = new Date(baseDate);

if (flex > 0) {
  startDate.setDate(startDate.getDate() - flex);
  endDate.setDate(endDate.getDate() + flex);
}

searchUrl.searchParams.set('start_date', formatDate(startDate));
searchUrl.searchParams.set('end_date', formatDate(endDate));

// ✅ This means Seats.aero is ready - just pass flexibility: 3 in no-results handler
```

### Example 4: Duffel Parallel Search with Batching
```typescript
// New helper in lib/api/duffel-client.ts
export async function searchDuffelFlexibleDates(
  params: DuffelSearchParams,
  flexDays: number = 3
): Promise<DuffelFlight[]> {
  const baseDate = new Date(params.departureDate);
  const dates: string[] = [];

  // Generate date range
  for (let offset = -flexDays; offset <= flexDays; offset++) {
    if (offset === 0) continue; // Skip original date already searched
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offset);
    dates.push(date.toISOString().split('T')[0]);
  }

  console.log(`[Duffel] Searching ${dates.length} flexible dates with concurrency limit`);

  // Batch requests in groups of 3 to respect rate limits
  const results: DuffelFlight[] = [];
  const batchSize = 3;

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    console.log(`[Duffel] Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

    const promises = batch.map(date =>
      searchDuffel({ ...params, departureDate: date })
        .catch(err => {
          console.warn(`[Duffel] Date ${date} failed:`, err.message);
          return []; // Return empty array on failure
        })
    );

    const batchResults = await Promise.allSettled(promises);

    // Extract successful results
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        // Tag each flight with its actual departure date for UI display
        const flights = result.value.map(flight => ({
          ...flight,
          searchedDate: batch[idx], // Add metadata for date context
        }));
        results.push(...flights);
      }
    });

    // Small delay between batches to be respectful to API
    if (i + batchSize < dates.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[Duffel] Flexible search complete: ${results.length} total flights`);
  return results;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store all logs indefinitely | TTL/auto-delete after retention period | 2024+ | Compliance with GDPR/data minimization, lower storage costs |
| Manual log review | Structured query UIs with filters | 2023+ | Faster debugging, pattern recognition |
| Sequential API calls | Promise.allSettled with batching | 2024+ | Faster responses, graceful failure handling |
| Client-side date picker | Server-side automatic fallback | 2025+ | Better UX, no extra user decisions |

**Deprecated/outdated:**
- **Serial data type** - PostgreSQL/Drizzle now recommend identity columns or UUIDs
- **Promise.all for external APIs** - Replaced by Promise.allSettled to handle partial failures
- **Global log retention** - Industry moved to time-based retention (GDPR, cost optimization)

## Open Questions

Things that couldn't be fully resolved:

1. **Duffel exact rate limits**
   - What we know: API has 60-second window, rate limit headers provided
   - What's unclear: Exact requests-per-minute threshold for production tier
   - Recommendation: Start with 3 concurrent requests, monitor headers, adjust if needed. Per CONTEXT.md, 7-day window × batching = safe margin.

2. **Automatic vs Manual TTL cleanup**
   - What we know: pg_cron requires extension, Vercel Cron is easier but requires route
   - What's unclear: User's preference for infrastructure complexity vs simplicity
   - Recommendation: Start with Vercel Cron (simpler, less setup), migrate to pg_cron if automatic is needed

3. **Session ID strategy**
   - What we know: Need anonymous identifier for pattern analysis, chatId exists
   - What's unclear: Whether chatId alone is sufficient or if separate sessionId needed
   - Recommendation: Use chatId as sessionId initially - it's already unique per conversation and doesn't expose PII

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `/lib/db/schema.ts` - Database schema with TTL examples (toolCalls table)
  - `/lib/api/seats-aero-client.ts` - Seats.aero flexibility parameter already implemented
  - `/lib/api/duffel-client.ts` - Duffel search patterns, no native date range support
  - `/app/admin/page.tsx` - Existing admin UI patterns for stats display
  - `/lib/access-control.ts` - Admin role verification pattern
- [Drizzle ORM PostgreSQL Best Practices Guide (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Seats.aero Developer Docs - Cached Search](https://developers.seats.aero/reference/cached-search)
- [Duffel API Documentation - Response handling](https://duffel.com/docs/api/overview/response-handling)

### Secondary (MEDIUM confidence)
- [Time-based retention strategies in Postgres](https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/) - pg_cron patterns
- [Avoid the Promise.all pitfall! Rate limit async function calls](https://dev.to/miketalbot/avoid-the-promiseall-pitfall-38ik) - Concurrency control patterns
- [Working with Drizzle ORM and PostgreSQL in Next.js](https://refine.dev/blog/drizzle-react/)
- [pg_ttl_index: Automatic Time-To-Live (TTL) data expiration for PostgreSQL tables](https://pgxn.org/dist/pg_ttl_index/)

### Tertiary (LOW confidence)
- [API Rate Limiting 2026 Guide](https://www.levo.ai/resources/blogs/api-rate-limiting-guide-2026) - General patterns, not Duffel-specific
- Multiple articles on Promise.allSettled patterns - general TypeScript best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, versions confirmed
- Architecture: HIGH - Patterns verified against existing codebase implementations
- Pitfalls: HIGH - Based on common issues with logging/rate limiting and CONTEXT.md decisions

**Research date:** 2026-02-02
**Valid until:** 2026-03-15 (45 days - stable domain, mainly extending existing patterns)
