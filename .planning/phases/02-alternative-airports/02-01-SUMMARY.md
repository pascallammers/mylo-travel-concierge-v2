# Phase 02 Plan 01: Alternative Airports API Integration Summary

**One-liner:** Duffel Suggestions API integration with haversine distance calculation and German drive time formatting (~X,Xh Fahrt) for finding and displaying up to 3 nearby airports

---

## Metadata

```yaml
phase: 02-alternative-airports
plan: 01
subsystem: flight-search
tags: [duffel-api, geographic-search, error-handling, user-experience]
status: complete
executed: 2026-02-02
duration: 3 min
```

## What Was Built

### Components Created

1. **getNearbyAirports() - Duffel Suggestions API Integration**
   - Location: `lib/api/duffel-client.ts`
   - Queries Duffel Suggestions API to find airports within dynamic radius
   - Returns up to 3 nearest airports sorted by distance
   - Uses haversine formula for accurate distance calculation
   - Handles errors gracefully by returning empty array

2. **formatFlightErrorWithAlternatives() - Enhanced Error Formatting**
   - Location: `lib/utils/tool-error-response.ts`
   - Formats alternative airports inline with German user messaging
   - Uses em-dash (—) separator matching CONTEXT.md specification
   - Includes clickable alternatives and fallback search links

### Key Features

- **Dynamic radius based on region density:**
  - Dense regions (GB, DE, NL, BE, CH, AT, JP, KR): 100km
  - Sparse regions (US, CA, AU, BR, RU, CN, IN): 250km
  - Default: 150km

- **German drive time formatting:**
  - < 0.5h: "~30min Fahrt"
  - 0.5h - 1.5h: "~X,Xh Fahrt" (rounded to 0.5 increments, comma decimal)
  - > 1.5h: "~Xh Fahrt" (whole hours)
  - Based on 70 km/h average effective speed

- **Alternative airport format:**
  - Pattern: `**City** — Name (CODE) — ~X,Xh Fahrt`
  - Example: `**Hahn** — Frankfurt-Hahn Airport (HHN) — ~1,5h Fahrt`
  - Uses em-dash (—) not hyphen per CONTEXT.md

## Technical Implementation

### Interfaces Added

```typescript
// lib/api/duffel-client.ts
export interface NearbyAirport {
  code: string;
  name: string;
  city: string;
  country: string;
  distanceMeters: number;
  driveTime: string;  // "~1,5h Fahrt"
}

// lib/utils/tool-error-response.ts
export interface AlternativeAirport {
  code: string;
  name: string;
  city: string;
  distance: string;  // Already formatted
}

export interface GracefulErrorWithAlternatives extends GracefulErrorParams {
  alternatives?: AlternativeAirport[];
  emptyAirport?: 'origin' | 'destination';
  originalAirportName?: string;
}
```

### Functions Added

**duffel-client.ts:**
- `calculateHaversineDistance()` - Internal helper for distance calculation
- `formatDriveTime()` - Internal helper for German time formatting
- `getDynamicRadius()` - Exported function for region-aware search radius
- `getNearbyAirports()` - Exported main function for finding alternatives

**tool-error-response.ts:**
- `formatFlightErrorWithAlternatives()` - Exported function for formatting errors with alternatives

## Files Modified

### Created
None - all functionality added to existing files

### Modified
- `lib/api/duffel-client.ts` - Added 167 lines for nearby airport search
- `lib/utils/tool-error-response.ts` - Added 66 lines for alternative airport formatting

## Integration Points

### Exports for Next Phase
- `getNearbyAirports(airportCode, radiusMeters?)` from duffel-client.ts
- `NearbyAirport` interface from duffel-client.ts
- `formatFlightErrorWithAlternatives(params)` from tool-error-response.ts
- `AlternativeAirport` interface from tool-error-response.ts

### Dependencies
- Duffel SDK `suggestions.list()` API for geographic search
- Existing `buildGoogleFlightsUrl()` and `buildSkyscannerUrl()` for fallback links

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use Duffel `suggestions` property (not `places`) | SDK uses `suggestions` as the property name for Places API | Correct API integration |
| Drive time over distance in km | More practical for users to estimate travel time | Better UX, matches CONTEXT.md |
| German decimal comma (X,X) not period | German locale standard | Proper localization |
| Em-dash (—) separator | CONTEXT.md specification | Consistent formatting |
| 70 km/h average speed assumption | Balances highway and urban driving | Reasonable time estimates |
| Return empty array on error | Fail gracefully without breaking flow | Better error handling |
| Max 3 alternatives | Prevents overwhelming user (CONTEXT.md) | Focused suggestions |

## Testing Notes

### Verified
- TypeScript compilation passes for both modified files
- Em-dash character (—) correctly used in format string
- Interface exports are accessible
- Functions have proper type signatures

### Not Tested (Integration Phase)
- Actual Duffel API calls (requires API key)
- End-to-end alternative airport display in UI
- User interaction with alternative suggestions

## Next Steps

**Ready for Plan 02-02:** Integrate these functions into flight-search.ts tool
- Call `getNearbyAirports()` when search returns empty
- Map `NearbyAirport[]` to `AlternativeAirport[]`
- Pass to `formatFlightErrorWithAlternatives()` for display

**Blockers:** None

**Dependencies satisfied:**
- Duffel SDK already installed (4.21.2)
- All helper functions implemented
- Interfaces properly exported

## Performance Metrics

- **Tasks completed:** 2/2
- **Commits:** 2 atomic commits
- **Duration:** 3 minutes (195 seconds)
- **Lines added:** 233 lines total
  - duffel-client.ts: +167
  - tool-error-response.ts: +66

## Deviations from Plan

None - plan executed exactly as written. All tasks completed successfully with proper TypeScript types, German formatting, and em-dash separator as specified.

---

**Plan completed:** 2026-02-02
**Commits:** 9da4370, 884a1c8
**Next plan:** 02-02 (Flight Search Tool Integration)
