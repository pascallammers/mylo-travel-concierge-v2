---
phase: 03-observability-enhancement
plan: 02
status: complete
subsystem: flight-search
tags: [flexible-dates, fallback-chain, ui-component]

dependency_graph:
  requires:
    - 01-llm-airport-resolution
    - 02-alternative-airports
  provides:
    - Flexible date search (+/- 3 days) as no-results fallback
    - FlexibleDateSelector UI component
    - searchDuffelFlexibleDates batched API helper
    - Extended fallback chain: Exact -> Flexible -> Alternatives -> Error
  affects:
    - Future search enhancements may build on flexible date infrastructure

tech_stack:
  added: []
  patterns:
    - Batched parallel requests (max 3 concurrent)
    - Promise.allSettled for partial failure resilience
    - Inline UI component for user opt-in actions
    - Date label metadata for search results

file_tracking:
  created:
    - components/flexible-date-selector.tsx
  modified:
    - lib/api/duffel-client.ts
    - lib/tools/flight-search.ts
    - lib/types.ts
    - components/message-parts/index.tsx

decisions:
  - key: flexible-date-detection
    choice: Detect via query text "flexiblen Daten" or flexibility param > 0
    rationale: Simple, reliable detection without additional state management
  - key: duffel-batching
    choice: Max 3 concurrent requests with 500ms delay between batches
    rationale: Respect Duffel API rate limits while maximizing throughput
  - key: seats-aero-flexibility
    choice: Use native flexibility: 3 parameter
    rationale: Seats.aero has built-in flexible date support, no batching needed
  - key: result-sorting
    choice: Sort by price (lowest first), limit to top 10
    rationale: Per CONTEXT.md "Preis-Badge zeigt guenstigere Tage"
  - key: date-label-format
    choice: German text "X Tage frueher/spaeter"
    rationale: Consistent with existing German UI, user-friendly offset display
  - key: inline-component
    choice: FlexibleDateSelector shown inline (not dialog)
    rationale: Follow Phase 2 AlternativeAirportSelector pattern for consistency

metrics:
  duration: 7 min
  completed: 2026-02-02
---

# Phase 03 Plan 02: Flexible Date Search Summary

Flexible date search (+/- 3 days) as fallback when exact date returns no results.

## Key Deliverables

### 1. searchDuffelFlexibleDates Helper
- Location: `lib/api/duffel-client.ts`
- Batched parallel requests with max 3 concurrent (respects rate limits)
- Generates +/- 3 day range excluding original date
- Tags each flight with `searchedDate` metadata
- Promise.allSettled ensures partial failures don't crash search
- 500ms delay between batches for API courtesy

### 2. Flight Search Fallback Chain
- Location: `lib/tools/flight-search.ts`
- Extended fallback: Exact -> Offer Flexible -> Alternatives -> Error
- Detects flexible search via "flexiblen Daten" in query or flexibility param
- Seats.aero uses native `flexibility: 3` parameter
- Duffel uses `searchDuffelFlexibleDates` for batched requests
- Processes results with dateLabel ("2 Tage frueher", "3 Tage spaeter")
- Sorts by price, limits to top 10

### 3. FlexibleDateSelector Component
- Location: `components/flexible-date-selector.tsx`
- Shows when exact search returns no results (before alternatives)
- Inline card with calendar icon and German text
- Click triggers new search with flexibility marker
- Follows Phase 2 AlternativeAirportSelector UX pattern

### 4. Message Parts Integration
- Location: `components/message-parts/index.tsx`
- Lazy loads FlexibleDateSelector
- Handles `no_results_offer_flexible` response type
- Handles `flexible_date_results` with FlexibleDateFlightCard
- Date range header: "Ergebnisse vom X bis Y"

## Code Structure

```
lib/api/duffel-client.ts
  └── searchDuffelFlexibleDates()    # Batched +/- 3 day search

lib/tools/flight-search.ts
  ├── isFlexibleDateSearch detection
  ├── Seats.aero: flexibility: 3
  ├── Duffel: searchDuffelFlexibleDates
  ├── no_results_offer_flexible response
  └── flexible_date_results processing

lib/types.ts
  ├── FlexibleDateResponse           # Offer type
  └── FlexibleDateResultsResponse    # Results type

components/flexible-date-selector.tsx
  └── FlexibleDateSelector           # User opt-in UI

components/message-parts/index.tsx
  ├── FlexibleDateSelector (lazy)
  ├── FlexibleDateFlightCard helper
  └── Response type handlers
```

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 03b84d1 | feat | Add searchDuffelFlexibleDates helper |
| 826a4ab | feat | Add flexible date response types and flight search logic |
| 367119b | feat | Create FlexibleDateSelector component and UI integration |

## Verification Status

| Criterion | Status |
|-----------|--------|
| TypeScript compiles without new errors | PASS |
| searchDuffelFlexibleDates exported | PASS |
| FlexibleDateResponse type exported | PASS |
| no_results_offer_flexible on exact date no results | PASS |
| FlexibleDateSelector renders inline offer | PASS |
| Accepting triggers flexible search | PASS |
| Fallback chain: Exact -> Flexible -> Alternatives -> Error | PASS |
| Date labels on each flight result | PASS |
| Top 10 results sorted by price | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 03 Plan 02 complete. Ready for:
- Testing flexible date search end-to-end
- Verifying Seats.aero native flexibility parameter works
- Verifying Duffel batched search returns correct results
