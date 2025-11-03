# V1 zu V2 Tool-Calling Migration Plan
## MYLO Travel Concierge - Umfassender Research und Implementierungsplan

**Erstellt am:** 31. Oktober 2024  
**Status:** Research & Planning Phase  
**Ziel:** Migration des V1 Tool-Calling-Systems (Seats.aero, Amadeus, Knowledge Base) in die V2-Architektur

---

## Executive Summary

Dieses Dokument beschreibt den vollständigen Plan zur Migration des Tool-Calling-Systems von V1 (Supabase-basiert) zu V2 (Next.js + Vercel AI SDK). Der Fokus liegt auf der Integration der Flugsuche-Tools (Seats.aero, Amadeus) und später der Knowledge Base.

**Hauptziele:**
1. ✈️ Seats.aero Integration für Award-Flugsuche
2. 🌍 Amadeus Integration für Cash-Flugsuche
3. 📚 Knowledge Base RAG-System (Phase 2)

---

## Teil 1: Architektur-Analyse

### 1.1 V1 Architektur (Production)

**Technologie-Stack:**
- **Platform:** Supabase Edge Functions (Deno)
- **LLM:** OpenAI GPT (Function Calling API)
- **Database:** PostgreSQL (Supabase)
- **Tool-Definition:** JSON-Schema für OpenAI Function Calling
- **Deployment:** Separate Edge Functions als Microservices

**Hauptkomponenten:**
```
User Message
    ↓
Chat-RAG Function (Main Entry)
    ↓
OpenAI GPT → Tool-Call Decision
    ↓
Tool Call Registry (DB)
    ↓
runToolPipeline()
    ↓
executeTool() → Router
    ↓
┌─────────────────────────────────────┐
│ Tool-spezifische Edge Functions:    │
│ - seatsaero-flight-search           │
│ - amadeus-flight-search             │
│ - Weitere Tools                     │
└─────────────────────────────────────┘
    ↓
Externe APIs (Seats.aero, Amadeus)
    ↓
Response → DB Update → User
```

**Tool-Call Registry (Datenbank):**
```sql
CREATE TABLE tool_call (
  id uuid PRIMARY KEY,
  chat_id uuid REFERENCES chats(id),
  tool_name text NOT NULL,
  status tool_call_status DEFAULT 'queued',
  request jsonb,
  response jsonb,
  error text,
  dedupe_key text UNIQUE,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TYPE tool_call_status AS ENUM (
  'queued', 'running', 'succeeded', 
  'failed', 'timeout', 'canceled'
);
```

**V1 Tool-Definition Beispiel (JSON-Schema):**
```typescript
const toolSchemas = [{
  type: 'function',
  function: {
    name: 'search_flights',
    description: 'Tool 1: Seats.aero / Amadeus flight search...',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', minLength: 3, maxLength: 3 },
        destination: { type: 'string', minLength: 3, maxLength: 3 },
        depart_date: { type: 'string', format: 'date' },
        return_date: { type: 'string', format: 'date', nullable: true },
        cabin: { 
          type: 'string', 
          enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] 
        },
        award_only: { type: 'boolean', default: true },
        // ... weitere Parameter
      },
      required: ['origin', 'destination', 'depart_date', 'cabin']
    }
  }
}];
```

**V1 Tool Execution Pipeline:**
```typescript
async function runToolPipeline(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // 1. Tool-Call in DB registrieren
  const toolCallId = await recordToolCall(toolName, toolArgs);
  
  // 2. Status: queued → running
  await updateToolCall(toolCallId, { status: 'running' });
  
  // 3. Tool ausführen
  const result = await executeTool(toolName, toolArgs, ctx, toolCallId);
  
  // 4. Session State aktualisieren
  if (result.statePatch) {
    await mergeSessionState(ctx.chatId, result.statePatch);
  }
  
  // 5. Status: running → succeeded/failed
  await updateToolCall(toolCallId, {
    status: result.status,
    response: result.raw,
    finished_at: new Date()
  });
  
  return result;
}
```

**V1 Seats.aero Integration:**

*Edge Function: `seatsaero-flight-search/index.ts`*
```typescript
async function runSeatSearch(params: {
  origin: string;
  destination: string;
  departureDate: string;
  travelClass: ClassKey;
  flexibility?: number;
  maxResults: number;
}) {
  // 1. API-Request zu Seats.aero Partner API
  const searchUrl = new URL(`${SEATSAERO_BASE_URL}/search`);
  searchUrl.searchParams.set("origin_airport", origin);
  searchUrl.searchParams.set("destination_airport", destination);
  searchUrl.searchParams.set("cabin", apiValue); // "economy", "business", etc.
  searchUrl.searchParams.set("start_date", startDate);
  searchUrl.searchParams.set("end_date", endDate);
  searchUrl.searchParams.set("take", "10");
  
  // 2. API-Aufruf mit Partner Authorization
  const response = await fetch(searchUrl, {
    headers: {
      'Partner-Authorization': `Bearer ${SEATSAERO_API_KEY}`
    }
  });
  
  // 3. Ergebnisse verarbeiten
  const data = await response.json();
  const flights = data.data
    .filter(entry => hasAvailability(entry))
    .sort((a, b) => getMiles(a) - getMiles(b))
    .slice(0, maxResults);
  
  // 4. Trip-Details für jeden Flug laden
  return { flights, stats };
}
```

**V1 Amadeus Integration:**

*Edge Function: `amadeus-flight-search/index.ts`*
```typescript
// Token-Management (gecacht in DB)
async function getAmadeusToken(): Promise<string> {
  // 1. Gecachten Token prüfen
  const cached = await supabase.rpc("get_amadeus_token_for_api");
  if (cached && cached.expires_at > Date.now()) {
    return cached.access_token;
  }
  
  // 2. Neuen Token anfordern
  const tokenResponse = await fetch(
    `${AMADEUS_API_URL}/v1/security/oauth2/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AMADEUS_CLIENT_ID,
        client_secret: AMADEUS_CLIENT_SECRET,
      }),
    }
  );
  
  const tokenData = await tokenResponse.json();
  
  // 3. Token in DB speichern
  await supabase.rpc("store_amadeus_token_secure", {
    p_access_token: tokenData.access_token,
    p_expires_in: tokenData.expires_in,
  });
  
  return tokenData.access_token;
}

// Flight Search
async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
  const token = await getAmadeusToken();
  
  const response = await fetch(
    `${AMADEUS_API_URL}/v2/shopping/flight-offers?${searchParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.amadeus+json",
      },
    }
  );
  
  return await response.json();
}
```

**V1 Tool Execution in Main Chat:**
```typescript
// In chat-rag/index.ts
const completion = await callOpenAI(messages, toolSchemas);
const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  
  emit("tool_started", { 
    tool: toolCall.function.name, 
    job_id: toolCallId 
  });
  
  const result = await runToolPipeline(
    toolCall.function.name, 
    args, 
    ctx
  );
  
  emit("assistant_token", { content: result.finalText });
}
```

---

### 1.2 V2 Architektur (Aktuelle Entwicklung)

**Technologie-Stack:**
- **Platform:** Next.js 15 (App Router) auf Vercel
- **LLM:** OpenAI GPT-5 (fest konfiguriert)
- **Database:** PostgreSQL (Drizzle ORM)
- **Tool-Definition:** Zod + Vercel AI SDK `tool()` Funktion
- **Deployment:** Next.js API Routes (serverless)

**Hauptkomponenten:**
```
User Message
    ↓
/api/search/route.ts (Main Entry)
    ↓
Vercel AI SDK streamText()
    ↓
┌─────────────────────────────────────┐
│ Tools in /lib/tools/:               │
│ - web-search.ts                     │
│ - academic-search.ts                │
│ - youtube-search.ts                 │
│ - extreme-search.ts                 │
│ - stock-chart.ts                    │
│ - weather.ts                        │
│ - ... (23 Tools total)              │
│ ❌ FEHLT: Amadeus, Seats.aero       │
└─────────────────────────────────────┘
    ↓
Externe APIs (Parallel AI, Tavily, etc.)
    ↓
Stream Response → User
```

**V2 Tool-Definition Beispiel (Zod + Vercel AI SDK):**
```typescript
// lib/tools/web-search.ts
import { tool } from 'ai';
import { z } from 'zod';

export const webSearchTool = (dataStream: UIMessageStreamWriter) => 
  tool({
    description: 'Search the web for information',
    parameters: z.object({
      queries: z.array(z.string()).min(3).max(5)
        .describe('Array of search queries'),
      maxResults: z.array(z.number()).min(1)
        .describe('Max results per query'),
      topics: z.array(z.enum(['general', 'news']))
        .describe('Topic types'),
      quality: z.array(z.enum(['default', 'best']))
        .describe('Search quality level')
    }),
    execute: async ({ queries, maxResults, topics, quality }) => {
      // Tool-Logik hier
      const results = await searchProvider.search(queries, {
        maxResults,
        topics,
        quality
      });
      
      // Streaming-Updates
      dataStream?.write({
        type: 'data-query_completion',
        data: { query, status: 'completed' }
      });
      
      return results;
    }
  });
```

**V2 Tool Integration in Chat:**
```typescript
// app/api/search/route.ts
const result = streamText({
  model: languageModel, // GPT-5
  messages: convertToModelMessages(messages),
  system: instructions + customInstructions,
  toolChoice: 'auto',
  tools: {
    web_search: webSearchTool(dataStream),
    academic_search: academicSearchTool,
    youtube_search: youtubeSearchTool,
    stock_chart: stockChartTool,
    weather: weatherTool,
    // ... weitere Tools
    // ❌ FEHLT: search_flights, amadeus_search, seats_aero_search
  }
});
```

**V2 Tool-Gruppen System:**
```typescript
// app/actions.ts
const groupTools = {
  web: ['web_search', 'greeting', 'code_interpreter', ...],
  academic: ['academic_search', 'code_interpreter', 'datetime'],
  youtube: ['youtube_search', 'datetime'],
  stocks: ['stock_chart', 'currency_converter', 'datetime'],
  chat: [], // Kein Tool-Calling
  // ... weitere Gruppen
};

const groupInstructions = {
  web: `You are an AI web search engine...`,
  academic: `You are an academic research assistant...`,
  // ... weitere Instructions
};
```

---

## Teil 2: Gap-Analyse

### 2.1 Fehlende Komponenten in V2

#### ❌ Kritisch Fehlend:

1. **Flugsuche-Tools**
   - ❌ `search_flights` Tool
   - ❌ Seats.aero Integration
   - ❌ Amadeus Integration
   - ❌ Flight Search Tool Group

2. **Tool-Call Registry**
   - ❌ Tool-Call-Tracking in Database
   - ❌ Status-Management (queued, running, succeeded, failed)
   - ❌ Deduplizierung via dedupe_key
   - ❌ Audit-Trail für Tool-Ausführungen

3. **Session State Management**
   - ❌ `last_flight_request` State
   - ❌ `pending_flight_request` State
   - ❌ State Persistence zwischen Tool-Calls

4. **API-Credentials & Token-Management**
   - ❌ Seats.aero API Key
   - ❌ Amadeus OAuth2 Token-Management
   - ❌ Token-Caching in Database

#### ⚠️ Teilweise Vorhanden:

1. **Knowledge Base / RAG**
   - ✅ Memory-System (Supermemory-basiert) vorhanden
   - ❌ RAG mit pgvector wie in V1 fehlt
   - ❌ Hybrid Search (BM25 + Vector) fehlt

2. **Code Interpreter**
   - ✅ Vorhanden in V2
   - ✅ Ähnliche Implementierung wie V1

---

### 2.2 Architektur-Unterschiede

| Aspekt | V1 (Production) | V2 (Development) | Migration Impact |
|--------|-----------------|------------------|------------------|
| **Deployment** | Supabase Edge Functions | Next.js API Routes | **Hoch** - Komplette Umstrukturierung |
| **Tool-Definition** | JSON-Schema | Zod + AI SDK | **Mittel** - Schema-Konvertierung |
| **Tool-Execution** | Separate Edge Functions | Inline in Next.js | **Mittel** - Code-Refactoring |
| **Database** | Supabase PostgreSQL | Drizzle + PostgreSQL | **Niedrig** - Gleiche DB, anderes ORM |
| **LLM** | OpenAI GPT (variabel) | GPT-5 (fix) | **Niedrig** - Kompatibel |
| **Streaming** | SSE (custom) | Vercel AI SDK | **Mittel** - Stream-Format anders |
| **Token-Management** | In DB gecacht | ❌ Fehlt | **Hoch** - Neu implementieren |
| **Tool Registry** | Vorhanden | ❌ Fehlt | **Hoch** - Neu implementieren |

---

## Teil 3: Migrations-Strategie

### 3.1 Architektur-Ansätze

#### Option A: Full Next.js Migration (Empfohlen)
**Beschreibung:** Alle Tools direkt in Next.js implementieren, ohne Edge Functions.

**Vorteile:**
- ✅ Einheitliche Codebasis
- ✅ Einfacheres Deployment (alles auf Vercel)
- ✅ Besseres Developer Experience
- ✅ Nutzung des Vercel AI SDK
- ✅ Einfacheres Debugging

**Nachteile:**
- ⚠️ API-Calls laufen über Next.js (längere Response-Zeiten?)
- ⚠️ Token-Management muss neu implementiert werden
- ⚠️ Komplette Code-Migration nötig

**Implementierung:**
```typescript
// lib/tools/flight-search.ts
export const flightSearchTool = tool({
  description: 'Search for flights using Seats.aero and Amadeus',
  parameters: z.object({
    origin: z.string().length(3),
    destination: z.string().length(3),
    departDate: z.string(),
    cabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']),
    // ...
  }),
  execute: async (params) => {
    // API-Calls direkt hier
    const [seatsResult, amadeusResult] = await Promise.all([
      fetchSeatsAero(params),
      fetchAmadeus(params)
    ]);
    return formatResults(seatsResult, amadeusResult);
  }
});
```

---

#### Option B: Hybrid mit Edge Functions
**Beschreibung:** Behalte Supabase Edge Functions, rufe sie von Next.js aus auf.

**Vorteile:**
- ✅ Minimale Migration der bestehenden Edge Functions
- ✅ Edge Functions bleiben unverändert
- ✅ Schnellere initiale Migration

**Nachteile:**
- ❌ Zwei separate Deployments (Vercel + Supabase)
- ❌ Komplexere Infrastruktur
- ❌ Höhere Latenz (Extra Network Hop)
- ❌ Schwierigeres Debugging
- ❌ Doppelte Token-/Credential-Verwaltung

**Implementierung:**
```typescript
// lib/tools/flight-search.ts
export const flightSearchTool = tool({
  description: 'Search for flights',
  parameters: z.object({ /* ... */ }),
  execute: async (params) => {
    // Aufruf der Supabase Edge Function
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/seatsaero-flight-search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      }
    );
    return await response.json();
  }
});
```

---

#### ⭐ Empfehlung: Option A (Full Next.js Migration)

**Begründung:**
1. **Langfristige Wartbarkeit:** Einheitliche Codebasis ist einfacher zu warten
2. **Developer Experience:** Ein Projekt statt zwei
3. **Kosten:** Nur Vercel-Deployment (Supabase nur für DB)
4. **Debugging:** Alles im gleichen Stack
5. **Zukunftssicherheit:** V2 ist die Hauptplattform

**Trade-off:**
- Initiale Migration dauert länger, aber langfristig besser

---

### 3.2 Implementierungs-Phasen

#### Phase 0: Vorbereitung (1-2 Tage)
**Ziele:**
- Database-Schema für Tool-Call-Registry erstellen
- Environment-Variablen vorbereiten
- API-Keys organisieren

**Tasks:**
- [ ] Drizzle-Schema für `tool_call` Tabelle erstellen
- [ ] Amadeus API Credentials in Vercel Secrets speichern
- [ ] Seats.aero API Key in Vercel Secrets speichern
- [ ] Migration-Script für DB-Schema erstellen

---

#### Phase 1: Tool-Call Infrastructure (2-3 Tage)
**Ziele:**
- Tool-Call-Registry implementieren
- Session State Management
- Token-Management für Amadeus

**Tasks:**

1. **Database Schema (Drizzle):**
```typescript
// lib/db/schema/tool-calls.ts
export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id).notNull(),
  toolName: text('tool_name').notNull(),
  status: text('status', { 
    enum: ['queued', 'running', 'succeeded', 'failed', 'timeout', 'canceled'] 
  }).default('queued').notNull(),
  request: jsonb('request'),
  response: jsonb('response'),
  error: text('error'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

export const sessionStates = pgTable('session_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id).unique().notNull(),
  state: jsonb('state').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const amadeusTokens = pgTable('amadeus_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: text('environment').notNull(), // 'test' or 'prod'
  accessToken: text('access_token').notNull(),
  tokenType: text('token_type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. **Tool-Call Registry Functions:**
```typescript
// lib/db/queries/tool-calls.ts
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
  
  // Check for existing
  const existing = await db.query.toolCalls.findFirst({
    where: eq(toolCalls.dedupeKey, dedupeKey),
  });
  
  if (existing) {
    return { id: existing.id, dedupeKey };
  }
  
  // Insert new
  const [result] = await db.insert(toolCalls).values({
    chatId: params.chatId,
    toolName: params.toolName,
    status: 'queued',
    request: params.request,
    dedupeKey,
  }).returning({ id: toolCalls.id });
  
  return { id: result.id, dedupeKey };
}

export async function updateToolCall(
  id: string,
  update: Partial<typeof toolCalls.$inferInsert>
) {
  await db.update(toolCalls)
    .set(update)
    .where(eq(toolCalls.id, id));
}
```

3. **Session State Management:**
```typescript
// lib/db/queries/session-state.ts
export async function getSessionState(chatId: string) {
  const result = await db.query.sessionStates.findFirst({
    where: eq(sessionStates.chatId, chatId),
  });
  return result?.state || {};
}

export async function mergeSessionState(
  chatId: string,
  patch: Record<string, unknown>
) {
  const current = await getSessionState(chatId);
  const merged = { ...current, ...patch };
  
  await db.insert(sessionStates)
    .values({
      chatId,
      state: merged,
    })
    .onConflictDoUpdate({
      target: sessionStates.chatId,
      set: { state: merged, updatedAt: new Date() },
    });
  
  return merged;
}
```

4. **Amadeus Token Management:**
```typescript
// lib/api/amadeus-token.ts
export async function getAmadeusToken(
  environment: 'test' | 'prod' = 'test'
): Promise<string> {
  // 1. Check cache
  const cached = await db.query.amadeusTokens.findFirst({
    where: eq(amadeusTokens.environment, environment),
    orderBy: desc(amadeusTokens.createdAt),
  });
  
  if (cached && cached.expiresAt > new Date()) {
    return cached.accessToken;
  }
  
  // 2. Request new token
  const baseUrl = environment === 'prod' 
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';
    
  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  });
  
  const data = await response.json();
  
  // 3. Store token
  await db.insert(amadeusTokens).values({
    environment,
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  });
  
  return data.access_token;
}
```

---

#### Phase 2: Seats.aero Integration (2-3 Tage)
**Ziele:**
- Seats.aero API Client implementieren
- Flight Search Tool erstellen
- Ergebnis-Formatierung

**Tasks:**

1. **Seats.aero API Client:**
```typescript
// lib/api/seats-aero-client.ts
const SEATSAERO_BASE_URL = 'https://seats.aero/partnerapi';

const CLASS_MAP = {
  ECONOMY: { key: 'Y', cabin: 'Economy', apiValue: 'economy' },
  PREMIUM_ECONOMY: { key: 'W', cabin: 'Premium Economy', apiValue: 'premium' },
  BUSINESS: { key: 'J', cabin: 'Business', apiValue: 'business' },
  FIRST: { key: 'F', cabin: 'First', apiValue: 'first' },
} as const;

export interface SeatsAeroSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  travelClass: keyof typeof CLASS_MAP;
  flexibility?: number;
  maxResults?: number;
}

export interface SeatsAeroFlight {
  id: string;
  provider: 'seatsaero';
  price: string;
  airline: string;
  cabin: string;
  miles: number | null;
  taxes: { amount: number | null; currency: string | null };
  seatsLeft: number | null;
  outbound: {
    departure: { airport: string; time: string };
    arrival: { airport: string; time: string };
    duration: string;
    stops: string;
  };
}

export async function searchSeatsAero(
  params: SeatsAeroSearchParams
): Promise<SeatsAeroFlight[]> {
  const { key, apiValue } = CLASS_MAP[params.travelClass];
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
  
  // API Call
  const response = await fetch(searchUrl.toString(), {
    headers: {
      'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Seats.aero API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Process results
  const entries = Array.isArray(data.data) ? data.data : [];
  const filtered = entries
    .filter(entry => hasAvailability(entry, key))
    .sort((a, b) => getMiles(a, key) - getMiles(b, key))
    .slice(0, params.maxResults || 10);
  
  // Load trip details for each flight
  const flights: SeatsAeroFlight[] = [];
  for (const entry of filtered) {
    const flight = await loadFlightDetails(entry, key);
    if (flight) flights.push(flight);
  }
  
  return flights;
}

async function loadFlightDetails(
  entry: any,
  cabinKey: string
): Promise<SeatsAeroFlight | null> {
  const tripId = entry[`${cabinKey.toLowerCase()}TripId`];
  if (!tripId) return null;
  
  const tripUrl = `${SEATSAERO_BASE_URL}/trip/${tripId}`;
  const response = await fetch(tripUrl, {
    headers: {
      'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
    },
  });
  
  if (!response.ok) return null;
  
  const trip = await response.json();
  
  // Format flight data
  return {
    id: tripId,
    provider: 'seatsaero',
    price: formatPrice(trip),
    airline: trip.airline || 'Unknown',
    cabin: CLASS_MAP[cabinKey as keyof typeof CLASS_MAP].cabin,
    miles: getMiles(entry, cabinKey),
    taxes: extractTaxes(trip),
    seatsLeft: getSeatsLeft(entry, cabinKey),
    outbound: formatSegment(trip.outbound),
  };
}

function hasAvailability(entry: any, key: string): boolean {
  const available = entry[`${key.toLowerCase()}Available`];
  const seats = entry[`${key.toLowerCase()}Seats`];
  return Boolean(available || (seats && seats > 0));
}

function getMiles(entry: any, key: string): number {
  return entry[`${key.toLowerCase()}Miles`] || Infinity;
}
```

2. **Flight Search Tool:**
```typescript
// lib/tools/flight-search.ts
import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero } from '@/lib/api/seats-aero-client';
import { searchAmadeus } from '@/lib/api/amadeus-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries/tool-calls';
import { mergeSessionState } from '@/lib/db/queries/session-state';

export const flightSearchTool = tool({
  description: `Search for flights using Seats.aero (award flights) and Amadeus (cash flights).
  
  This tool searches both:
  - Seats.aero: Award flights bookable with miles/points
  - Amadeus: Regular cash flights
  
  Results are returned with pricing, availability, and booking details.`,
  
  parameters: z.object({
    origin: z.string()
      .length(3)
      .describe('Origin airport IATA code (3 letters, e.g., FRA)'),
    destination: z.string()
      .length(3)
      .describe('Destination airport IATA code (3 letters, e.g., JFK)'),
    departDate: z.string()
      .describe('Departure date in YYYY-MM-DD format'),
    returnDate: z.string()
      .optional()
      .nullable()
      .describe('Return date in YYYY-MM-DD format (optional)'),
    cabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
      .describe('Cabin class'),
    passengers: z.number()
      .int()
      .min(1)
      .max(9)
      .default(1)
      .describe('Number of passengers'),
    awardOnly: z.boolean()
      .default(true)
      .describe('Search only award flights (true) or include cash flights (false)'),
    loyaltyPrograms: z.array(z.string())
      .optional()
      .describe('Preferred loyalty programs for award bookings'),
    flexibility: z.number()
      .int()
      .min(0)
      .max(3)
      .default(0)
      .describe('Date flexibility in days (0-3)'),
    nonStop: z.boolean()
      .default(false)
      .describe('Search only non-stop flights'),
    maxTaxes: z.number()
      .optional()
      .describe('Maximum taxes/fees for award flights (in USD)'),
    reuseLastRequest: z.boolean()
      .default(false)
      .describe('Reuse parameters from last flight search'),
  }),
  
  execute: async (params, { chatId }) => {
    // 1. Record tool call
    const { id: toolCallId } = await recordToolCall({
      chatId: chatId!,
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
          travelClass: params.cabin,
          flexibility: params.flexibility,
          maxResults: 5,
        }).catch(err => {
          console.warn('Seats.aero search failed:', err);
          return null;
        }),
        
        params.awardOnly ? Promise.resolve(null) : searchAmadeus({
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departDate,
          returnDate: params.returnDate,
          travelClass: params.cabin,
          passengers: params.passengers,
          nonStop: params.nonStop,
        }).catch(err => {
          console.warn('Amadeus search failed:', err);
          return null;
        }),
      ]);
      
      // 3. Format results
      const hasSeats = seatsResult && seatsResult.length > 0;
      const hasAmadeus = amadeusResult && amadeusResult.length > 0;
      
      if (!hasSeats && !hasAmadeus) {
        throw new Error('Keine Flüge gefunden');
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
      
      // 4. Update tool call status
      await updateToolCall(toolCallId, {
        status: 'succeeded',
        response: result,
        finishedAt: new Date(),
      });
      
      // 5. Update session state
      await mergeSessionState(chatId!, {
        last_flight_request: params,
        pending_flight_request: null,
      });
      
      // 6. Format response for LLM
      return formatFlightResults(result, params);
      
    } catch (error) {
      await updateToolCall(toolCallId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      });
      throw error;
    }
  },
});

function formatFlightResults(result: any, params: any): string {
  const sections: string[] = [];
  
  // Award Flights Section
  if (result.seats.count > 0) {
    sections.push(`## Award-Flüge (${result.seats.count} Ergebnisse)\n`);
    
    result.seats.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline} - ${flight.cabin}\n` +
        `**Preis:** ${flight.price}\n` +
        `**Abflug:** ${flight.outbound.departure.airport} → ${flight.outbound.arrival.airport}\n` +
        `**Zeit:** ${flight.outbound.departure.time} - ${flight.outbound.arrival.time}\n` +
        `**Dauer:** ${flight.outbound.duration}\n` +
        `**Stops:** ${flight.outbound.stops}\n` +
        `**Verfügbare Sitze:** ${flight.seatsLeft || 'N/A'}\n\n`
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
        `**Abflug:** ${flight.departure.airport} → ${flight.arrival.airport}\n` +
        `**Zeit:** ${flight.departure.time} - ${flight.arrival.time}\n\n`
      );
    });
  }
  
  return sections.join('\n');
}
```

---

#### Phase 3: Amadeus Integration (2-3 Tage)
**Ziele:**
- Amadeus API Client implementieren
- Token-Management integrieren
- Parallel-Ausführung mit Seats.aero

**Tasks:**

1. **Amadeus API Client:**
```typescript
// lib/api/amadeus-client.ts
import { getAmadeusToken } from './amadeus-token';

const AMADEUS_BASE_URL = process.env.AMADEUS_ENV === 'prod'
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
  };
  arrival: {
    airport: string;
    time: string;
  };
  duration: string;
  stops: number;
  bookingLink?: string;
}

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
    throw new Error(`Amadeus API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // 4. Process results
  const offers = Array.isArray(data.data) ? data.data : [];
  
  return offers.map(offer => ({
    id: offer.id,
    provider: 'amadeus',
    airline: offer.validatingAirlineCodes[0] || 'Unknown',
    price: {
      total: offer.price.grandTotal,
      base: offer.price.base,
      currency: offer.price.currency,
    },
    departure: {
      airport: offer.itineraries[0].segments[0].departure.iataCode,
      time: offer.itineraries[0].segments[0].departure.at,
    },
    arrival: {
      airport: offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.iataCode,
      time: offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.at,
    },
    duration: offer.itineraries[0].duration,
    stops: offer.itineraries[0].segments.length - 1,
  }));
}
```

---

#### Phase 4: Integration in Chat-System (1-2 Tage)
**Ziele:**
- Flight Search Tool in Tool-Liste registrieren
- Tool-Gruppe "flights" erstellen
- Instructions anpassen

**Tasks:**

1. **Tool-Registration:**
```typescript
// app/api/search/route.ts

// Import flight search tool
import { flightSearchTool } from '@/lib/tools/flight-search';

// In streamText() tools object:
const result = streamText({
  model: languageModel,
  messages: convertToModelMessages(messages),
  system: instructions + customInstructions,
  toolChoice: 'auto',
  tools: {
    // ... existing tools
    search_flights: flightSearchTool,
  },
});
```

2. **Tool-Gruppe "flights":**
```typescript
// app/actions.ts

const groupTools = {
  web: ['web_search', 'greeting', ...],
  academic: ['academic_search', ...],
  // ... existing groups
  
  // ✨ Neue Gruppe für Flugsuche
  flights: ['search_flights', 'datetime', 'greeting'],
};

const groupInstructions = {
  web: `You are an AI web search engine...`,
  academic: `You are an academic research assistant...`,
  // ... existing instructions
  
  // ✨ Neue Instructions für Flugsuche
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
  - Loyalty program
- For cash flights, mention:
  - Total price
  - Currency
  - Booking class
- Use tables for comparing multiple options
- Include booking recommendations
- Maintain conversational yet professional tone
- All citations must be inline, placed immediately after the relevant information
- Maintain the language of the user's message

### Citation Requirements:
- ⚠️ MANDATORY: Every flight must be cited with source
- Format: [Seats.aero](URL) or [Amadeus](URL)
- Place citations immediately after flight information

### Response Structure:
- Start with a summary of search results
- Group flights by type (Award vs Cash)
- Sort by best value
- Highlight best deals
- Provide booking next steps
`,
};
```

---

#### Phase 5: Testing & Debugging (2-3 Tage)
**Ziele:**
- End-to-End Tests
- Error Handling verifizieren
- Performance-Optimierung

**Tasks:**
- [ ] Test: Seats.aero API-Calls
- [ ] Test: Amadeus API-Calls mit Token-Management
- [ ] Test: Parallele Ausführung beider APIs
- [ ] Test: Fehlerbehandlung bei API-Failures
- [ ] Test: Deduplizierung von Tool-Calls
- [ ] Test: Session State Persistence
- [ ] Performance: Response-Zeiten messen
- [ ] Performance: Token-Caching verifizieren
- [ ] UX: Streaming-Updates testen

---

#### Phase 6: Knowledge Base Integration (Phase 2 - Optional)
**Ziele:**
- RAG-System aus V1 portieren
- Hybrid Search (BM25 + Vector)
- Knowledge Base Tool erstellen

*Details folgen nach Phase 1-5 Completion*

---

## Teil 4: Technische Details

### 4.1 Environment Variables

**Erforderliche Secrets in Vercel:**
```bash
# Amadeus API
AMADEUS_API_KEY=<Client ID>
AMADEUS_API_SECRET=<Client Secret>
AMADEUS_ENV=test # oder 'prod'

# Seats.aero API
SEATSAERO_API_KEY=<Partner API Key>

# OpenAI (bereits vorhanden)
OPENAI_API_KEY=<API Key>

# Database (bereits vorhanden)
DATABASE_URL=<PostgreSQL Connection String>
```

---

### 4.2 Database Migrations

**Migration erstellen:**
```bash
# Drizzle migration erstellen
pnpm drizzle-kit generate:pg

# Migration ausführen
pnpm drizzle-kit push:pg
```

**Migration Files:**
- `drizzle/migrations/XXXXXX_add_tool_calls_table.sql`
- `drizzle/migrations/XXXXXX_add_session_states_table.sql`
- `drizzle/migrations/XXXXXX_add_amadeus_tokens_table.sql`

---

### 4.3 Error Handling

**Graceful Degradation:**
```typescript
// Wenn Seats.aero fehlschlägt, trotzdem Amadeus-Ergebnisse zeigen
const [seatsResult, amadeusResult] = await Promise.all([
  searchSeatsAero(params).catch(err => {
    console.error('Seats.aero failed:', err);
    return null;
  }),
  searchAmadeus(params).catch(err => {
    console.error('Amadeus failed:', err);
    return null;
  }),
]);

if (!seatsResult && !amadeusResult) {
  throw new Error('Beide APIs sind fehlgeschlagen');
}

// Mindestens eine API hat funktioniert
return formatResults(seatsResult, amadeusResult);
```

**Tool-Call Retry-Strategie:**
```typescript
async function executeToolWithRetry(
  toolName: string,
  params: any,
  maxRetries: number = 3
) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeTool(toolName, params);
    } catch (error) {
      lastError = error;
      console.warn(`Tool ${toolName} attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  
  throw lastError;
}
```

---

### 4.4 Performance Optimierungen

**1. Token-Caching:**
- Amadeus-Token in Database cachen (TTL: ~30 Minuten)
- Bei jedem Request cached token prüfen

**2. Parallel API-Calls:**
- Seats.aero und Amadeus parallel aufrufen
- Promise.all() verwenden

**3. Database Connection Pooling:**
- Drizzle mit Connection Pool konfigurieren
- Max Connections: 10-20

**4. Response Caching (Optional):**
```typescript
// Redis-basiertes Caching für Flight Search Results
const cacheKey = createCacheKey(params);
const cached = await redis.get(cacheKey);

if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
  return cached.results;
}

const results = await searchFlights(params);
await redis.set(cacheKey, {
  results,
  timestamp: Date.now()
}, 'EX', 300); // 5 Minuten TTL

return results;
```

---

## Teil 5: Testing-Strategie

### 5.1 Unit Tests

**Test-Files:**
- `lib/api/seats-aero-client.test.ts`
- `lib/api/amadeus-client.test.ts`
- `lib/api/amadeus-token.test.ts`
- `lib/tools/flight-search.test.ts`

**Beispiel-Test:**
```typescript
// lib/api/seats-aero-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { searchSeatsAero } from './seats-aero-client';

describe('searchSeatsAero', () => {
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
    results.forEach(flight => {
      expect(flight.provider).toBe('seatsaero');
      expect(flight.cabin).toBe('Business');
    });
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('API Error')
    );
    
    await expect(searchSeatsAero({
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2025-03-15',
      travelClass: 'BUSINESS',
    })).rejects.toThrow();
  });
});
```

---

### 5.2 Integration Tests

**Test Scenarios:**
1. **End-to-End Flight Search:**
   - User sendet Flugsuche-Anfrage
   - Tool wird aufgerufen
   - Beide APIs werden parallel abgefragt
   - Ergebnisse werden formatiert
   - Response enthält Flüge

2. **Tool-Call Registry:**
   - Tool-Call wird in DB registriert
   - Status-Updates funktionieren
   - Deduplizierung verhindert doppelte Calls

3. **Token-Management:**
   - Amadeus-Token wird angefordert
   - Token wird gecacht
   - Gecachter Token wird wiederverwendet

---

### 5.3 Manual Testing Checklist

**Pre-Launch Checklist:**
- [ ] Seats.aero API-Key funktioniert
- [ ] Amadeus API-Credentials funktionieren (Test-Umgebung)
- [ ] Token-Caching funktioniert
- [ ] Parallele API-Calls funktionieren
- [ ] Error Handling bei API-Failures
- [ ] Deduplizierung von Tool-Calls
- [ ] Session State wird korrekt gespeichert
- [ ] Streaming-Updates im Chat
- [ ] Response-Formatierung korrekt
- [ ] Mobile-Ansicht funktioniert
- [ ] Performance ist akzeptabel (< 5s Response Time)

**Test-Queries:**
```
1. "Suche Business Class Flüge von Frankfurt nach New York am 15. März 2025"
2. "Zeige mir die günstigsten Award-Flüge von FRA nach JFK"
3. "Ich brauche einen Hin- und Rückflug von München nach Tokyo im Juni"
4. "Gibt es Nonstop-Flüge von Berlin nach San Francisco?"
5. "Zeige mir First Class Optionen mit Miles & More"
```

---

## Teil 6: Deployment-Plan

### 6.1 Pre-Deployment

**Checklist:**
- [ ] Environment Variables in Vercel setzen
- [ ] Database Migrations ausführen
- [ ] API-Keys verifizieren
- [ ] Tests durchführen (Unit + Integration)
- [ ] Performance-Tests
- [ ] Security Audit

**Secrets Setup:**
```bash
# Vercel CLI verwenden
vercel env add AMADEUS_API_KEY
vercel env add AMADEUS_API_SECRET
vercel env add SEATSAERO_API_KEY

# Oder via Vercel Dashboard:
# 1. Project Settings > Environment Variables
# 2. Add each secret for Production, Preview, Development
```

---

### 6.2 Staged Rollout

**Phase 1: Development (dev branch)**
- Deployment auf Preview-Branch
- Testing mit Test-Users
- Performance-Monitoring

**Phase 2: Staging (staging branch)**
- Deployment auf Staging-Environment
- Extended Testing
- Load Testing

**Phase 3: Production (main branch)**
- Feature Flag aktivieren
- Gradual Rollout (10% → 50% → 100%)
- Monitoring und Fehler-Tracking

**Feature Flag Setup:**
```typescript
// lib/features.ts
export const FEATURES = {
  FLIGHT_SEARCH: process.env.NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH === 'true',
};

// In Chat Component
if (FEATURES.FLIGHT_SEARCH) {
  // Show flight search group
} else {
  // Hide or disable
}
```

---

### 6.3 Monitoring & Alerts

**Metrics zu tracken:**
- API Response Times (Seats.aero, Amadeus)
- Tool-Call Success Rate
- Error Rate per API
- Token Cache Hit Rate
- Database Query Times

**Alert Setup (Vercel/Sentry):**
```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

export function trackToolCall(
  toolName: string,
  duration: number,
  success: boolean
) {
  Sentry.addBreadcrumb({
    category: 'tool-call',
    message: `${toolName} ${success ? 'succeeded' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: { duration },
  });
  
  if (!success) {
    Sentry.captureMessage(`Tool ${toolName} failed`, 'error');
  }
}
```

---

## Teil 7: Zeitplan & Ressourcen

### 7.1 Geschätzter Zeitplan

| Phase | Dauer | Details |
|-------|-------|---------|
| **Phase 0: Vorbereitung** | 1-2 Tage | DB-Schema, Credentials, Environment |
| **Phase 1: Infrastructure** | 2-3 Tage | Tool-Call Registry, Session State, Token-Mgmt |
| **Phase 2: Seats.aero** | 2-3 Tage | API Client, Tool-Integration |
| **Phase 3: Amadeus** | 2-3 Tage | API Client, Token-Management |
| **Phase 4: Chat Integration** | 1-2 Tage | Tool-Gruppe, Instructions |
| **Phase 5: Testing** | 2-3 Tage | Unit, Integration, E2E Tests |
| **Phase 6: Deployment** | 1-2 Tage | Staging, Production Rollout |
| **GESAMT** | **11-18 Tage** | **~2-3 Wochen** |

*Knowledge Base (Phase 2) hinzufügen: +1 Woche*

---

### 7.2 Ressourcen-Bedarf

**Entwickler:**
- 1 Full-Stack Developer (Next.js, TypeScript, APIs)

**APIs & Services:**
- Seats.aero Partner API Access
- Amadeus API Access (Test + Production)
- OpenAI API (bereits vorhanden)
- Vercel Hosting (bereits vorhanden)
- PostgreSQL Database (bereits vorhanden)

**Optional:**
- Redis für Response-Caching
- Sentry für Error-Tracking

---

## Teil 8: Risiken & Mitigation

### 8.1 Identifizierte Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| **Seats.aero API-Änderungen** | Mittel | Hoch | API-Version pinnen, Monitoring, Fallback zu Amadeus |
| **Amadeus Token-Issues** | Niedrig | Mittel | Retry-Logic, Token-Cache, Fallback-Mechanismus |
| **Performance-Probleme** | Mittel | Mittel | Parallel-Calls, Caching, Timeout-Handling |
| **Rate Limiting** | Niedrig | Niedrig | Request-Throttling, Backoff-Strategie |
| **Database-Load** | Niedrig | Mittel | Connection Pooling, Query-Optimierung |
| **Cost Overruns** | Mittel | Mittel | API-Call-Monitoring, Rate Limiting, Caching |

---

### 8.2 Rollback-Plan

**Wenn kritische Issues auftreten:**

1. **Feature Flag deaktivieren:**
```bash
vercel env add NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH false
```

2. **Sofortiges Rollback:**
```bash
# Zu vorheriger Deployment-Version
vercel rollback
```

3. **Database Rollback (falls nötig):**
```bash
# Migrations rückgängig machen
pnpm drizzle-kit drop
```

---

## Teil 9: Post-Launch

### 9.1 Monitoring Plan

**Metriken (erste 2 Wochen):**
- API Success Rate (Target: >95%)
- Response Time (Target: <5s)
- Error Rate (Target: <5%)
- User Engagement (Tool-Call Frequency)
- Cost per Search

**Dashboard Setup:**
- Vercel Analytics
- Custom Monitoring (API-Call-Tracking)
- Error Tracking (Sentry)

---

### 9.2 Iteration Plan

**Woche 1-2 (Post-Launch):**
- Bug Fixes
- Performance-Optimierungen
- User Feedback sammeln

**Woche 3-4:**
- Knowledge Base Integration (Phase 2)
- Additional Flight Search Features:
  - Multi-City Search
  - Flexible Date Calendar
  - Price Alerts

**Woche 5+:**
- Advanced Features:
  - Hotel Search Integration
  - Car Rental Search
  - Complete Trip Planning

---

## Teil 10: Zusammenfassung & Nächste Schritte

### 10.1 Kernpunkte

**Was wird implementiert:**
- ✈️ Flugsuche mit Seats.aero (Award) + Amadeus (Cash)
- 🔧 Tool-Call Infrastructure (Registry, State Management)
- 🎯 Neue Tool-Gruppe "flights" im Chat-System
- 🔐 Token-Management für Amadeus OAuth2

**Was wird NICHT implementiert (zunächst):**
- ❌ Knowledge Base / RAG (kommt in Phase 2)
- ❌ Supabase Edge Functions (alles in Next.js)
- ❌ Multi-City Search (könnte später kommen)

**Architektur-Entscheidung:**
- ⭐ **Option A: Full Next.js Migration** (Empfohlen)
- Alle Tools direkt in Next.js implementieren
- Keine Supabase Edge Functions
- Einheitliche Codebasis

---

### 10.2 Sofortige Nächste Schritte

**Phase 0 starten (diese Woche):**

1. **Database-Schema erstellen:**
```bash
# Schema-Files erstellen
touch lib/db/schema/tool-calls.ts
touch lib/db/schema/session-states.ts
touch lib/db/schema/amadeus-tokens.ts

# Migration generieren
pnpm drizzle-kit generate:pg

# Migration anwenden
pnpm drizzle-kit push:pg
```

2. **Environment-Variablen setup:**
```bash
# Vercel Secrets hinzufügen
vercel env add AMADEUS_API_KEY
vercel env add AMADEUS_API_SECRET
vercel env add AMADEUS_ENV
vercel env add SEATSAERO_API_KEY
```

3. **Basis-Struktur erstellen:**
```bash
mkdir -p lib/api
mkdir -p lib/tools/flight-search
touch lib/api/seats-aero-client.ts
touch lib/api/amadeus-client.ts
touch lib/api/amadeus-token.ts
touch lib/tools/flight-search.ts
```

4. **API-Keys organisieren:**
- [ ] Seats.aero Partner API Key anfordern
- [ ] Amadeus API Credentials anfordern (Test + Prod)
- [ ] API-Dokumentation sammeln

---

### 10.3 Fragen zur Klärung

**Vor Implementierungs-Start:**

1. **APIs:**
   - ✅ Haben wir Zugang zu Seats.aero Partner API?
   - ✅ Haben wir Amadeus API Credentials?
   - ❓ Welche Amadeus-Umgebung nutzen wir zunächst (Test/Prod)?

2. **Scope:**
   - ✅ Fokus auf Award-Flüge (Seats.aero) + Cash-Flüge (Amadeus)?
   - ❓ Sollen wir zusätzliche Filter implementieren (Airline, Alliances)?
   - ❓ Multi-City Suche in Scope?

3. **Performance:**
   - ❓ Welche Response-Zeit ist akzeptabel? (<5s?)
   - ❓ Sollen wir Response-Caching implementieren (Redis)?

4. **Kosten:**
   - ❓ API-Call-Budget pro Monat?
   - ❓ Rate-Limits der APIs?

---

## Anhang: Weitere Ressourcen

### A. API-Dokumentation

- **Seats.aero Partner API:** [Link zur Dokumentation]
- **Amadeus Flight Offers API:** https://developers.amadeus.com/self-service/category/flights
- **Vercel AI SDK:** https://sdk.vercel.ai/docs

### B. Code-Beispiele

**V1 Referenz-Code:**
- `documentation/context/mylo-tool-calling.md` (dieses Dokument)
- Supabase Edge Functions (V1 Repository)

**V2 Referenz-Code:**
- `/lib/tools/web-search.ts` - Tool-Pattern
- `/app/api/search/route.ts` - Chat-Integration
- `/lib/db/queries/` - Database-Queries

### C. Kontakte

- **API Support:** [Kontaktinformationen]
- **Database Admin:** [Kontaktinformationen]
- **DevOps:** [Kontaktinformationen]

---

**Dokument-Version:** 1.0  
**Letzte Aktualisierung:** 31. Oktober 2024  
**Nächster Review:** Nach Phase 1 Completion

