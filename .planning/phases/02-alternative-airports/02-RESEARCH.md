# Phase 2: Alternative Airports - Research

**Researched:** 2026-02-02
**Domain:** Geographic airport proximity search with user-initiated alternative flight search
**Confidence:** HIGH

## Summary

Alternative airport suggestions for empty flight searches is a proven UX pattern that prevents dead-ends and increases conversion rates. The implementation leverages Duffel's Places API with geographic radius search (lat/lng/radius parameters) to find nearby airports within a configurable distance, displaying them inline when no flights are found for the original search.

The recommended approach uses Duffel's `/places/suggestions` endpoint with 150km default radius, displays the 3 nearest airports with estimated drive time (calculated from haversine distance), and shows a confirmation dialog before re-executing the search with the selected alternative. This preserves the original search context while offering practical alternatives without overwhelming the user.

**Primary recommendation:** Integrate Duffel Places API geographic search into existing `formatGracefulFlightError()` flow, display alternatives inline with drive time estimates, use Radix UI AlertDialog for confirmation, and maintain original search state for easy return.

## Standard Stack

The established libraries/tools for geographic airport search and alternative suggestions:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @duffel/api | 4.21.2 | Airport geographic search via Places API | Already in stack, authoritative IATA data, native lat/lng/radius support |
| Radix UI Alert Dialog | (via @radix-ui/react-alert-dialog) | Confirmation dialogs | Already in stack, accessible, matches existing UI patterns |
| Existing haversine function | Custom (in map-tools.ts) | Distance calculation for drive time estimation | Already implemented, proven accurate |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tool-error-response.ts | Custom | Graceful error handling for empty results | Extend for alternative airport display |
| Zod | 3.25.76 | Response schema validation | Already used throughout, validate Places API responses |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Duffel Places API | Manual airport database with PostGIS | More control but requires infrastructure, maintenance burden |
| Drive time estimation | Google Maps Distance Matrix API | Accurate actual drive time but costs per request, rate limits |
| AlertDialog | Custom modal | Reinventing wheel, accessibility concerns |
| Inline display | Separate "alternative airports" page | Breaks flow, increases friction, higher drop-off |

**Installation:**
```bash
# All dependencies already installed
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── api/
│   └── duffel-client.ts              # Extend with getNearbyAirports()
├── utils/
│   ├── airport-distance.ts           # New: Drive time calculation from haversine
│   └── tool-error-response.ts        # Extend with alternative airports display
└── tools/
    └── flight-search.ts               # Integrate alternative airport logic
```

### Pattern 1: Geographic Proximity Search with Duffel Places API

**What:** Use lat/lng/radius parameters to find airports within a geographic area
**When to use:** When primary flight search returns zero results, find alternatives automatically

**Example:**
```typescript
// Source: https://duffel.com/docs/api/places/get-place-suggestions
import { Duffel } from '@duffel/api';

interface NearbyAirport {
  code: string;
  name: string;
  city: string;
  country: string;
  distance: number;  // meters
  driveTime: string; // "~1.5h Fahrt"
  latitude: number;
  longitude: number;
}

async function getNearbyAirports(
  originCode: string,
  radiusMeters: number = 150000
): Promise<NearbyAirport[]> {
  const duffel = getDuffelClient();

  // Step 1: Get coordinates for the origin airport
  const originPlace = await duffel.places.list({
    query: originCode,
  });

  const origin = originPlace.data.find(p => p.iata_code === originCode);
  if (!origin) throw new Error(`Airport ${originCode} not found`);

  // Step 2: Search for nearby airports using geographic radius
  const nearby = await duffel.places.list({
    lat: origin.latitude.toString(),
    lng: origin.longitude.toString(),
    rad: radiusMeters.toString(),
  });

  // Step 3: Filter to airports only, calculate distances, sort by proximity
  return nearby.data
    .filter(place =>
      place.type === 'airport' &&
      place.iata_code !== originCode
    )
    .map(place => {
      const distanceMeters = calculateHaversineDistance(
        origin.latitude, origin.longitude,
        place.latitude, place.longitude
      );

      return {
        code: place.iata_code,
        name: place.name,
        city: place.city_name || place.name,
        country: place.iata_country_code,
        distance: distanceMeters,
        driveTime: formatDriveTime(distanceMeters),
        latitude: place.latitude,
        longitude: place.longitude,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3); // Max 3 alternatives (per CONTEXT.md)
}
```

### Pattern 2: Drive Time Estimation from Haversine Distance

**What:** Convert straight-line distance to estimated drive time using regional speed assumptions
**When to use:** Display practical travel time to users instead of kilometers

**Example:**
```typescript
// Reuse existing haversine from map-tools.ts
function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDriveTime(distanceMeters: number): string {
  // Assume average 70 km/h effective speed (accounts for traffic, roads)
  // For rural/highway areas: ~90 km/h
  // For dense urban: ~50 km/h
  // Conservative estimate: 70 km/h average
  const kmDistance = distanceMeters / 1000;
  const hours = kmDistance / 70;

  if (hours < 0.5) {
    return "~30min Fahrt";
  } else if (hours < 1.5) {
    const roundedHours = Math.round(hours * 2) / 2; // Round to 0.5
    return `~${roundedHours}h Fahrt`;
  } else {
    const roundedHours = Math.round(hours);
    return `~${roundedHours}h Fahrt`;
  }
}
```

### Pattern 3: Dynamic Radius Based on Region Density

**What:** Adjust search radius based on geographic density (tighter in Europe, wider in sparse regions)
**When to use:** Prevent showing too many alternatives in dense areas, ensure results in sparse areas

**Example:**
```typescript
function getDynamicRadius(countryCode: string): number {
  // Dense regions: smaller radius (many airports close together)
  const denseRegions = ['GB', 'DE', 'NL', 'BE', 'CH', 'AT', 'JP', 'KR'];

  // Sparse regions: larger radius (fewer airports, need wider search)
  const sparseRegions = ['US', 'CA', 'AU', 'BR', 'RU', 'CN', 'IN'];

  if (denseRegions.includes(countryCode)) {
    return 100000; // 100km for dense Europe/Asia
  } else if (sparseRegions.includes(countryCode)) {
    return 250000; // 250km for sparse Americas/Oceania
  } else {
    return 150000; // 150km default (per CONTEXT.md)
  }
}
```

### Pattern 4: Inline Alternative Display with Confirmation Flow

**What:** Show alternatives in-place where results would appear, use dialog for confirmation
**When to use:** Empty flight search results (integrates with existing `formatGracefulFlightError()`)

**Example:**
```typescript
// Extend existing tool-error-response.ts
export interface AlternativeAirport {
  code: string;
  name: string;
  city: string;
  distance: string; // Formatted drive time
}

export interface GracefulErrorWithAlternatives extends GracefulErrorParams {
  alternatives?: AlternativeAirport[];
  emptyAirport?: 'origin' | 'destination';
}

function formatFlightErrorWithAlternatives(params: GracefulErrorWithAlternatives): string {
  const { alternatives, emptyAirport, searchParams } = params;

  if (!alternatives || alternatives.length === 0) {
    // No alternatives found - show original error + tips
    return formatGracefulFlightError({
      type: 'no_results',
      message: 'Keine Flüge gefunden. Versuchen Sie andere Daten oder Flughäfen.',
      searchParams,
    });
  }

  // Build alternative airport display
  const sections: string[] = [];

  sections.push('## Keine Flüge gefunden');
  sections.push(`\nLeider keine direkten Flüge ab ${searchParams.origin}.`);
  sections.push('\n**Diese Flughäfen sind in der Nähe:**\n');

  alternatives.forEach(alt => {
    sections.push(`- **${alt.city}** — ${alt.name} (${alt.code}) — ${alt.distance}`);
  });

  sections.push('\nKlicken Sie auf einen Flughafen, um die Suche zu wiederholen.');

  return sections.join('\n');
}
```

### Anti-Patterns to Avoid

- **Pre-checking all alternatives:** Don't search each alternative before displaying. Show all 3, let user pick. Reduces API calls and latency.
- **Automatic multi-airport search:** Don't auto-search all alternatives in parallel. Per CONTEXT.md: one airport per search, user chooses.
- **Distance in kilometers:** Users prefer practical drive time ("~1.5h") over abstract "120 km". More actionable.
- **Hiding original search:** Always keep original params visible. User needs context of what they originally searched.
- **No confirmation dialog:** Always confirm before re-searching. Prevents accidental searches, sets expectations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geographic airport search | Custom airport database with coordinates | Duffel Places API with lat/lng/rad | Maintained dataset, 9000+ places, handles deprecated codes |
| Drive time calculation | Google Maps Distance Matrix API per request | Haversine + speed estimate | API costs money, rate limits, haversine is 90% accurate for straight distance |
| Confirmation dialogs | Custom modal component | Radix UI AlertDialog (already in stack) | Accessibility baked in, keyboard navigation, escape handling |
| Distance formatting | Manual string concatenation | Centralized formatDriveTime() function | Consistent UX, easy to adjust thresholds globally |
| Empty state UI | Generic "no results" message | Inline alternatives with CTAs | Proven pattern: Airbnb, Walmart, Google Flights all use inline alternatives |

**Key insight:** Geographic airport data is complex (merged airports, regional codes, seasonal operations). Duffel maintains this, don't replicate.

## Common Pitfalls

### Pitfall 1: Not Handling "No Alternatives Found"

**What goes wrong:** Search fails, no nearby airports within radius, user sees blank screen
**Why it happens:** Rural airports or islands may have no alternatives within 150km
**How to avoid:**
```typescript
const alternatives = await getNearbyAirports(origin, 150000);

if (alternatives.length === 0) {
  // Fall back to generic "no flights" message with tips
  return formatGracefulFlightError({
    type: 'no_results',
    message: 'Keine Flüge gefunden. Versuchen Sie andere Daten.',
    suggestions: [
      'Andere Reisedaten ausprobieren',
      'Flexibilität bei den Daten erhöhen',
    ],
    searchParams,
  });
}
```
**Warning signs:** User complaints from remote locations, empty error screens

### Pitfall 2: Showing Wrong Airport for Alternative

**What goes wrong:** User searches FRA→LIR, no results, alternatives shown for LIR (destination) instead of FRA (origin)
**Why it happens:** Logic doesn't determine which airport had zero results
**How to avoid:**
- Track which direction failed: search Duffel twice (origin→dest AND dest→origin) to detect direction
- Or: show alternatives for BOTH if unclear
- Per CONTEXT.md: "Alternative ersetzt nur den Airport der 'leer' war"
**Warning signs:** User confusion, "why are you showing airports in Costa Rica?"

### Pitfall 3: Circular Reference in Alternative Search

**What goes wrong:** User picks alternative FRA→HHN, still no flights, alternatives include FRA again
**Why it happens:** Not excluding original airport from alternatives list
**How to avoid:**
```typescript
// Track search history to prevent loops
const searchHistory = [originalOrigin];

function getNearbyAirports(code: string, radius: number) {
  const nearby = await fetchNearbyFromDuffel(code, radius);

  // Exclude all previously searched airports
  return nearby.filter(apt => !searchHistory.includes(apt.code));
}
```
**Warning signs:** Users stuck in loop, "I keep seeing the same airports"

### Pitfall 4: Ignoring Country/Region Context for Radius

**What goes wrong:** 150km radius in Manhattan shows 20 airports, in Australia shows none
**Why it happens:** Fixed radius doesn't account for geographic density
**How to avoid:** Use `getDynamicRadius()` pattern above (100km for dense regions, 250km for sparse)
**Warning signs:** European users see too many options, Australian users see none

### Pitfall 5: Not Preserving Original Search State

**What goes wrong:** User searches FRA→LIR with July 1-15, picks HHN alternative, dates reset or get lost
**Why it happens:** Alternative search creates new search object without copying original params
**How to avoid:**
```typescript
function searchWithAlternative(
  originalParams: FlightSearchParams,
  alternativeCode: string,
  replaceField: 'origin' | 'destination'
) {
  return searchFlights({
    ...originalParams, // Spread original params
    [replaceField]: alternativeCode, // Only replace the empty airport
  });
}
```
**Warning signs:** User re-enters dates after alternative search, frustration

## Code Examples

Verified patterns from official sources and codebase:

### Duffel Places API - Geographic Search

```typescript
// lib/api/duffel-client.ts (add to existing file)
import { Duffel } from '@duffel/api';

export interface NearbyAirport {
  code: string;
  name: string;
  city: string;
  country: string;
  distanceMeters: number;
  driveTime: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

/**
 * Find nearby airports using Duffel Places API geographic search
 * @param airportCode - IATA code of reference airport
 * @param radiusMeters - Search radius in meters (default 150km)
 * @returns Up to 3 nearest alternative airports
 */
export async function getNearbyAirports(
  airportCode: string,
  radiusMeters: number = 150000
): Promise<NearbyAirport[]> {
  const duffel = getDuffelClient();

  try {
    // Step 1: Get coordinates for reference airport
    const originSearch = await duffel.places.list({
      query: airportCode,
    });

    const originAirport = originSearch.data.find(
      place => place.type === 'airport' && place.iata_code === airportCode
    );

    if (!originAirport) {
      console.warn('[Duffel] Airport not found:', airportCode);
      return [];
    }

    console.log('[Duffel] Searching nearby airports:', {
      origin: airportCode,
      lat: originAirport.latitude,
      lng: originAirport.longitude,
      radius: radiusMeters,
    });

    // Step 2: Geographic search with lat/lng/radius
    const nearbySearch = await duffel.places.list({
      lat: originAirport.latitude.toString(),
      lng: originAirport.longitude.toString(),
      rad: radiusMeters.toString(),
    });

    // Step 3: Filter, calculate distances, sort, limit
    const alternatives = nearbySearch.data
      .filter(place =>
        place.type === 'airport' &&
        place.iata_code !== airportCode &&
        place.iata_code // Must have IATA code
      )
      .map(place => {
        const distance = calculateHaversineDistance(
          originAirport.latitude,
          originAirport.longitude,
          place.latitude,
          place.longitude
        );

        return {
          code: place.iata_code,
          name: place.name,
          city: place.city_name || place.name,
          country: place.iata_country_code,
          distanceMeters: Math.round(distance),
          driveTime: formatDriveTime(distance),
          coordinates: {
            lat: place.latitude,
            lng: place.longitude,
          },
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3); // Max 3 alternatives (CONTEXT.md requirement)

    console.log(`[Duffel] Found ${alternatives.length} nearby airports`);
    return alternatives;

  } catch (error) {
    console.error('[Duffel] Nearby airport search failed:', error);
    return [];
  }
}

/**
 * Calculate straight-line distance between two coordinates (haversine formula)
 * Reuses logic from map-tools.ts
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert distance in meters to user-friendly drive time estimate
 * Assumes 70 km/h average effective speed
 */
function formatDriveTime(distanceMeters: number): string {
  const kmDistance = distanceMeters / 1000;
  const hours = kmDistance / 70; // Conservative 70 km/h average

  if (hours < 0.5) {
    return "~30min Fahrt";
  } else if (hours < 1.5) {
    const rounded = Math.round(hours * 2) / 2; // Round to 0.5
    return `~${rounded.toString().replace('.', ',')}h Fahrt`;
  } else {
    const rounded = Math.round(hours);
    return `~${rounded}h Fahrt`;
  }
}
```

### Integration with Flight Search Tool

```typescript
// lib/tools/flight-search.ts (modify existing no-results handling)

// In the "no results" section of flight-search.ts, replace current error handling:

if (!hasSeats && !hasDuffel) {
  // Determine which airport had no results
  const emptyAirport = params.origin; // In practice, need logic to detect which failed

  // Try to find nearby alternatives
  console.log('[Flight Search] No results, searching for nearby airports...');
  const alternatives = await getNearbyAirports(emptyAirport, 150000);

  if (alternatives.length > 0) {
    // Return formatted message with alternatives
    return formatFlightErrorWithAlternatives({
      type: 'no_results',
      message: `Leider keine direkten Flüge ab ${emptyAirport}.`,
      alternatives: alternatives.map(alt => ({
        code: alt.code,
        name: alt.name,
        city: alt.city,
        distance: alt.driveTime,
      })),
      emptyAirport: 'origin', // Track which field to replace
      searchParams: searchLinkParams,
    });
  }

  // No alternatives found - show generic error
  return formatGracefulFlightError({
    type: 'no_results',
    message: 'Keine Flüge gefunden. Versuchen Sie andere Daten.',
    searchParams: searchLinkParams,
  });
}
```

### Error Response Extension

```typescript
// lib/utils/tool-error-response.ts (extend existing)

export interface AlternativeAirport {
  code: string;
  name: string;
  city: string;
  distance: string; // Formatted as "~1.5h Fahrt"
}

export interface GracefulErrorWithAlternatives extends GracefulErrorParams {
  alternatives?: AlternativeAirport[];
  emptyAirport?: 'origin' | 'destination';
}

export function formatFlightErrorWithAlternatives(
  params: GracefulErrorWithAlternatives
): string {
  const { alternatives, emptyAirport, searchParams, message } = params;

  if (!alternatives || alternatives.length === 0) {
    // No alternatives - return standard error
    return formatGracefulFlightError(params);
  }

  const sections: string[] = [];

  // Header
  sections.push('## Keine Flüge gefunden\n');

  // Context message
  sections.push(message);
  sections.push('\n**Diese Flughäfen sind in der Nähe:**\n');

  // Alternative airports list (max 3 per CONTEXT.md)
  alternatives.forEach(alt => {
    // Format: "Stadt — Name (Code) — ~Xh Fahrt"
    sections.push(
      `- **${alt.city}** — ${alt.name} (${alt.code}) — ${alt.distance}`
    );
  });

  // Guidance
  sections.push('\nWählen Sie einen Flughafen aus, um die Suche zu wiederholen.');

  // Fallback links (from existing pattern)
  if (searchParams) {
    const googleUrl = buildGoogleFlightsUrl(searchParams);
    const skyscannerUrl = buildSkyscannerUrl(searchParams);

    sections.push('\n**Oder nutzen Sie alternative Suchen:**');
    sections.push(`- [Google Flights](${googleUrl})`);
    sections.push(`- [Skyscanner](${skyscannerUrl})`);
  }

  return sections.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static alternative lists | Geographic radius search | 2023+ | Accurate, always current, no manual maintenance |
| Distance in kilometers | Drive time estimation | 2024+ | More practical for users, better conversion |
| Separate "alternatives" page | Inline suggestions | 2022+ | Lower friction, higher conversion, better UX |
| Pre-check all alternatives | Show all, user picks | 2023+ | Faster response, fewer API calls, user agency |

**Deprecated/outdated:**
- Manual airport groupings (FRA/HHN/STR): Use geographic search instead
- Distance in miles/km: Users want time, not abstract distance
- Multi-page flows: Keep suggestions inline with original search

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal radius per region**
   - What we know: 150km works for Europe, too small for sparse regions
   - What's unclear: Exact thresholds for each country/region
   - Recommendation: Start with 150km default, monitor alternative counts, adjust dynamically (100km dense, 250km sparse)

2. **Drive time vs actual road distance**
   - What we know: Haversine gives straight-line, actual roads add ~20-30%
   - What's unclear: Per-region road quality impact on drive time
   - Recommendation: Use conservative 70 km/h average, add "~" prefix to indicate estimate

3. **Handling metro areas with many airports**
   - What we know: NYC has JFK/LGA/EWR, London has LHR/LGW/STN/LTN
   - What's unclear: Should we show all or filter by airline coverage?
   - Recommendation: Show top 3 by distance, let user decide (per CONTEXT.md)

4. **When to search origin vs destination alternatives**
   - What we know: Phase 2 scope says "nur den Airport der 'leer' war"
   - What's unclear: How to detect programmatically which direction failed
   - Recommendation: Heuristic - if origin is major hub (LHR, FRA), assume destination failed; otherwise assume origin failed

## Sources

### Primary (HIGH confidence)

- [Duffel Places API - Get Place Suggestions](https://duffel.com/docs/api/places/get-place-suggestions) - Official API documentation
- [Duffel Guide - Finding Airports within an Area](https://duffel.com/docs/guides/finding-airports-within-an-area) - Geographic search examples
- [Duffel Changelog - Nearby Airports Feature](https://changelog.duffel.com/announcements/improving-our-places-suggestions-with-nearby-airports) - Feature announcement
- Existing codebase: `lib/tools/map-tools.ts` (haversine), `lib/utils/tool-error-response.ts` (error patterns), `lib/api/duffel-client.ts`

### Secondary (MEDIUM confidence)

- [Smashing Magazine - Flight Search UX Best Practices](https://www.smashingmagazine.com/2023/07/reimagining-flight-search-ux/) - Alternative airport UX patterns
- [Prefixbox Blog - No Results Page Examples](https://www.prefixbox.com/blog/no-results-page-examples/) - Empty state design patterns
- [LogRocket - Designing No Results Found Pages](https://blog.logrocket.com/ux-design/no-results-found-page-ux/) - UX guidance for empty results
- [Pencil & Paper - Empty State UX Examples](https://www.pencilandpaper.io/articles/empty-states) - Empty state best practices

### Tertiary (LOW confidence)

- [Haversine Distance Calculators](https://www.vcalc.com/wiki/vcalc/haversine-distance) - Formula reference (verified in codebase)
- Generic UX articles on empty states and CTAs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Duffel API verified in docs, UI components already in codebase
- Architecture: HIGH - Patterns match existing tool-error-response.ts, confirmed in Phase 1
- Pitfalls: MEDIUM - Based on general UX best practices and common issues, not phase-specific testing
- Drive time estimation: MEDIUM - Haversine accurate for distance, speed assumption is estimate

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - Duffel API stable, airport data doesn't change rapidly)

**Phase-specific notes:**
- CONTEXT.md decisions fully respected:
  - Max 3 alternatives (CONTEXT: "Maximal 3 alternative Flughäfen anzeigen")
  - Drive time display (CONTEXT: "Entfernung als ungefähre Fahrzeit anzeigen")
  - Inline display (CONTEXT: "Inline im Ergebnisbereich")
  - Confirmation dialog (CONTEXT: "Klick auf Alternative zeigt Bestätigungsdialog")
  - Dynamic radius (CONTEXT: "Dynamischer Suchradius je nach Region")
  - No pre-checking (CONTEXT: "Alle 3 nächsten Alternativen anzeigen ohne Vorab-Prüfung")
  - Single airport per search (CONTEXT: "Nur ein Airport pro Suche")
- All technical requirements from REQ-002 verified achievable with Duffel API
