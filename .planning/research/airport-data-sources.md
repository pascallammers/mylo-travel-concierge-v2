# Airport Data Sources Research

**Topic:** Alternative airport suggestions for flight search
**Researched:** 2026-02-02
**Overall confidence:** HIGH

## Executive Summary

For implementing "nearby airport" suggestions when flight searches return no results, the recommended approach is a **hybrid strategy**: use the existing Duffel API's Places endpoint for real-time proximity searches, supplemented by a static dataset for metropolitan area groupings and fallback scenarios.

The Duffel API (already integrated in this project) provides a Places Suggestions endpoint that accepts latitude/longitude/radius parameters to find nearby airports. This eliminates the need for a separate API or complex geographic calculations. For metropolitan area groupings (e.g., NYC = JFK+LGA+EWR), a static dataset from lxndrblz/Airports provides city_code mappings.

---

## Research Questions Answered

### 1. Free/Affordable APIs for Airport Data

| API/Source | Cost | Data Fields | Update Frequency | Recommendation |
|------------|------|-------------|------------------|----------------|
| **Duffel Places API** | Free (included with Duffel subscription) | IATA, coordinates, city, country, icao, timezone | Real-time | **PRIMARY** - Already integrated |
| **OurAirports** | Free (Public Domain) | IATA, coordinates, municipality, country, type | Nightly | **SECONDARY** - Static fallback |
| **OpenFlights** | Free (Open Database License) | IATA, coordinates, city, country, timezone | Sporadic | Good but less current |
| **AeroDataBox** | $0-150/month (300-300k calls) | Comprehensive | Real-time | Overkill for this use case |
| **Aviation Edge** | $99-499/month | Comprehensive | Real-time | Too expensive |
| **Amadeus Nearest Relevant** | Free tier available | IATA, coordinates, relevance score | Real-time | Good alternative if not using Duffel |

**Recommendation:** Use Duffel Places API (already have access) + OurAirports static data for fallback.

---

### 2. How to Find Airports Within X km of a Given Airport

**Option A: Duffel Places API (RECOMMENDED)**

The Duffel API already supports geographic proximity searches:

```typescript
// Endpoint: GET https://api.duffel.com/places/suggestions
// Parameters: lat, lng, rad (in meters)

// Example: Find airports within 100km of Lisbon (37.129665, -8.669586)
const response = await fetch(
  'https://api.duffel.com/places/suggestions?lat=37.129665&lng=-8.669586&rad=100000',
  { headers: { 'Authorization': `Bearer ${DUFFEL_API_KEY}` } }
);
```

The response includes airports within the radius, each with coordinates, IATA code, city, and country.

**Option B: Haversine Formula with Static Data**

If API is unavailable, calculate distances locally using the Haversine formula:

```typescript
// NPM packages: haversine-distance, haversine-geolocation
import haversine from 'haversine-distance';

function findNearbyAirports(
  originLat: number,
  originLng: number,
  airports: Airport[],
  radiusKm: number
): Airport[] {
  return airports.filter(airport => {
    const distance = haversine(
      { lat: originLat, lng: originLng },
      { lat: airport.latitude, lng: airport.longitude }
    );
    return distance <= radiusKm * 1000; // haversine returns meters
  });
}
```

Performance: ~200,000-500,000 calculations/second (2-5 microseconds each).

**Confidence:** HIGH - Verified via Duffel documentation and npm package docs.

---

### 3. OpenFlights vs Commercial APIs Comparison

| Criterion | OpenFlights | OurAirports | AeroDataBox | Aviation Edge |
|-----------|-------------|-------------|-------------|---------------|
| **Cost** | Free | Free | $0-150/mo | $99-499/mo |
| **Airports** | ~10,000 | ~12,500 | Comprehensive | Comprehensive |
| **Update Frequency** | Sporadic (user-contributed) | Nightly | Real-time | Real-time |
| **IATA Coverage** | Good | Good (~88% have IATA) | Complete | Complete |
| **Coordinates** | Yes | Yes | Yes | Yes |
| **City Codes** | No | No | Yes | Yes |
| **Metro Groupings** | No | No | Yes | Yes |
| **API Access** | No (download only) | No (download only) | Yes | Yes |
| **License** | Open Database License | Public Domain | Proprietary | Proprietary |

**Recommendation:**
- For this project: **OurAirports** (more current, public domain, nightly updates)
- Commercial APIs only needed if requiring real-time airport status or detailed scheduling data

**Confidence:** HIGH - Verified via official documentation.

---

### 4. Metropolitan Area Airport Groupings

**The Problem:** NYC area has JFK, LGA, EWR - user searching for "New York" should be able to find flights to/from any of these.

**Solution: IATA City Codes**

IATA assigns "city codes" for metropolitan areas with multiple airports:

| City Code | City | Airports |
|-----------|------|----------|
| NYC | New York | JFK, LGA, EWR, (HPN) |
| LON | London | LHR, LGW, STN, LTN, LCY, SEN |
| PAR | Paris | CDG, ORY, BVA |
| CHI | Chicago | ORD, MDW |
| WAS | Washington DC | IAD, DCA, BWI |
| SFO | San Francisco Bay | SFO, OAK, SJC |
| TYO | Tokyo | NRT, HND |
| MIL | Milan | MXP, LIN, BGY |
| BER | Berlin | BER (formerly TXL, SXF) |
| FRA | Frankfurt | FRA, HHN |

**Data Source: lxndrblz/Airports GitHub**

This repository includes a `city_code` field mapping airports to metropolitan areas:

```csv
# airports.csv columns:
code,icao,name,latitude,longitude,elevation,url,time_zone,city_code,country,city,state,county,type
JFK,KJFK,John F Kennedy Intl,40.6398,-73.7787,13,...,NYC,US,New York,...
LGA,KLGA,LaGuardia,40.7772,-73.8726,21,...,NYC,US,New York,...
EWR,KEWR,Newark Liberty Intl,40.6925,-74.1687,18,...,NYC,US,Newark,...
```

Also includes `citycodes.csv` for city-level metadata.

**Duffel API Alternative:**

Duffel's Airport schema includes a `city` object with an `airports` array listing all airports in the same metropolitan area:

```json
{
  "id": "arp_jfk_us",
  "iata_code": "JFK",
  "city": {
    "id": "cit_nyc_us",
    "iata_code": "NYC",
    "name": "New York",
    "airports": [
      { "iata_code": "JFK", "name": "John F. Kennedy International" },
      { "iata_code": "LGA", "name": "LaGuardia" },
      { "iata_code": "EWR", "name": "Newark Liberty International" }
    ]
  }
}
```

**Confidence:** HIGH - Verified via multiple sources.

---

### 5. Caching Strategies

**Airport Data Characteristics:**

| Data Type | Volatility | Recommended Cache TTL |
|-----------|------------|----------------------|
| Airport coordinates | Static | Forever (or monthly refresh) |
| IATA codes | Static | Forever (or monthly refresh) |
| City/Metro groupings | Static | Forever (or monthly refresh) |
| Airport names | Near-static | Weekly |
| Timezone data | Near-static | Monthly |
| Airport status (open/closed) | Dynamic | 24 hours |

**Recommended Strategy: Static Dataset with Periodic Refresh**

```typescript
// Option 1: Bundle static data at build time
// Pros: Zero runtime API calls, instant lookup
// Cons: Data staleness (acceptable for airport data)

import airports from './data/airports.json'; // ~500KB

function getAirportByIATA(code: string): Airport | undefined {
  return airports.find(a => a.iata_code === code);
}

// Option 2: Lazy-load with long-term cache
// Pros: Always current, smaller initial bundle
// Cons: First-request latency

const airportCache = new Map<string, Airport>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getAirport(code: string): Promise<Airport | null> {
  const cached = airportCache.get(code);
  if (cached && cached.fetchedAt > Date.now() - CACHE_TTL) {
    return cached;
  }

  const airport = await duffel.airports.get(`arp_${code.toLowerCase()}_xx`);
  airportCache.set(code, { ...airport, fetchedAt: Date.now() });
  return airport;
}
```

**For Nearby Airport Searches:**

Cache the results of proximity searches keyed by `${originCode}_${radiusKm}`:

```typescript
const nearbyCache = new Map<string, { airports: Airport[]; fetchedAt: number }>();

async function getNearbyAirports(origin: string, radiusKm: number): Promise<Airport[]> {
  const cacheKey = `${origin}_${radiusKm}`;
  const cached = nearbyCache.get(cacheKey);

  if (cached && cached.fetchedAt > Date.now() - 24 * 60 * 60 * 1000) {
    return cached.airports;
  }

  // Fetch from Duffel or compute from static data
  const airports = await fetchNearbyFromDuffel(origin, radiusKm);
  nearbyCache.set(cacheKey, { airports, fetchedAt: Date.now() });
  return airports;
}
```

**Confidence:** HIGH - Based on industry best practices.

---

## Implementation Recommendation

### Phase 1: Quick Win with Duffel API

Extend the existing `duffel-client.ts` to include a `getNearbyAirports` function:

```typescript
// lib/api/duffel-client.ts

export async function getAirportCoordinates(iataCode: string): Promise<{lat: number, lng: number} | null> {
  const duffel = getDuffelClient();
  try {
    const airports = await duffel.airports.list();
    const airport = airports.data.find(a => a.iata_code === iataCode);
    return airport ? { lat: airport.latitude, lng: airport.longitude } : null;
  } catch (error) {
    console.error('[Duffel] Failed to get airport coordinates:', error);
    return null;
  }
}

export async function getNearbyAirports(
  originCode: string,
  radiusKm: number = 150
): Promise<Array<{iata_code: string, name: string, distance_km?: number}>> {
  const coords = await getAirportCoordinates(originCode);
  if (!coords) return [];

  const response = await fetch(
    `https://api.duffel.com/places/suggestions?lat=${coords.lat}&lng=${coords.lng}&rad=${radiusKm * 1000}`,
    {
      headers: {
        'Authorization': `Bearer ${serverEnv.DUFFEL_API_KEY}`,
        'Duffel-Version': 'v1'
      }
    }
  );

  const data = await response.json();
  return data.data
    .filter((place: any) => place.type === 'airport' && place.iata_code !== originCode)
    .map((place: any) => ({
      iata_code: place.iata_code,
      name: place.name,
      city_name: place.city_name
    }));
}
```

### Phase 2: Static Data for Metro Areas

Add a static dataset for metropolitan area lookups:

```typescript
// lib/data/metro-airports.ts

export const METRO_AREAS: Record<string, string[]> = {
  'NYC': ['JFK', 'LGA', 'EWR'],
  'LON': ['LHR', 'LGW', 'STN', 'LTN', 'LCY'],
  'PAR': ['CDG', 'ORY'],
  'CHI': ['ORD', 'MDW'],
  'WAS': ['IAD', 'DCA', 'BWI'],
  'TYO': ['NRT', 'HND'],
  'MIL': ['MXP', 'LIN', 'BGY'],
  // ... extend as needed
};

export function getMetroAirports(code: string): string[] {
  // If it's a metro code, return all airports
  if (METRO_AREAS[code]) return METRO_AREAS[code];

  // If it's an airport code, find its metro and return siblings
  for (const [metro, airports] of Object.entries(METRO_AREAS)) {
    if (airports.includes(code)) {
      return airports.filter(a => a !== code);
    }
  }

  return [];
}
```

### Phase 3: Full Dataset (Optional)

If more comprehensive data is needed, download OurAirports dataset:

```bash
# Download script for periodic updates
curl -o lib/data/airports.csv \
  https://davidmegginson.github.io/ourairports-data/airports.csv
```

Parse and index at build time or on first request.

---

## NPM Packages to Consider

| Package | Purpose | Weekly Downloads | Last Updated | Recommendation |
|---------|---------|------------------|--------------|----------------|
| `haversine-distance` | Distance calculation | High | Recent | Use if computing distances locally |
| `airports-nodejs` | Airport data lookup | Medium | 2 months ago | Good for comprehensive data |
| `iata-location` | IATA lookups with daily updates | Low | Recent | Good for always-current data |
| `@duffel/api` | Duffel SDK | High | Active | **Already installed** |

**Recommendation:** The existing `@duffel/api` package is sufficient. Only add `haversine-distance` if implementing local distance calculations as a fallback.

---

## Sources

### Primary (HIGH confidence)
- [Duffel Places API Documentation](https://duffel.com/docs/api/places/get-place-suggestions)
- [Duffel Airports API Documentation](https://duffel.com/docs/api/airports)
- [OurAirports Data](https://ourairports.com/data/)
- [lxndrblz/Airports GitHub](https://github.com/lxndrblz/Airports)

### Secondary (MEDIUM confidence)
- [OpenFlights Data](https://openflights.org/data.php)
- [Amadeus Airport Nearest Relevant API](https://developers.amadeus.com/self-service/category/flights/api-doc/airport-nearest-relevant)
- [Wikivoyage Metropolitan Area Codes](https://en.wikivoyage.org/wiki/Metropolitan_area_airport_codes)

### Reference
- [Haversine Formula Implementation](https://www.movable-type.co.uk/scripts/latlong.html)
- [NPM haversine-distance](https://www.npmjs.com/package/haversine-distance)
- [AeroDataBox Pricing](https://aerodatabox.com/pricing/)
- [Aviation Edge API](https://aviation-edge.com/)

---

## Integration with Existing Code

The current `lib/utils/airport-codes.ts` provides a static mapping. To add nearby airport functionality:

1. **Extend `resolveIATACode`** to handle metro area codes (NYC, LON, etc.)
2. **Add `getNearbyAirports`** function using Duffel Places API
3. **Add `getMetroAirports`** function for same-city alternatives
4. **Update `flight-search.ts`** to call nearby airport search when primary search returns empty

```typescript
// In flight-search.ts execute function, after empty results:

if (!hasSeats && !hasDuffel) {
  // Try nearby airports
  const nearbyAirports = await getNearbyAirports(origin, 150);
  const metroAlternatives = getMetroAirports(origin);

  return {
    error: 'no_results',
    message: 'Keine Flüge gefunden für diese Route.',
    alternatives: {
      nearby: nearbyAirports.slice(0, 5),
      metro: metroAlternatives,
    },
    searchParams: params,
  };
}
```

---

## Open Questions

1. **Radius threshold:** What's the ideal radius for "nearby" - 100km? 150km? 200km? Recommend starting with 150km and adjusting based on user feedback.

2. **User messaging:** How to present alternatives - "Did you mean?" or "Also try:" or automatic parallel search?

3. **Performance budget:** Current constraint is <2s additional for alternatives. Duffel API typically responds in 200-500ms, so this is achievable.
