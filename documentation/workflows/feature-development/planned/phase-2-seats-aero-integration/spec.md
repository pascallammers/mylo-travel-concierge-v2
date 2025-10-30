# Phase 2: Seats.Aero Integration

> ### 📍 Current Status: `PLANNED`
> **Location:** `/planned/phase-2-seats-aero-integration/`
> **Last Updated:** 2025-01-29

**Priority:** 🔴 High
**Estimated Effort:** Large (3-5 days)
**Prerequisites:** 
- ✅ Phase 1 completed (Environment Config)
- ⚠️  Seats.Aero API Access (zu beschaffen)

## Overview
Integration von Seats.Aero API für Award Availability Search - die Kern-Funktion des Mylo Travel Concierge. Ermöglicht Usern nach verfügbaren Meilen-Tickets zu suchen, speziell für Business/First Class Upgrades.

**Hauptfeature:** Suche nach Flügen die mit Meilen/Punkten buchbar sind (Award Availability)

## Problem Statement
**User Story:**
> Als Reisender mit Airline-Meilen möchte ich wissen, auf welchen Flügen ich meine Meilen für Business/First Class Upgrades einsetzen kann, ohne manuell alle Airline-Websites durchsuchen zu müssen.

**Current Situation:**
- User muss manuell Seats.Aero Website besuchen
- Keine Integration in Chat Interface
- Kein AI-gestützter Search Assistant
- Keine automatische Empfehlungen

**Desired State:**
- User fragt im Chat: "Zeig mir Business Class Flüge mit Meilen von FRA nach BKK im Juli"
- AI verwendet Seats.Aero Tool für Search
- Ergebnisse werden formatiert im Chat angezeigt
- AI kann Follow-up Questions beantworten

## Technical Design

### Seats.Aero API Overview
**Base URL:** `https://seats.aero/api/` (zu verifizieren)

**Key Endpoints:**
1. `/search` - Award availability search
2. `/airlines` - Available airlines list
3. `/programs` - Loyalty programs
4. `/routes` - Popular routes

**Authentication:** API Key (Header: `X-API-Key`)

### Architecture

```
User Query
    ↓
AI Model (Scira)
    ↓
seats_aero_search Tool
    ↓
Seats.Aero API
    ↓
Format Response
    ↓
Display in Chat UI
```

### File Structure

```
lib/tools/
├── seats-aero-search.ts       # Main tool implementation
├── seats-aero-types.ts        # TypeScript types
└── index.ts                   # Export

components/
├── seats-aero-results.tsx     # Result display component
└── message-parts/
    └── index.tsx              # Add seats-aero case

app/api/search/route.ts        # Add tool to tools array
env/server.ts                  # Add SEATS_AERO_API_KEY
```

### Implementation Details

#### 1. Tool Implementation

**File:** `lib/tools/seats-aero-search.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

export const seatsAeroSearchTool = tool({
  description: `Search for award flight availability using frequent flyer miles/points.
  Use this when user asks about:
  - Flights bookable with miles/points
  - Business or First class award seats
  - Specific loyalty programs (e.g., Aeroplan, Avianca LifeMiles)
  - Award availability on routes
  
  Examples:
  - "Find business class flights with miles from NYC to Tokyo"
  - "Are there award seats available on Lufthansa to Bangkok?"
  - "Show me First Class availability using Aeroplan points"`,
  
  inputSchema: z.object({
    origin: z.string().describe('3-letter IATA airport code (e.g., FRA, JFK, BKK)'),
    destination: z.string().describe('3-letter IATA airport code'),
    departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
    returnDate: z.string().optional().describe('Return date for round-trip (optional)'),
    cabin: z.enum(['economy', 'premium_economy', 'business', 'first']).default('business')
      .describe('Preferred cabin class'),
    passengers: z.number().default(1).describe('Number of passengers'),
    loyaltyProgram: z.string().optional()
      .describe('Specific loyalty program to search (e.g., "aeroplan", "lifemiles")'),
    maxStops: z.number().optional().default(2)
      .describe('Maximum number of stops (0 = direct only)'),
  }),
  
  execute: async ({
    origin,
    destination,
    departureDate,
    returnDate,
    cabin,
    passengers,
    loyaltyProgram,
    maxStops,
  }) => {
    // Check API key
    if (!serverEnv.SEATS_AERO_API_KEY) {
      return {
        error: 'Seats.Aero integration not configured',
        message: 'Award search is currently unavailable. Please contact support.',
      };
    }
    
    try {
      const params = new URLSearchParams({
        origin,
        destination,
        departureDate,
        ...(returnDate && { returnDate }),
        cabin,
        passengers: passengers.toString(),
        ...(loyaltyProgram && { program: loyaltyProgram }),
        maxStops: maxStops.toString(),
      });
      
      const response = await fetch(
        `https://api.seats.aero/v1/search?${params}`,
        {
          headers: {
            'X-API-Key': serverEnv.SEATS_AERO_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Seats.Aero API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform to our format
      return {
        success: true,
        searchParams: {
          origin,
          destination,
          departureDate,
          returnDate,
          cabin,
          passengers,
        },
        results: data.flights?.map((flight: any) => ({
          id: flight.id,
          airline: {
            code: flight.airline.code,
            name: flight.airline.name,
          },
          flightNumber: flight.flightNumber,
          route: {
            origin: flight.origin,
            destination: flight.destination,
            stops: flight.stops || 0,
          },
          schedule: {
            departure: flight.departure,
            arrival: flight.arrival,
            duration: flight.duration,
          },
          award: {
            available: flight.award.available,
            cabin: flight.award.cabin,
            milesRequired: flight.award.miles,
            program: flight.award.program,
            taxes: flight.award.taxes,
          },
          aircraft: flight.aircraft,
        })) || [],
        totalResults: data.total || 0,
        apiResponse: data, // Keep full response for debugging
      };
      
    } catch (error) {
      console.error('Seats.Aero search error:', error);
      return {
        error: error instanceof Error ? error.message : 'Search failed',
        searchParams: { origin, destination, departureDate, cabin },
      };
    }
  },
});
```

**File:** `lib/tools/seats-aero-types.ts`

```typescript
export interface SeatsAeroSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  passengers: number;
  loyaltyProgram?: string;
  maxStops?: number;
}

export interface AwardFlight {
  id: string;
  airline: {
    code: string;
    name: string;
  };
  flightNumber: string;
  route: {
    origin: string;
    destination: string;
    stops: number;
  };
  schedule: {
    departure: string;
    arrival: string;
    duration: number; // minutes
  };
  award: {
    available: boolean;
    cabin: string;
    milesRequired: number;
    program: string;
    taxes: number; // USD
  };
  aircraft?: string;
}

export interface SeatsAeroSearchResult {
  success: boolean;
  searchParams: SeatsAeroSearchParams;
  results: AwardFlight[];
  totalResults: number;
  error?: string;
}
```

#### 2. UI Component

**File:** `components/seats-aero-results.tsx`

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plane, Clock, MapPin, Award } from 'lucide-react';
import type { SeatsAeroSearchResult } from '@/lib/tools/seats-aero-types';

interface SeatsAeroResultsProps {
  data: SeatsAeroSearchResult;
}

export function SeatsAeroResults({ data }: SeatsAeroResultsProps) {
  if (data.error) {
    return (
      <Card className="p-4 bg-red-50 dark:bg-red-950/20">
        <p className="text-sm text-red-900 dark:text-red-100">
          Unable to search award availability: {data.error}
        </p>
      </Card>
    );
  }
  
  if (data.results.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Plane className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
          <p className="text-neutral-600 dark:text-neutral-400">
            No award seats found for this route
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Try adjusting dates or cabin class
          </p>
        </div>
      </Card>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {data.totalResults} Award Flight{data.totalResults !== 1 ? 's' : ''} Found
        </h3>
        <Badge variant="secondary">
          {data.searchParams.cabin.replace('_', ' ')}
        </Badge>
      </div>
      
      {data.results.map((flight) => (
        <Card key={flight.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{flight.airline.name}</span>
                <Badge variant="outline">{flight.flightNumber}</Badge>
              </div>
              {flight.aircraft && (
                <p className="text-xs text-neutral-500 mt-1">{flight.aircraft}</p>
              )}
            </div>
            
            <Badge 
              variant={flight.award.available ? "default" : "secondary"}
              className="ml-2"
            >
              <Award className="w-3 h-3 mr-1" />
              {flight.award.milesRequired.toLocaleString()} miles
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 items-center">
            <div>
              <p className="text-lg font-bold">{flight.route.origin}</p>
              <p className="text-sm text-neutral-500">
                {new Date(flight.schedule.departure).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
                <Plane className="w-4 h-4" />
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {flight.route.stops === 0 ? 'Direct' : `${flight.route.stops} stop${flight.route.stops > 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-neutral-400">
                {Math.floor(flight.schedule.duration / 60)}h {flight.schedule.duration % 60}m
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-lg font-bold">{flight.route.destination}</p>
              <p className="text-sm text-neutral-500">
                {new Date(flight.schedule.arrival).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              via {flight.award.program}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              + ${flight.award.taxes} taxes
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

#### 3. Integration Points

**File:** `app/api/search/route.ts` (Add to tools)

```typescript
import { seatsAeroSearchTool } from '@/lib/tools';

// In tools object:
const tools = {
  // ... existing tools
  
  // Conditional - nur wenn API Key vorhanden
  ...(serverEnv.SEATS_AERO_API_KEY ? {
    seats_aero_search: seatsAeroSearchTool,
  } : {}),
};
```

**File:** `components/message-parts/index.tsx` (Add rendering)

```typescript
import { SeatsAeroResults } from '@/components/seats-aero-results';

// In MessagePart component, add case:
case 'tool-seats_aero_search':
  return (
    <ToolInvocation type="tool-seats_aero_search" isPending={isPending}>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <p className="text-sm text-neutral-500">
            Searching award availability on {part.input.origin} → {part.input.destination}...
          </p>
        </div>
      ) : part.output ? (
        <SeatsAeroResults data={part.output} />
      ) : null}
    </ToolInvocation>
  );
```

**File:** `env/server.ts` (Add API key)

```typescript
server: {
  // ... existing
  SEATS_AERO_API_KEY: z.string().optional(),
}
```

**File:** `.env.example` (Document)

```bash
# === TRAVEL FEATURES ===
# Seats.Aero - Award flight search (required for miles/points booking)
SEATS_AERO_API_KEY=your_seats_aero_api_key_here
```

### System Prompt Enhancements

**File:** `app/actions.ts` - Update `getGroupConfig()`

```typescript
// Add new group: 'travel'
case 'travel':
  return {
    tools: [
      'web_search',
      'seats_aero_search',
      'track_flight',
      'find_place_on_map',
      'get_weather_data',
    ],
    instructions: `You are Mylo, an expert travel concierge specializing in award travel and miles/points optimization.

Your expertise:
- Finding business and first class award availability
- Comparing redemption values across programs
- Suggesting best routes and dates for award bookings
- Explaining alliance partnerships and transfer options
- Providing tips for maximizing miles and points

When searching for flights:
1. Always ask for origin, destination, and approximate dates if not provided
2. Use seats_aero_search for award availability
3. Explain redemption rates in context (good/bad value)
4. Suggest alternative dates if no availability
5. Mention sweet spots and transfer partners when relevant

Be enthusiastic about good finds and realistic about availability.
Today's date: ${new Date().toISOString().split('T')[0]}`,
  };
```

## Functional Requirements
- [ ] User kann nach Award Flights suchen via Chat
- [ ] System erkennt travel-bezogene Queries automatisch
- [ ] Seats.Aero API wird korrekt aufgerufen
- [ ] Ergebnisse werden benutzerfreundlich formatiert
- [ ] Error Handling für API Failures
- [ ] Fallback wenn Seats.Aero Key fehlt
- [ ] Filtering nach Cabin Class
- [ ] Support für Direct Flights only
- [ ] Multiple passenger support
- [ ] Round-trip und One-way support

## Non-Functional Requirements
- [ ] API Response Zeit < 5 Sekunden
- [ ] Caching für häufige Routen (optional Phase 3)
- [ ] Mobile-responsive Results Display
- [ ] Accessibility (Screenreader-friendly)
- [ ] Rate Limiting awareness (Seats.Aero Limits)

## Success Criteria
✅ **Core Functionality:**
```
User: "Show me business class flights with miles from FRA to BKK in July"
→ AI uses seats_aero_search tool
→ Results displayed in chat
→ User can ask follow-ups
```

✅ **Quality Checks:**
- API calls succeed with valid data
- Error states handled gracefully
- UI is intuitive and informative
- Mobile display is usable
- System prompt generates good queries

## Testing Checklist
- [ ] Seats.Aero API Key konfiguriert
- [ ] Tool wird von AI erkannt und verwendet
- [ ] Search mit verschiedenen Parameters
- [ ] Error Handling: Invalid airport codes
- [ ] Error Handling: No availability
- [ ] Error Handling: API down/timeout
- [ ] UI Component displays correctly
- [ ] Mobile responsive check
- [ ] Follow-up questions funktionieren
- [ ] Integration mit anderen Tools (maps, weather)

## Dependencies
- ✅ Phase 1 completed (Environment Config)
- ⚠️  Seats.Aero API Access + Documentation
- ⚠️  Seats.Aero rate limits verstehen
- ✅ Amadeus Flight Tracker (already exists)

## Risks & Mitigation
- **Risk:** Seats.Aero API changes/deprecated
- **Mitigation:** Abstraction Layer, easy to swap providers

- **Risk:** Rate Limits zu niedrig für User Load
- **Mitigation:** Caching Layer (Phase 3), User Feedback

- **Risk:** API Kosten zu hoch
- **Mitigation:** Rate Limiting pro User, Tier-based Access

- **Risk:** Seats.Aero API Dokumentation unvollständig
- **Mitigation:** Reverse Engineering, Community Support

## Timeline Estimate
- API Integration & Tool: 1-2 days
- UI Component: 1 day
- System Prompt Optimization: 0.5 day
- Testing & Refinement: 1 day
- Documentation: 0.5 day
**Total: 3-5 days**

## Deliverables
1. ✅ Seats.Aero Tool implementation
2. ✅ TypeScript types für API responses
3. ✅ UI Component für Results Display
4. ✅ Integration in Chat Interface
5. ✅ System Prompt für Travel Context
6. ✅ Error Handling & Fallbacks
7. ✅ Documentation & Examples
8. ✅ Testing Suite

## Open Questions
- [ ] Seats.Aero API Access - wie beschaffen?
- [ ] Rate Limits - wie viele Requests pro Minute?
- [ ] Caching erlaubt? Wie lange?
- [ ] Kosten pro Request?
- [ ] Alternative Providers als Fallback? (expertflyer.com, etc.)

## Next Steps
Nach Completion:
→ **Phase 3:** Flight Search Enhancement (Amadeus Booking API)
→ **Phase 4:** Miles Calculator & Transfer Logic
→ Iterative Improvements basierend auf User Feedback

## References
- [Seats.Aero Website](https://seats.aero/)
- [Award Travel Guide](https://thepointsguy.com/guide/beginners-guide-award-travel/)
- → Related: [Phase 1 - Environment Config](../phase-1-environment-config-fix/spec.md)
- → Related: [Phase 3 - Flight Search Enhancement](../phase-3-flight-search-enhancement/spec.md)
- → Related: [Phase 4 - Miles & Points Logic](../phase-4-miles-points-logic/spec.md)
