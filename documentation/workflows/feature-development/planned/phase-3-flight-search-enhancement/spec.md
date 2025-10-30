# Phase 3: Flight Search Enhancement

> ### 📍 Current Status: `PLANNED`
> **Location:** `/planned/phase-3-flight-search-enhancement/`
> **Last Updated:** 2025-01-29

**Priority:** 🟡 Medium
**Estimated Effort:** Medium (2-3 days)
**Prerequisites:** 
- ✅ Phase 1 completed
- ✅ Phase 2 completed (Seats.Aero)
- ⚠️  Amadeus API Key (bereits vorhanden für Flight Tracker)

## Overview
Erweiterung des bestehenden Amadeus Flight Tracker Tools um vollständige Flight Search Funktionalität. Ermöglicht Suche nach regulären Flügen (Cash Tickets) zusätzlich zu Award Tickets, Preis-Vergleiche, und Multi-City Search.

**Hauptfeature:** Comprehensive Flight Search mit Preisen für Cash Bookings

## Problem Statement
**Current Situation:**
- Amadeus API nur für Flight Tracking genutzt (Schedule Lookup)
- Keine Cash Price Search
- Keine Alternative für Award Search Comparison
- User muss externe Websites für Preis-Checks nutzen

**Desired State:**
- User kann nach regulären Flügen mit Preisen suchen
- Cash vs Award Comparison möglich
- Multi-City und Complex Itineraries
- Price Alerts und Tracking (optional Phase 5)

**User Story:**
> Als Reisender möchte ich sowohl Cash-Preise als auch Award-Verfügbarkeit sehen, um die beste Buchungsmethode zu wählen (Bar zahlen vs Meilen einlösen).

## Technical Design

### Amadeus Flight Offers API

**Existing:** `v2/schedule/flights` (Schedule lookup - bereits implementiert)
**New:** `v2/shopping/flight-offers` (Price search - neu)

**Capabilities:**
- One-way, Round-trip, Multi-city
- Cabin class filtering
- Direct flights only option
- Airline preferences
- Price comparison across dates
- Baggage and fare rules

### Architecture

```
User Query
    ↓
AI Model determines search type
    ↓
    ├─→ Award Search (Seats.Aero) [Phase 2]
    └─→ Cash Search (Amadeus Flight Offers) [Phase 3]
    ↓
Compare Results (optional)
    ↓
Display in Chat UI
```

### File Structure

```
lib/tools/
├── flight-tracker.ts              # Existing - Schedule lookup
├── flight-search.ts               # NEW - Price search
├── flight-search-types.ts         # NEW - Types
└── index.ts                       # Export both

components/
├── flight-tracker.tsx             # Existing - Schedule display
├── flight-search-results.tsx      # NEW - Search results
├── flight-comparison.tsx          # NEW - Cash vs Award
└── message-parts/
    └── index.tsx                  # Add flight-search cases

lib/utils/
└── amadeus-client.ts              # NEW - Shared Amadeus auth
```

### Implementation Details

#### 1. Amadeus Client (Shared Auth)

**File:** `lib/utils/amadeus-client.ts`

```typescript
import { serverEnv } from '@/env/server';

// Cache token to avoid repeated auth calls
let cachedToken: { value: string; expires: number } | null = null;

export async function getAmadeusToken(): Promise<string> {
  // Return cached if still valid
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.value;
  }
  
  const tokenResponse = await fetch(
    'https://test.api.amadeus.com/v1/security/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: serverEnv.AMADEUS_API_KEY!,
        client_secret: serverEnv.AMADEUS_API_SECRET!,
      }),
    }
  );
  
  if (!tokenResponse.ok) {
    throw new Error(`Amadeus auth failed: ${tokenResponse.status}`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Cache token (expires in ~30min, cache for 25min)
  cachedToken = {
    value: tokenData.access_token,
    expires: Date.now() + 25 * 60 * 1000,
  };
  
  return tokenData.access_token;
}

export async function amadeusRequest(
  endpoint: string,
  params?: Record<string, string>
): Promise<any> {
  const token = await getAmadeusToken();
  
  const url = new URL(`https://test.api.amadeus.com${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/vnd.amadeus+json',
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Amadeus API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
```

#### 2. Flight Search Tool

**File:** `lib/tools/flight-search.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { amadeusRequest } from '@/lib/utils/amadeus-client';
import { serverEnv } from '@/env/server';

export const flightSearchTool = tool({
  description: `Search for commercial flights with prices.
  Use this when user wants to:
  - Find flights with cash prices
  - Compare prices across airlines
  - Search one-way or round-trip flights
  - Check flight availability
  
  For award/miles bookings, use seats_aero_search instead.
  
  Examples:
  - "Find flights from NYC to London next week"
  - "What's the cheapest flight to Tokyo in March?"
  - "Show me direct flights from SFO to LAX tomorrow"`,
  
  inputSchema: z.object({
    origin: z.string().describe('3-letter IATA airport code (e.g., JFK, LHR)'),
    destination: z.string().describe('3-letter IATA airport code'),
    departureDate: z.string().describe('Departure date YYYY-MM-DD'),
    returnDate: z.string().optional().describe('Return date for round-trip'),
    adults: z.number().default(1).describe('Number of adult passengers'),
    children: z.number().default(0).optional(),
    travelClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
      .default('ECONOMY'),
    nonStop: z.boolean().default(false).describe('Direct flights only'),
    maxResults: z.number().default(10).describe('Max number of results'),
    currencyCode: z.string().default('EUR').describe('Currency for prices'),
  }),
  
  execute: async ({
    origin,
    destination,
    departureDate,
    returnDate,
    adults,
    children,
    travelClass,
    nonStop,
    maxResults,
    currencyCode,
  }) => {
    if (!serverEnv.AMADEUS_API_KEY) {
      return {
        error: 'Flight search not configured',
        message: 'Please configure Amadeus API credentials',
      };
    }
    
    try {
      const params: Record<string, string> = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate,
        adults: adults.toString(),
        travelClass,
        nonStop: nonStop.toString(),
        max: maxResults.toString(),
        currencyCode,
      };
      
      if (returnDate) {
        params.returnDate = returnDate;
      }
      
      if (children && children > 0) {
        params.children = children.toString();
      }
      
      const data = await amadeusRequest('/v2/shopping/flight-offers', params);
      
      // Transform response
      const offers = data.data?.map((offer: any) => {
        const itinerary = offer.itineraries[0];
        const firstSegment = itinerary.segments[0];
        const lastSegment = itinerary.segments[itinerary.segments.length - 1];
        
        return {
          id: offer.id,
          price: {
            total: parseFloat(offer.price.total),
            currency: offer.price.currency,
            perPerson: parseFloat(offer.price.total) / adults,
          },
          airline: {
            code: firstSegment.carrierCode,
            name: firstSegment.carrierCode, // Lookup table optional
          },
          route: {
            origin: firstSegment.departure.iataCode,
            destination: lastSegment.arrival.iataCode,
            stops: itinerary.segments.length - 1,
          },
          schedule: {
            departure: firstSegment.departure.at,
            arrival: lastSegment.arrival.at,
            duration: itinerary.duration,
          },
          cabin: travelClass,
          segments: itinerary.segments.map((seg: any) => ({
            flightNumber: `${seg.carrierCode}${seg.number}`,
            departure: {
              airport: seg.departure.iataCode,
              time: seg.departure.at,
              terminal: seg.departure.terminal,
            },
            arrival: {
              airport: seg.arrival.iataCode,
              time: seg.arrival.at,
              terminal: seg.arrival.terminal,
            },
            aircraft: seg.aircraft?.code,
            duration: seg.duration,
          })),
          bookingClass: offer.travelerPricings[0]?.fareDetailsBySegment[0]?.cabin,
          seatsAvailable: offer.numberOfBookableSeats,
        };
      }) || [];
      
      return {
        success: true,
        searchParams: {
          origin,
          destination,
          departureDate,
          returnDate,
          adults,
          children,
          travelClass,
          nonStop,
        },
        offers,
        totalResults: offers.length,
        dictionaries: data.dictionaries, // Aircraft types, carriers, etc.
      };
      
    } catch (error) {
      console.error('Flight search error:', error);
      return {
        error: error instanceof Error ? error.message : 'Search failed',
        searchParams: { origin, destination, departureDate },
      };
    }
  },
});
```

#### 3. UI Component

**File:** `components/flight-search-results.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plane, Clock, ArrowRight, Info } from 'lucide-react';
import { formatDuration, formatPrice } from '@/lib/utils';

interface FlightSearchResultsProps {
  data: any; // Type from flight-search-types.ts
}

export function FlightSearchResults({ data }: FlightSearchResultsProps) {
  if (data.error) {
    return (
      <Card className="p-4 bg-red-50 dark:bg-red-950/20">
        <p className="text-sm text-red-900 dark:text-red-100">
          {data.error}
        </p>
      </Card>
    );
  }
  
  if (data.offers.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Plane className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
        <p className="text-neutral-600 dark:text-neutral-400">
          No flights found for this route
        </p>
      </Card>
    );
  }
  
  // Sort by price
  const sortedOffers = [...data.offers].sort((a, b) => a.price.total - b.price.total);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {data.totalResults} flight{data.totalResults !== 1 ? 's' : ''} found
        </span>
        <Badge variant="secondary">
          {data.searchParams.travelClass}
        </Badge>
      </div>
      
      {sortedOffers.map((offer, idx) => (
        <Card key={offer.id} className="p-4 hover:shadow-md transition-shadow">
          {idx === 0 && (
            <Badge className="mb-2" variant="default">
              Best Price
            </Badge>
          )}
          
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold">{offer.airline.name}</div>
              <div className="text-xs text-neutral-500">
                {offer.segments.length} segment{offer.segments.length > 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatPrice(offer.price.total, offer.price.currency)}
              </div>
              <div className="text-xs text-neutral-500">
                {formatPrice(offer.price.perPerson, offer.price.currency)}/person
              </div>
            </div>
          </div>
          
          {/* Main Route Display */}
          <div className="grid grid-cols-3 gap-4 items-center mb-3">
            <div>
              <div className="text-xl font-bold">{offer.route.origin}</div>
              <div className="text-sm text-neutral-500">
                {new Date(offer.schedule.departure).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
                <Plane className="w-4 h-4" />
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                {offer.route.stops === 0 ? 'Direct' : `${offer.route.stops} stop${offer.route.stops > 1 ? 's' : ''}`}
              </div>
              <div className="text-xs text-neutral-400">
                {formatDuration(offer.schedule.duration)}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xl font-bold">{offer.route.destination}</div>
              <div className="text-sm text-neutral-500">
                {new Date(offer.schedule.arrival).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
          
          {/* Segment Details */}
          {offer.segments.length > 1 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                View connection details
              </summary>
              <div className="mt-2 space-y-2 pl-4 border-l-2 border-neutral-200 dark:border-neutral-700">
                {offer.segments.map((seg: any, i: number) => (
                  <div key={i} className="text-xs">
                    <div className="font-medium">{seg.flightNumber}</div>
                    <div className="text-neutral-500">
                      {seg.departure.airport} → {seg.arrival.airport}
                    </div>
                    <div className="text-neutral-400">
                      {formatDuration(seg.duration)}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-neutral-500">
            <span>{offer.seatsAvailable} seats available</span>
            <span>{offer.bookingClass}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Helper functions
function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  const hours = match[1] || '0';
  const minutes = match[2] || '0';
  return `${hours}h ${minutes}m`;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

#### 4. Cash vs Award Comparison (Optional)

**File:** `components/flight-comparison.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlightSearchResults } from './flight-search-results';
import { SeatsAeroResults } from './seats-aero-results';

interface FlightComparisonProps {
  cashResults: any;
  awardResults: any;
}

export function FlightComparison({ cashResults, awardResults }: FlightComparisonProps) {
  // Calculate cents per mile value
  const bestCashPrice = cashResults.offers?.[0]?.price.total;
  const bestAwardMiles = awardResults.results?.[0]?.award.milesRequired;
  const bestAwardTaxes = awardResults.results?.[0]?.award.taxes;
  
  const centsPerMile = bestCashPrice && bestAwardMiles
    ? ((bestCashPrice - bestAwardTaxes) / bestAwardMiles) * 100
    : null;
  
  return (
    <div className="space-y-4">
      {centsPerMile && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Redemption Value
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {centsPerMile.toFixed(2)}¢ per mile
              </p>
            </div>
            <Badge variant={centsPerMile > 1.5 ? 'default' : 'secondary'}>
              {centsPerMile > 1.5 ? 'Good Deal' : 'Consider Cash'}
            </Badge>
          </div>
        </Card>
      )}
      
      <Tabs defaultValue="award" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="award">
            With Miles
            {awardResults.totalResults > 0 && (
              <Badge variant="outline" className="ml-2">
                {awardResults.totalResults}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cash">
            Cash Price
            {cashResults.totalResults > 0 && (
              <Badge variant="outline" className="ml-2">
                {cashResults.totalResults}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="award" className="mt-4">
          <SeatsAeroResults data={awardResults} />
        </TabsContent>
        
        <TabsContent value="cash" className="mt-4">
          <FlightSearchResults data={cashResults} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 5. Integration

**File:** `lib/tools/flight-tracker.ts` - Refactor to use shared client

```typescript
import { amadeusRequest } from '@/lib/utils/amadeus-client';

// Replace auth logic with:
const data = await amadeusRequest('/v2/schedule/flights', {
  carrierCode,
  flightNumber,
  scheduledDepartureDate,
});
```

**File:** `app/api/search/route.ts`

```typescript
import { flightSearchTool } from '@/lib/tools';

const tools = {
  // ... existing
  ...(serverEnv.AMADEUS_API_KEY ? {
    track_flight: flightTrackerTool,
    search_flights: flightSearchTool, // NEW
  } : {}),
};
```

**File:** `app/actions.ts` - Update travel group

```typescript
case 'travel':
  return {
    tools: [
      'web_search',
      'seats_aero_search',
      'search_flights',  // ADD
      'track_flight',
      // ...
    ],
    instructions: `...
When user asks about flights:
1. Determine if they want award (miles) or cash pricing
2. Use seats_aero_search for award availability
3. Use search_flights for cash prices
4. Offer to compare both if relevant
...`,
  };
```

## Functional Requirements
- [ ] Cash flight search funktioniert
- [ ] One-way und Round-trip Support
- [ ] Cabin class filtering
- [ ] Direct flights only option
- [ ] Multi-passenger booking
- [ ] Price sorting (cheapest first)
- [ ] Detailed itinerary display
- [ ] Connection details anzeigen
- [ ] Amadeus token caching
- [ ] Error handling für API failures

## Non-Functional Requirements
- [ ] Response time < 5 Sekunden
- [ ] Token caching reduziert API Calls
- [ ] Mobile-responsive display
- [ ] Preis-Formatierung currency-aware
- [ ] Duration Parsing korrekt

## Success Criteria
✅ **Core Search:**
```
User: "Find flights from NYC to London next week"
→ AI uses search_flights tool
→ Results mit Preisen angezeigt
→ Sortiert nach Preis
```

✅ **Comparison:**
```
User: "Compare cash vs miles for FRA to BKK"
→ AI ruft beide Tools (search_flights + seats_aero_search)
→ Side-by-side comparison
→ Value calculation (cents per mile)
```

## Testing Checklist
- [ ] Basic one-way search
- [ ] Round-trip search
- [ ] Direct flights filtering
- [ ] Different cabin classes
- [ ] Multi-passenger
- [ ] Error: Invalid airport codes
- [ ] Error: No results
- [ ] Token caching funktioniert
- [ ] Price sorting korrekt
- [ ] Mobile display
- [ ] Comparison view (cash vs award)

## Dependencies
- ✅ Amadeus API Key (bereits für Flight Tracker)
- ✅ Phase 1 & 2 completed
- ✅ Amadeus API token auth

## Risks & Mitigation
- **Risk:** Amadeus rate limits
- **Mitigation:** Token caching, request throttling

- **Risk:** Preise nicht aktuell
- **Mitigation:** Timestamp anzeigen, Disclaimer

- **Risk:** Komplexe Multi-City routing
- **Mitigation:** Phase 3 nur simple searches, Multi-City später

## Timeline Estimate
- Amadeus client abstraction: 0.5 day
- Flight search tool: 1 day
- UI Components: 1 day
- Comparison view: 0.5 day
- Testing: 0.5 day
**Total: 2-3 days**

## Deliverables
1. ✅ Shared Amadeus client mit token caching
2. ✅ Flight search tool implementation
3. ✅ Refactored flight tracker (use shared client)
4. ✅ Flight search results component
5. ✅ Cash vs Award comparison view
6. ✅ Integration in chat interface
7. ✅ Updated system prompts
8. ✅ Testing & documentation

## Next Steps
Nach Completion:
→ **Phase 4:** Miles & Points Calculator
→ Optional: Price alerts & tracking
→ Optional: Multi-city complex routing

## References
- [Amadeus Flight Offers API](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search)
- [Amadeus Authentication](https://developers.amadeus.com/self-service/apis-docs/guides/authorization-262)
- → Related: [Phase 2 - Seats.Aero](../phase-2-seats-aero-integration/spec.md)
- → Related: [Phase 4 - Miles & Points](../phase-4-miles-points-logic/spec.md)
