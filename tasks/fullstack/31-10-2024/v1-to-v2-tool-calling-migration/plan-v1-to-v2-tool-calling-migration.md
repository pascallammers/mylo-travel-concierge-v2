# Implementation Plan: V1 zu V2 Tool-Calling Migration

**Task ID:** v1-to-v2-tool-calling-migration  
**Date:** 31. Oktober 2024  
**Type:** Full-Stack  
**Estimated Duration:** 11-18 Tage (2-3 Wochen)

---

## 📋 Overview

This plan details the step-by-step implementation of migrating the V1 tool-calling system (Seats.aero, Amadeus) to V2 Next.js architecture.

**Architecture Decision:** Full Next.js Migration (Option A)
- All flight tools implemented directly in Next.js
- No Supabase Edge Functions
- Unified codebase with existing V2 tools

---

## 🎯 Implementation Phases

### Phase 0: Preparation (1-2 Days)

**Goals:**
- Setup database schemas
- Configure environment variables
- Organize API credentials

**Tasks Checklist:**

**Database Schema:**
- [ ] Create `lib/db/schema/tool-calls.ts`
- [ ] Create `lib/db/schema/session-states.ts`
- [ ] Create `lib/db/schema/amadeus-tokens.ts`
- [ ] Generate Drizzle migration: `pnpm drizzle-kit generate:pg`
- [ ] Apply migration: `pnpm drizzle-kit push:pg`

**Environment Setup:**
- [ ] Add `AMADEUS_API_KEY` to Vercel secrets
- [ ] Add `AMADEUS_API_SECRET` to Vercel secrets
- [ ] Add `AMADEUS_ENV` to Vercel secrets (value: 'test')
- [ ] Add `SEATSAERO_API_KEY` to Vercel secrets
- [ ] Update `.env.local` for development

**Project Structure:**
- [ ] Create `lib/api/` directory
- [ ] Create `lib/tools/flight-search/` directory

---

### Phase 1: Tool-Call Infrastructure (2-3 Days)

**Goals:**
- Implement tool-call registry system
- Session state management
- Amadeus token management

#### 1.1 Database Schemas

**File:** `lib/db/schema/tool-calls.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { chats } from './chats';

export const toolCallStatus = ['queued', 'running', 'succeeded', 'failed', 'timeout', 'canceled'] as const;
export type ToolCallStatus = typeof toolCallStatus[number];

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'cascade' }).notNull(),
  toolName: text('tool_name').notNull(),
  status: text('status', { enum: toolCallStatus }).default('queued').notNull(),
  request: jsonb('request'),
  response: jsonb('response'),
  error: text('error'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
```

**File:** `lib/db/schema/session-states.ts`

```typescript
import { pgTable, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { chats } from './chats';

export const sessionStates = pgTable('session_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'cascade' }).unique().notNull(),
  state: jsonb('state').notNull().$type<SessionStateData>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface SessionStateData {
  last_flight_request?: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string | null;
    cabin: string;
    passengers?: number;
    awardOnly?: boolean;
    loyaltyPrograms?: string[];
  };
  pending_flight_request?: {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string | null;
    cabin?: string;
    passengers?: number;
  } | null;
  selected_itineraries?: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  memory?: Array<{ type: string; content: string; created_at: string }>;
}

export type SessionState = typeof sessionStates.$inferSelect;
export type NewSessionState = typeof sessionStates.$inferInsert;
```

**File:** `lib/db/schema/amadeus-tokens.ts`

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const amadeusTokens = pgTable('amadeus_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: text('environment', { enum: ['test', 'prod'] }).notNull(),
  accessToken: text('access_token').notNull(),
  tokenType: text('token_type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AmadeusToken = typeof amadeusTokens.$inferSelect;
export type NewAmadeusToken = typeof amadeusTokens.$inferInsert;
```

**File:** `lib/db/schema/index.ts` (update)

```typescript
// Add to existing exports:
export * from './tool-calls';
export * from './session-states';
export * from './amadeus-tokens';
```

#### 1.2 Database Query Functions

**File:** `lib/db/queries/tool-calls.ts`

```typescript
import { db } from '../drizzle';
import { toolCalls, NewToolCall, ToolCallStatus } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generate SHA256 hash for deduplication
 * @param data - Data to hash
 * @returns Hash string
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Record a new tool call in the database
 * @param params - Tool call parameters
 * @returns Tool call ID and dedupe key
 */
export async function recordToolCall(params: {
  chatId: string;
  toolName: string;
  request: unknown;
}): Promise<{ id: string; dedupeKey: string }> {
  const dedupeKey = await sha256(
    JSON.stringify({
      chatId: params.chatId,
      toolName: params.toolName,
      request: params.request,
    })
  );

  // Check for existing tool call
  const existing = await db.query.toolCalls.findFirst({
    where: eq(toolCalls.dedupeKey, dedupeKey),
    columns: { id: true },
  });

  if (existing) {
    return { id: existing.id, dedupeKey };
  }

  // Insert new tool call
  const [result] = await db
    .insert(toolCalls)
    .values({
      chatId: params.chatId,
      toolName: params.toolName,
      status: 'queued',
      request: params.request as any,
      dedupeKey,
    })
    .returning({ id: toolCalls.id });

  return { id: result.id, dedupeKey };
}

/**
 * Update tool call status and details
 * @param id - Tool call ID
 * @param update - Fields to update
 */
export async function updateToolCall(
  id: string,
  update: {
    status?: ToolCallStatus;
    response?: unknown;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
  }
) {
  await db
    .update(toolCalls)
    .set({
      ...(update.status && { status: update.status }),
      ...(update.response && { response: update.response as any }),
      ...(update.error && { error: update.error }),
      ...(update.startedAt && { startedAt: update.startedAt }),
      ...(update.finishedAt && { finishedAt: update.finishedAt }),
    })
    .where(eq(toolCalls.id, id));
}

/**
 * Get tool call by ID
 * @param id - Tool call ID
 * @returns Tool call or undefined
 */
export async function getToolCallById(id: string) {
  return await db.query.toolCalls.findFirst({
    where: eq(toolCalls.id, id),
  });
}
```

**File:** `lib/db/queries/session-state.ts`

```typescript
import { db } from '../drizzle';
import { sessionStates, SessionStateData } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Get session state for a chat
 * @param chatId - Chat ID
 * @returns Session state data or empty object
 */
export async function getSessionState(chatId: string): Promise<SessionStateData> {
  const result = await db.query.sessionStates.findFirst({
    where: eq(sessionStates.chatId, chatId),
  });

  return result?.state || {};
}

/**
 * Merge session state with new data
 * @param chatId - Chat ID
 * @param patch - Partial session state to merge
 * @returns Updated session state
 */
export async function mergeSessionState(
  chatId: string,
  patch: Partial<SessionStateData>
): Promise<SessionStateData> {
  const current = await getSessionState(chatId);
  const merged: SessionStateData = { ...current, ...patch };

  await db
    .insert(sessionStates)
    .values({
      chatId,
      state: merged as any,
    })
    .onConflictDoUpdate({
      target: sessionStates.chatId,
      set: {
        state: merged as any,
        updatedAt: new Date(),
      },
    });

  return merged;
}

/**
 * Clear session state for a chat
 * @param chatId - Chat ID
 */
export async function clearSessionState(chatId: string) {
  await db.delete(sessionStates).where(eq(sessionStates.chatId, chatId));
}
```

**File:** `lib/db/queries/index.ts` (update)

```typescript
// Add to existing exports:
export * from './tool-calls';
export * from './session-state';
```

#### 1.3 Amadeus Token Management

**File:** `lib/api/amadeus-token.ts`

```typescript
import { db } from '@/lib/db/drizzle';
import { amadeusTokens } from '@/lib/db/schema';
import { desc, eq, and, gt } from 'drizzle-orm';

/**
 * Get or refresh Amadeus OAuth2 token
 * @param environment - Amadeus environment ('test' or 'prod')
 * @returns Access token
 */
export async function getAmadeusToken(
  environment: 'test' | 'prod' = 'test'
): Promise<string> {
  // 1. Check for cached valid token
  const cached = await db.query.amadeusTokens.findFirst({
    where: and(
      eq(amadeusTokens.environment, environment),
      gt(amadeusTokens.expiresAt, new Date())
    ),
    orderBy: desc(amadeusTokens.createdAt),
  });

  if (cached) {
    console.log('[Amadeus] Using cached token');
    return cached.accessToken;
  }

  // 2. Request new token
  console.log('[Amadeus] Requesting new token');
  const baseUrl =
    environment === 'prod'
      ? 'https://api.amadeus.com'
      : 'https://test.api.amadeus.com';

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Amadeus token request failed: ${error}`);
  }

  const data = await response.json();

  // 3. Store token with expiration
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.insert(amadeusTokens).values({
    environment,
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresAt,
  });

  console.log('[Amadeus] New token stored, expires at:', expiresAt);
  return data.access_token;
}

/**
 * Clear expired tokens from database
 */
export async function cleanupExpiredTokens() {
  const deleted = await db
    .delete(amadeusTokens)
    .where(gt(new Date(), amadeusTokens.expiresAt))
    .returning({ id: amadeusTokens.id });

  console.log(`[Amadeus] Cleaned up ${deleted.length} expired tokens`);
}
```

---

### Phase 2: Seats.aero Integration (2-3 Days)

**Goals:**
- Implement Seats.aero API client
- Handle award flight search
- Format results for LLM

#### 2.1 Seats.aero API Client

**File:** `lib/api/seats-aero-client.ts`

```typescript
const SEATSAERO_BASE_URL = 'https://seats.aero/partnerapi';

const CLASS_MAP = {
  ECONOMY: { key: 'Y', cabin: 'Economy', apiValue: 'economy' },
  PREMIUM_ECONOMY: { key: 'W', cabin: 'Premium Economy', apiValue: 'premium' },
  BUSINESS: { key: 'J', cabin: 'Business', apiValue: 'business' },
  FIRST: { key: 'F', cabin: 'First', apiValue: 'first' },
} as const;

export type TravelClass = keyof typeof CLASS_MAP;

export interface SeatsAeroSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  travelClass: TravelClass;
  flexibility?: number;
  maxResults?: number;
}

export interface SeatsAeroFlight {
  id: string;
  provider: 'seatsaero';
  price: string;
  pricePerPerson: string;
  airline: string;
  cabin: string;
  tags: string[];
  totalStops: number;
  miles: number | null;
  taxes: {
    amount: number | null;
    currency: string | null;
  };
  seatsLeft: number | null;
  bookingLinks?: Record<string, string>;
  outbound: {
    departure: { airport: string; time: string };
    arrival: { airport: string; time: string };
    duration: string;
    stops: string;
    flightNumbers: string;
  };
}

/**
 * Search for award flights using Seats.aero Partner API
 * @param params - Search parameters
 * @returns List of available award flights
 */
export async function searchSeatsAero(
  params: SeatsAeroSearchParams
): Promise<SeatsAeroFlight[]> {
  const { key, cabin, apiValue } = CLASS_MAP[params.travelClass];
  const flex = Math.min(params.flexibility || 0, 3);

  // Calculate date range
  const baseDate = new Date(params.departureDate);
  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  if (flex > 0) {
    startDate.setDate(startDate.getDate() - flex);
    endDate.setDate(endDate.getDate() + flex);
  }

  // Build search URL
  const searchUrl = new URL(`${SEATSAERO_BASE_URL}/search`);
  searchUrl.searchParams.set('origin_airport', params.origin);
  searchUrl.searchParams.set('destination_airport', params.destination);
  searchUrl.searchParams.set('cabin', apiValue);
  searchUrl.searchParams.set('start_date', formatDate(startDate));
  searchUrl.searchParams.set('end_date', formatDate(endDate));
  searchUrl.searchParams.set('take', String(params.maxResults || 10));
  searchUrl.searchParams.set('include_trips', 'true');

  console.log('[Seats.aero] Searching:', searchUrl.toString());

  // API Call
  const response = await fetch(searchUrl.toString(), {
    headers: {
      'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Seats.aero API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Process results
  const entries = Array.isArray(data.data) ? data.data : [];
  console.log(`[Seats.aero] Found ${entries.length} results`);

  const filtered = entries
    .filter((entry) => hasAvailability(entry, key))
    .sort((a, b) => getMiles(a, key) - getMiles(b, key))
    .slice(0, params.maxResults || 10);

  // Load trip details for each flight
  const flights: SeatsAeroFlight[] = [];
  for (const entry of filtered) {
    const flight = await loadFlightDetails(entry, key, cabin);
    if (flight) flights.push(flight);
  }

  console.log(`[Seats.aero] Returning ${flights.length} flights`);
  return flights;
}

/**
 * Load detailed flight information
 */
async function loadFlightDetails(
  entry: any,
  cabinKey: string,
  cabinName: string
): Promise<SeatsAeroFlight | null> {
  const tripId = entry[`${cabinKey.toLowerCase()}TripId`];
  if (!tripId) return null;

  const tripUrl = `${SEATSAERO_BASE_URL}/trip/${tripId}`;
  const response = await fetch(tripUrl, {
    headers: {
      'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
    },
  });

  if (!response.ok) {
    console.warn(`[Seats.aero] Failed to load trip ${tripId}`);
    return null;
  }

  const trip = await response.json();

  // Extract miles and taxes
  const miles = getMiles(entry, cabinKey);
  const taxAmount = trip.taxes?.amount || null;
  const taxCurrency = trip.taxes?.currency || null;

  // Format price
  const priceStr = miles !== null && miles < Infinity
    ? `${miles.toLocaleString()} miles${taxAmount ? ` + ${taxCurrency}${taxAmount}` : ''}`
    : 'N/A';

  return {
    id: tripId,
    provider: 'seatsaero',
    price: priceStr,
    pricePerPerson: priceStr,
    airline: trip.airline || 'Unknown',
    cabin: cabinName,
    tags: extractTags(trip),
    totalStops: trip.segments?.length - 1 || 0,
    miles: miles !== Infinity ? miles : null,
    taxes: { amount: taxAmount, currency: taxCurrency },
    seatsLeft: getSeatsLeft(entry, cabinKey),
    bookingLinks: extractBookingLinks(trip),
    outbound: formatSegment(trip),
  };
}

/**
 * Check if flight has availability
 */
function hasAvailability(entry: any, key: string): boolean {
  const available = entry[`${key.toLowerCase()}Available`];
  const seats = entry[`${key.toLowerCase()}Seats`];
  return Boolean(available || (seats && seats > 0));
}

/**
 * Extract miles cost
 */
function getMiles(entry: any, key: string): number {
  const miles = entry[`${key.toLowerCase()}Miles`];
  return typeof miles === 'number' ? miles : Infinity;
}

/**
 * Get seats left
 */
function getSeatsLeft(entry: any, key: string): number | null {
  const seats = entry[`${key.toLowerCase()}Seats`];
  return typeof seats === 'number' ? seats : null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format flight segment
 */
function formatSegment(trip: any): SeatsAeroFlight['outbound'] {
  const first = trip.segments?.[0] || {};
  const last = trip.segments?.[trip.segments.length - 1] || {};

  return {
    departure: {
      airport: first.origin || 'N/A',
      time: first.departureTime || 'N/A',
    },
    arrival: {
      airport: last.destination || 'N/A',
      time: last.arrivalTime || 'N/A',
    },
    duration: trip.duration || 'N/A',
    stops: trip.segments?.length > 1 ? `${trip.segments.length - 1} stop(s)` : 'Nonstop',
    flightNumbers: trip.segments?.map((s: any) => s.flightNumber).join(', ') || 'N/A',
  };
}

/**
 * Extract tags (e.g., "Direct", "Best Value")
 */
function extractTags(trip: any): string[] {
  const tags: string[] = [];
  if (trip.segments?.length === 1) tags.push('Direct');
  if (trip.bestValue) tags.push('Best Value');
  return tags;
}

/**
 * Extract booking links
 */
function extractBookingLinks(trip: any): Record<string, string> {
  return trip.bookingLinks || {};
}
```

---

### Phase 3: Amadeus Integration (2-3 Days)

**Goals:**
- Implement Amadeus API client
- Integrate token management
- Format cash flight results

#### 3.1 Amadeus API Client

**File:** `lib/api/amadeus-client.ts`

```typescript
import { getAmadeusToken } from './amadeus-token';

const AMADEUS_BASE_URL =
  process.env.AMADEUS_ENV === 'prod'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

export interface AmadeusSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  travelClass: string;
  passengers: number;
  nonStop?: boolean;
}

export interface AmadeusFlight {
  id: string;
  provider: 'amadeus';
  airline: string;
  price: {
    total: string;
    base: string;
    currency: string;
  };
  departure: {
    airport: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: string;
    terminal?: string;
  };
  duration: string;
  stops: number;
  segments: Array<{
    carrierCode: string;
    flightNumber: string;
    departure: { iataCode: string; at: string };
    arrival: { iataCode: string; at: string };
  }>;
}

/**
 * Search for cash flights using Amadeus Flight Offers API
 * @param params - Search parameters
 * @returns List of flight offers
 */
export async function searchAmadeus(
  params: AmadeusSearchParams
): Promise<AmadeusFlight[]> {
  // 1. Get OAuth token
  const token = await getAmadeusToken(
    (process.env.AMADEUS_ENV as 'test' | 'prod') || 'test'
  );

  // 2. Build search params
  const searchParams = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: String(params.passengers),
    travelClass: params.travelClass.toLowerCase(),
    currencyCode: 'EUR',
    max: '10',
  });

  if (params.returnDate) {
    searchParams.set('returnDate', params.returnDate);
  }

  if (params.nonStop) {
    searchParams.set('nonStop', 'true');
  }

  console.log('[Amadeus] Searching:', `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`);

  // 3. API Call
  const response = await fetch(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.amadeus+json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Amadeus API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  // 4. Process results
  const offers = Array.isArray(data.data) ? data.data : [];
  console.log(`[Amadeus] Found ${offers.length} offers`);

  return offers.map((offer: any) => ({
    id: offer.id,
    provider: 'amadeus',
    airline: offer.validatingAirlineCodes?.[0] || 'Unknown',
    price: {
      total: offer.price.grandTotal,
      base: offer.price.base,
      currency: offer.price.currency,
    },
    departure: {
      airport: offer.itineraries[0].segments[0].departure.iataCode,
      time: offer.itineraries[0].segments[0].departure.at,
      terminal: offer.itineraries[0].segments[0].departure.terminal,
    },
    arrival: {
      airport:
        offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.iataCode,
      time: offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.at,
      terminal:
        offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.terminal,
    },
    duration: offer.itineraries[0].duration,
    stops: offer.itineraries[0].segments.length - 1,
    segments: offer.itineraries[0].segments.map((seg: any) => ({
      carrierCode: seg.carrierCode,
      flightNumber: seg.number,
      departure: {
        iataCode: seg.departure.iataCode,
        at: seg.departure.at,
      },
      arrival: {
        iataCode: seg.arrival.iataCode,
        at: seg.arrival.at,
      },
    })),
  }));
}
```

---

### Phase 4: Flight Search Tool (1-2 Days)

**Goals:**
- Create flight search tool using Vercel AI SDK
- Integrate with tool-call registry
- Session state management

#### 4.1 Flight Search Tool

**File:** `lib/tools/flight-search.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchAmadeus } from '@/lib/api/amadeus-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries/tool-calls';
import { mergeSessionState } from '@/lib/db/queries/session-state';

export const flightSearchTool = tool({
  description: `Search for flights using Seats.aero (award flights) and Amadeus (cash flights).
  
This tool searches both:
- Seats.aero: Award flights bookable with miles/points
- Amadeus: Regular cash flights

Results include pricing, availability, and booking details.`,

  parameters: z.object({
    origin: z
      .string()
      .length(3)
      .toUpperCase()
      .describe('Origin airport IATA code (3 letters, e.g., FRA)'),
    destination: z
      .string()
      .length(3)
      .toUpperCase()
      .describe('Destination airport IATA code (3 letters, e.g., JFK)'),
    departDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Departure date in YYYY-MM-DD format'),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable()
      .describe('Return date in YYYY-MM-DD format (optional for round trip)'),
    cabin: z
      .enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
      .describe('Cabin class'),
    passengers: z
      .number()
      .int()
      .min(1)
      .max(9)
      .default(1)
      .describe('Number of passengers'),
    awardOnly: z
      .boolean()
      .default(true)
      .describe('Search only award flights (true) or include cash flights (false)'),
    loyaltyPrograms: z
      .array(z.string())
      .optional()
      .describe('Preferred loyalty programs for award bookings'),
    flexibility: z
      .number()
      .int()
      .min(0)
      .max(3)
      .default(0)
      .describe('Date flexibility in days (0-3)'),
    nonStop: z.boolean().default(false).describe('Search only non-stop flights'),
    maxTaxes: z
      .number()
      .optional()
      .describe('Maximum taxes/fees for award flights (in USD)'),
  }),

  execute: async (params, { abortSignal, messages }) => {
    // Extract chatId from messages context
    const chatId = (messages as any)?.[0]?.chatId || 'unknown';

    console.log('[Flight Search] Starting search:', params);

    // 1. Record tool call
    const { id: toolCallId } = await recordToolCall({
      chatId,
      toolName: 'search_flights',
      request: params,
    });

    await updateToolCall(toolCallId, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // 2. Parallel API calls
      const [seatsResult, amadeusResult] = await Promise.all([
        searchSeatsAero({
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departDate,
          travelClass: params.cabin as TravelClass,
          flexibility: params.flexibility,
          maxResults: 5,
        }).catch((err) => {
          console.warn('[Flight Search] Seats.aero failed:', err.message);
          return null;
        }),

        params.awardOnly
          ? Promise.resolve(null)
          : searchAmadeus({
              origin: params.origin,
              destination: params.destination,
              departureDate: params.departDate,
              returnDate: params.returnDate,
              travelClass: params.cabin,
              passengers: params.passengers,
              nonStop: params.nonStop,
            }).catch((err) => {
              console.warn('[Flight Search] Amadeus failed:', err.message);
              return null;
            }),
      ]);

      // 3. Check if we have results
      const hasSeats = seatsResult && seatsResult.length > 0;
      const hasAmadeus = amadeusResult && amadeusResult.length > 0;

      if (!hasSeats && !hasAmadeus) {
        throw new Error('Keine Flüge gefunden. Bitte versuchen Sie andere Daten oder Routen.');
      }

      const result = {
        seats: {
          flights: seatsResult || [],
          count: seatsResult?.length || 0,
        },
        amadeus: {
          flights: amadeusResult || [],
          count: amadeusResult?.length || 0,
        },
        searchParams: params,
      };

      console.log('[Flight Search] Results:', {
        seatsCount: result.seats.count,
        amadeusCount: result.amadeus.count,
      });

      // 4. Update tool call status
      await updateToolCall(toolCallId, {
        status: 'succeeded',
        response: result,
        finishedAt: new Date(),
      });

      // 5. Update session state
      await mergeSessionState(chatId, {
        last_flight_request: {
          origin: params.origin,
          destination: params.destination,
          departDate: params.departDate,
          returnDate: params.returnDate,
          cabin: params.cabin,
          passengers: params.passengers,
          awardOnly: params.awardOnly,
          loyaltyPrograms: params.loyaltyPrograms,
        },
        pending_flight_request: null,
      });

      // 6. Format response for LLM
      return formatFlightResults(result, params);
    } catch (error) {
      console.error('[Flight Search] Error:', error);

      await updateToolCall(toolCallId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      });

      throw error;
    }
  },
});

/**
 * Format flight results for LLM response
 */
function formatFlightResults(result: any, params: any): string {
  const sections: string[] = [];

  // Award Flights Section
  if (result.seats.count > 0) {
    sections.push(`## Award-Flüge (${result.seats.count} Ergebnisse)\n`);

    result.seats.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline} - ${flight.cabin}\n` +
          `**Preis:** ${flight.price}\n` +
          `**Abflug:** ${flight.outbound.departure.airport} um ${flight.outbound.departure.time}\n` +
          `**Ankunft:** ${flight.outbound.arrival.airport} um ${flight.outbound.arrival.time}\n` +
          `**Dauer:** ${flight.outbound.duration}\n` +
          `**Stops:** ${flight.outbound.stops}\n` +
          `**Verfügbare Sitze:** ${flight.seatsLeft || 'Unbekannt'}\n` +
          `**Flugnummern:** ${flight.outbound.flightNumbers}\n\n`
      );
    });
  }

  // Cash Flights Section
  if (result.amadeus.count > 0) {
    sections.push(`## Cash-Flüge (${result.amadeus.count} Ergebnisse)\n`);

    result.amadeus.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline}\n` +
          `**Preis:** ${flight.price.total} ${flight.price.currency}\n` +
          `**Abflug:** ${flight.departure.airport} um ${new Date(flight.departure.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\n` +
          `**Ankunft:** ${flight.arrival.airport} um ${new Date(flight.arrival.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\n` +
          `**Dauer:** ${flight.duration}\n` +
          `**Stops:** ${flight.stops === 0 ? 'Nonstop' : `${flight.stops} Stop(s)`}\n\n`
      );
    });
  }

  // No results
  if (result.seats.count === 0 && result.amadeus.count === 0) {
    sections.push(
      `Leider wurden keine Flüge für Ihre Suche gefunden.\n\n` +
        `**Suchparameter:**\n` +
        `- Route: ${params.origin} → ${params.destination}\n` +
        `- Datum: ${params.departDate}\n` +
        `- Klasse: ${params.cabin}\n\n` +
        `Versuchen Sie:\n` +
        `- Andere Daten wählen\n` +
        `- Flexibilität erhöhen\n` +
        `- Alternative Airports prüfen\n`
    );
  }

  return sections.join('\n');
}
```

---

### Phase 5: Chat Integration (1-2 Days)

**Goals:**
- Register flight search tool in chat API
- Create "flights" tool group
- Add system instructions

#### 5.1 Tool Registration

**File:** `app/api/search/route.ts` (update)

```typescript
// Add import
import { flightSearchTool } from '@/lib/tools/flight-search';

// In streamText() tools object:
const result = streamText({
  model: languageModel,
  messages: convertToModelMessages(messages),
  system: instructions + customInstructions,
  toolChoice: 'auto',
  tools: {
    // ... existing tools
    web_search: webSearchTool(dataStream, searchProvider),
    academic_search: academicSearchTool,
    youtube_search: youtubeSearchTool,
    
    // ✨ NEW: Flight Search
    search_flights: flightSearchTool,
    
    stock_chart: stockChartTool,
    // ... rest of tools
  },
});
```

#### 5.2 Flight Tool Group

**File:** `app/actions.ts` (update)

```typescript
const groupTools = {
  web: ['web_search', 'greeting', ...],
  academic: ['academic_search', ...],
  youtube: ['youtube_search', ...],
  stocks: ['stock_chart', ...],
  
  // ✨ NEW: Flights Group
  flights: [
    'search_flights',
    'datetime',
    'greeting',
  ],
  
  // ... rest of groups
} as const;

const groupInstructions = {
  web: `You are an AI web search engine...`,
  academic: `You are an academic research assistant...`,
  
  // ✨ NEW: Flights Instructions
  flights: `
You are MYLO, a travel concierge assistant specialized in finding the best flight deals.
Today's date is ${new Date().toLocaleDateString('en-US', { 
  year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' 
})}.

### Tool Guidelines:

#### Flight Search Tool:
- ⚠️ URGENT: Run search_flights tool INSTANTLY when user asks about flights - NO EXCEPTIONS
- DO NOT WRITE A SINGLE WORD before running the tool
- Extract all flight parameters from the user's query:
  - origin: IATA code (3 letters) - ask if unclear
  - destination: IATA code (3 letters) - ask if unclear
  - departDate: YYYY-MM-DD format
  - returnDate: Optional, for round trips
  - cabin: ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST
  - passengers: Number of travelers (default: 1)
  - awardOnly: true for miles/points, false to include cash flights
- If user mentions city names, convert to IATA codes:
  - Frankfurt → FRA
  - New York → JFK/EWR/LGA
  - London → LHR/LGW/STN
  - Paris → CDG/ORY
  - Ask user to clarify if multiple airports exist
- Run the tool only once and then write the response

#### datetime tool:
- Use when user asks about dates
- No citation needed for datetime info

### Response Guidelines:
- Present flights in a clear, organized format
- For award flights, always mention:
  - Miles required
  - Taxes/fees
  - Availability (seats left)
  - Airline and flight numbers
- For cash flights, mention:
  - Total price with currency
  - Duration and stops
  - Departure and arrival times
- Use tables for comparing multiple options when helpful
- Highlight best deals (lowest miles, lowest price, nonstop)
- Include booking recommendations
- Maintain conversational yet professional tone
- Maintain the language of the user's message

### Response Structure:
- Start with a summary (e.g., "Ich habe X Award-Flüge und Y Cash-Flüge gefunden")
- Group flights by type (Award vs Cash)
- Sort by best value (lowest miles for awards, lowest price for cash)
- Highlight best deals with emoji (✈️, ⭐, 💎)
- Provide next steps for booking

### Example Response Format:
Ich habe 3 hervorragende Award-Flüge von Frankfurt nach New York gefunden:

## Award-Flüge

### ⭐ 1. Lufthansa - Business Class
**Preis:** 85.000 Meilen + 450€ Steuern
**Abflug:** FRA um 10:30 Uhr
**Ankunft:** JFK um 13:15 Uhr (Ortszeit)
**Dauer:** 8h 45min
**Stops:** Nonstop
**Verfügbare Sitze:** 4

[Weitere Optionen...]

💡 **Empfehlung:** Option 1 bietet das beste Preis-Leistungs-Verhältnis mit Nonstop-Flug und guter Verfügbarkeit.
`,
  
  // ... rest of instructions
};
```

---

### Phase 6: Testing & Verification (2-3 Days)

**Goals:**
- Unit tests for all components
- Integration tests
- Manual testing
- Performance verification

#### 6.1 Unit Tests

**File:** `lib/api/seats-aero-client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSeatsAero } from './seats-aero-client';

describe('searchSeatsAero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search for business class flights', async () => {
    const params = {
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2025-03-15',
      travelClass: 'BUSINESS' as const,
      maxResults: 5,
    };

    const results = await searchSeatsAero(params);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeLessThanOrEqual(5);
    
    results.forEach((flight) => {
      expect(flight.provider).toBe('seatsaero');
      expect(flight.cabin).toBe('Business');
      expect(flight).toHaveProperty('price');
      expect(flight).toHaveProperty('miles');
    });
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));

    await expect(
      searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        travelClass: 'BUSINESS',
      })
    ).rejects.toThrow();
  });

  it('should apply date flexibility correctly', async () => {
    const params = {
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2025-03-15',
      travelClass: 'BUSINESS' as const,
      flexibility: 2,
    };

    // Mock fetch to capture request
    const fetchSpy = vi.spyOn(global, 'fetch');

    await searchSeatsAero(params);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('start_date=2025-03-13');
    expect(callUrl).toContain('end_date=2025-03-17');
  });
});
```

**File:** `lib/api/amadeus-client.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { searchAmadeus } from './amadeus-client';
import { getAmadeusToken } from './amadeus-token';

vi.mock('./amadeus-token');

describe('searchAmadeus', () => {
  it('should search for cash flights', async () => {
    vi.mocked(getAmadeusToken).mockResolvedValue('mock-token');

    const params = {
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2025-03-15',
      travelClass: 'BUSINESS',
      passengers: 1,
    };

    const results = await searchAmadeus(params);

    expect(results).toBeInstanceOf(Array);
    results.forEach((flight) => {
      expect(flight.provider).toBe('amadeus');
      expect(flight).toHaveProperty('price');
      expect(flight.price).toHaveProperty('total');
      expect(flight.price).toHaveProperty('currency');
    });
  });

  it('should include return date if provided', async () => {
    vi.mocked(getAmadeusToken).mockResolvedValue('mock-token');
    const fetchSpy = vi.spyOn(global, 'fetch');

    await searchAmadeus({
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2025-03-15',
      returnDate: '2025-03-22',
      travelClass: 'ECONOMY',
      passengers: 2,
    });

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('returnDate=2025-03-22');
    expect(callUrl).toContain('adults=2');
  });
});
```

**File:** `lib/api/amadeus-token.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAmadeusToken, cleanupExpiredTokens } from './amadeus-token';
import { db } from '@/lib/db/drizzle';

describe('getAmadeusToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cached token if valid', async () => {
    // Mock database to return valid token
    const mockToken = {
      accessToken: 'cached-token',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    vi.spyOn(db.query.amadeusTokens, 'findFirst').mockResolvedValueOnce(mockToken as any);

    const token = await getAmadeusToken('test');
    expect(token).toBe('cached-token');
  });

  it('should request new token if cache expired', async () => {
    // Mock database to return no token
    vi.spyOn(db.query.amadeusTokens, 'findFirst').mockResolvedValueOnce(undefined);

    // Mock fetch for token request
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 1800,
      }),
    } as any);

    const token = await getAmadeusToken('test');
    expect(token).toBe('new-token');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('oauth2/token'),
      expect.any(Object)
    );
  });
});
```

**File:** `lib/db/queries/tool-calls.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { recordToolCall, updateToolCall, getToolCallById } from './tool-calls';
import { db } from '@/lib/db/drizzle';

describe('Tool-Call Registry', () => {
  it('should record a new tool call', async () => {
    const result = await recordToolCall({
      chatId: 'test-chat-id',
      toolName: 'search_flights',
      request: { origin: 'FRA', destination: 'JFK' },
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('dedupeKey');

    const stored = await getToolCallById(result.id);
    expect(stored?.toolName).toBe('search_flights');
    expect(stored?.status).toBe('queued');
  });

  it('should prevent duplicate tool calls', async () => {
    const params = {
      chatId: 'test-chat-id',
      toolName: 'search_flights',
      request: { origin: 'FRA', destination: 'JFK' },
    };

    const first = await recordToolCall(params);
    const second = await recordToolCall(params);

    // Should return same ID
    expect(first.id).toBe(second.id);
    expect(first.dedupeKey).toBe(second.dedupeKey);
  });

  it('should update tool call status', async () => {
    const { id } = await recordToolCall({
      chatId: 'test-chat-id',
      toolName: 'search_flights',
      request: {},
    });

    await updateToolCall(id, {
      status: 'running',
      startedAt: new Date(),
    });

    const updated = await getToolCallById(id);
    expect(updated?.status).toBe('running');
    expect(updated?.startedAt).toBeInstanceOf(Date);
  });
});
```

#### 6.2 Integration Tests

**File:** `lib/tools/flight-search.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { flightSearchTool } from './flight-search';

describe('Flight Search Tool Integration', () => {
  it('should execute complete flight search flow', async () => {
    const params = {
      origin: 'FRA',
      destination: 'JFK',
      departDate: '2025-03-15',
      cabin: 'BUSINESS' as const,
      passengers: 1,
      awardOnly: true,
      flexibility: 0,
      nonStop: false,
    };

    const result = await flightSearchTool.execute(params, {
      abortSignal: new AbortController().signal,
      messages: [{ chatId: 'test-chat' }] as any,
    });

    expect(result).toBeTypeOf('string');
    expect(result).toContain('Award-Flüge');
  }, 30000); // 30s timeout for API calls
});
```

#### 6.3 Manual Test Checklist

- [ ] Test Query: "Suche Business Class Flüge von Frankfurt nach New York am 15. März 2025"
- [ ] Test Query: "Zeige mir die günstigsten Award-Flüge von FRA nach JFK"
- [ ] Test Query: "Ich brauche einen Hin- und Rückflug von München nach Tokyo im Juni"
- [ ] Test Query: "Gibt es Nonstop-Flüge von Berlin nach San Francisco?"
- [ ] Test Query: "Zeige mir First Class Optionen mit Miles & More"
- [ ] Error Handling: Test with invalid dates
- [ ] Error Handling: Test with invalid airport codes
- [ ] Error Handling: Test when both APIs fail
- [ ] Performance: Measure response time (<5s target)
- [ ] Deduplication: Run same query twice, check DB for single entry
- [ ] Token Management: Verify Amadeus token is cached
- [ ] Session State: Verify last_flight_request is stored

---

### Phase 7: Deployment (1-2 Days)

**Goals:**
- Deploy to staging
- Production rollout with feature flag
- Monitoring setup

#### 7.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables set in Vercel
- [ ] Database migrations applied
- [ ] API credentials verified
- [ ] Documentation updated
- [ ] Feature flag implemented

#### 7.2 Feature Flag

**File:** `lib/features.ts` (create)

```typescript
export const FEATURES = {
  FLIGHT_SEARCH: process.env.NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH === 'true',
} as const;
```

**Usage in UI:**

```typescript
import { FEATURES } from '@/lib/features';

// Only show flights group if feature is enabled
if (FEATURES.FLIGHT_SEARCH) {
  // Show flight search options
}
```

#### 7.3 Deployment Steps

1. **Staging Deployment:**
   ```bash
   # Deploy to preview branch
   git checkout -b feature/flight-search
   git add .
   git commit -m "feat: add flight search tool integration"
   git push origin feature/flight-search
   ```

2. **Enable Feature Flag on Staging:**
   ```bash
   vercel env add NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH
   # Value: true
   # Environments: Preview
   ```

3. **Test on Staging:**
   - Run through test checklist
   - Verify API calls
   - Check performance
   - Verify tool-call registry

4. **Production Rollout:**
   ```bash
   # Merge to main
   git checkout main
   git merge feature/flight-search
   git push origin main
   ```

5. **Enable in Production (Gradual):**
   ```bash
   # Start with false, then enable
   vercel env add NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH
   # Value: false → true
   # Environment: Production
   ```

---

## 📊 Timeline Summary

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 0: Preparation** | DB schemas, env vars, structure | 1-2 days | None |
| **Phase 1: Infrastructure** | Tool-call registry, state, tokens | 2-3 days | Phase 0 |
| **Phase 2: Seats.aero** | API client, integration | 2-3 days | Phase 1 |
| **Phase 3: Amadeus** | API client, token mgmt | 2-3 days | Phase 1 |
| **Phase 4: Flight Tool** | Tool implementation | 1-2 days | Phase 2, 3 |
| **Phase 5: Chat Integration** | Registration, instructions | 1-2 days | Phase 4 |
| **Phase 6: Testing** | Unit, integration, manual | 2-3 days | Phase 5 |
| **Phase 7: Deployment** | Staging, production | 1-2 days | Phase 6 |
| **TOTAL** | | **11-18 days** | |

---

## 🎯 Success Criteria

**Functional:**
- [ ] Flight search returns results from both APIs
- [ ] Tool-call registry tracks all executions
- [ ] Session state persists between requests
- [ ] Amadeus token caching works
- [ ] Error handling gracefully degrades
- [ ] Deduplication prevents duplicate calls

**Performance:**
- [ ] Response time < 5 seconds (95th percentile)
- [ ] API success rate > 95%
- [ ] Token cache hit rate > 90%

**Quality:**
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Code follows AGENTS.md guidelines (≤600 lines per file)

---

## 🚨 Risk Mitigation

**If Seats.aero fails:**
- Gracefully continue with Amadeus results only
- Log error for monitoring
- Display message: "Award-Suche temporär nicht verfügbar"

**If Amadeus fails:**
- Gracefully continue with Seats.aero results only
- Log error for monitoring
- Display message: "Cash-Flug-Suche temporär nicht verfügbar"

**If both fail:**
- Return helpful error message
- Suggest alternative search parameters
- Log critical error

**Rollback Plan:**
1. Disable feature flag: `NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false`
2. If severe: `vercel rollback`
3. If database issues: Run rollback migration

---

## 📝 Documentation Updates

After implementation, update:

- [ ] `README.md` - Add flight search feature
- [ ] `documentation/features/flight-search.md` - Complete guide
- [ ] `documentation/api/tools.md` - Tool documentation
- [ ] `.env.example` - Add new environment variables

---

## 🎉 Next Steps

After successful deployment:

1. **Monitor for 1 week:**
   - API performance
   - Error rates
   - User feedback

2. **Phase 2 (Optional):**
   - Knowledge Base RAG integration
   - Hotel search integration
   - Car rental integration

3. **Enhancements:**
   - Multi-city search
   - Flexible date calendar
   - Price alerts
   - Booking integration

---

**Plan Created:** 31. Oktober 2024  
**Next:** Begin Phase 0 Implementation
