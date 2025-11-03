# Tool Call System - Vollständige Architekturdokumentation

## Übersicht

Dieses Dokument beschreibt die komplette Struktur des Tool-Call-Systems, insbesondere am Beispiel der **seats.aero Integration**. Das System ermöglicht es dem LLM (Large Language Model), externe Funktionen/Tools aufzurufen, um Flugsuche, Wissensdatenbank-Abfragen und andere Operationen durchzuführen.

---

## 1. Architektur-Übersicht

### 1.1 Komponenten

Das Tool-Call-System besteht aus folgenden Hauptkomponenten:

1. **Tool Schema Definition** (`toolSchemas`) - JSON-Schemas für OpenAI Function Calling
2. **Tool Execution Pipeline** (`runToolPipeline`) - Verwaltet den gesamten Tool-Ausführungszyklus
3. **Tool Execution Functions** (`executeTool`, `runSearchFlightsTool`, etc.) - Führt die eigentlichen Tools aus
4. **Tool Call Registry** (Datenbank-Tabelle `tool_call`) - Speichert alle Tool-Calls für Audit und Retries
5. **Session State Management** - Speichert Kontext zwischen Tool-Calls

### 1.2 Datenfluss

```
User Message
    ↓
LLM (OpenAI) entscheidet Tool-Call
    ↓
Tool Call wird erkannt (tool_calls[])
    ↓
recordToolCall() - Erstellt Eintrag in DB
    ↓
runToolPipeline() - Startet Pipeline
    ↓
executeTool() - Führt Tool aus
    ↓
Tool-spezifische Funktion (z.B. runSearchFlightsTool)
    ↓
Externe API-Aufruf (z.B. seats.aero)
    ↓
updateToolCall() - Aktualisiert Status in DB
    ↓
Response wird formatiert und zurückgegeben
```

---

## 2. Tool Schema Definition

### 2.1 Struktur

Die Tool-Schemas werden als JSON-Objekte definiert und an OpenAI übergeben:

```typescript
const toolSchemas = [
  {
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
          // ... weitere Properties
        },
        required: ['origin', 'destination', 'depart_date', 'cabin'],
      },
    },
  },
  // ... weitere Tools
];
```

### 2.2 Verfügbare Tools

#### Tool 1: `search_flights`
- **Beschreibung**: Sucht Award- und Cash-Flüge über Seats.aero und Amadeus APIs
- **Parameter**:
  - `origin` (string, 3 Zeichen, IATA-Code) - **Required**
  - `destination` (string, 3 Zeichen, IATA-Code) - **Required**
  - `depart_date` (string, date format) - **Required**
  - `return_date` (string, date format, nullable) - Optional
  - `pax` (integer, 1-9) - Anzahl Passagiere, Default: 1
  - `cabin` (enum: 'ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST') - **Required**
  - `award_only` (boolean) - Nur Award-Flüge, Default: true
  - `loyalty_programs` (array of strings) - Meilenprogramme
  - `constraints` (object) - Zusätzliche Filter
    - `max_taxes` (number)
    - `nonstop_only` (boolean)
    - `alliances` (array of strings)
  - `reuse_last_request` (boolean) - Letzten Request wiederverwenden

#### Tool 2: `search_knowledge_base`
- **Beschreibung**: Durchsucht die MYLO Wissensdatenbank (RAG)
- **Parameter**:
  - `query` (string) - **Required** - Suchanfrage
  - `top_k` (integer, 1-20) - Anzahl Ergebnisse, Default: 6

#### Tool 3: `ask_gpt`
- **Beschreibung**: Nutzt ChatGPT für allgemeine Fragen
- **Parameter**:
  - `query` (string) - **Required** - Die Anfrage
  - `context` (string, nullable) - Zusätzlicher Kontext
  - `web_search` (boolean) - Web-Suche aktivieren, Default: false
  - `temperature` (number, 0-1) - Temperature für LLM, Default: 0.2

---

## 3. Tool Call Registry (Datenbank)

### 3.1 Tabelle `tool_call`

Die Datenbank-Tabelle speichert alle Tool-Calls für Audit, Retries und Analytics:

```sql
CREATE TABLE public.tool_call (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  status public.tool_call_status NOT NULL DEFAULT 'queued',
  request jsonb,
  response jsonb,
  error text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
```

### 3.2 Status-Enum

```sql
CREATE TYPE public.tool_call_status AS ENUM (
  'queued',
  'running',
  'succeeded',
  'failed',
  'timeout',
  'canceled'
);
```

### 3.3 Deduplication

- `dedupe_key`: SHA256-Hash von `{ chatId, toolName, request }`
- Verhindert doppelte Tool-Calls innerhalb eines Chats
- Unique Index auf `dedupe_key`

---

## 4. Tool Execution Pipeline

### 4.1 Funktion: `runToolPipeline`

Diese Funktion verwaltet den gesamten Lebenszyklus eines Tool-Calls:

```typescript
async function runToolPipeline(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolExecutionContext,
  options?: {
    openAiMessages?: ChatMessage[];
    toolCall?: { id: string; name: string; chatToolCallId?: string };
    skipFinalCompletion?: boolean;
  },
): Promise<{
  finalText: string;
  execution: ToolExecutionResult;
  state: SessionState;
  toolCallId: string;
}>
```

**Ablauf:**

1. **Tool Call Record erstellen** (`recordToolCall`)
   - Erstellt Eintrag in `tool_call` Tabelle
   - Status: `queued`
   - Generiert `dedupe_key` für Deduplication

2. **Status auf `running` setzen** (`updateToolCall`)
   - Setzt `started_at` Timestamp

3. **Tool ausführen** (`executeTool`)
   - Ruft tool-spezifische Funktion auf
   - Verarbeitet Fehler

4. **Session State aktualisieren** (`mergeSessionState`)
   - Wenn `execution.statePatch` vorhanden ist

5. **Message persistieren** (`persistMessage`)
   - Speichert Tool-Message in `messages` Tabelle

6. **Final Completion (optional)**
   - Wenn `skipFinalCompletion === false`, wird ein finales LLM-Completion gemacht
   - Formatierung der Antwort für den User

### 4.2 Funktion: `executeTool`

Router-Funktion, die das richtige Tool ausführt:

```typescript
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
  toolCallId: string,
): Promise<ToolExecutionResult> {
  switch (name) {
    case "search_flights":
      return runSearchFlightsTool(ctx, args as FlightSearchInput, toolCallId);
    case "search_knowledge_base":
      return runRetrieveDocsTool(ctx, args as { query: string; top_k?: number }, toolCallId);
    case "ask_gpt":
      return runAskGptTool(ctx, args as { query: string; context?: string; web_search?: boolean; temperature?: number }, toolCallId);
    default:
      // Fehlerbehandlung
  }
}
```

---

## 5. Seats.aero Integration im Detail

### 5.1 Tool: `search_flights` - Kompletter Ablauf

#### Schritt 1: Parameter-Validierung und Mapping

```typescript
// Input: FlightSearchInput (von LLM)
interface FlightSearchInput {
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string | null;
  pax?: number;
  cabin: string;
  award_only?: boolean;
  loyalty_programs?: string[];
  constraints?: {
    max_taxes?: number;
    nonstop_only?: boolean;
    alliances?: string[];
  };
  // ... weitere Felder
}

// Mapping zu FlightSearchParams
function mapSearchPayloadToParams(payload: FlightSearchInput): FlightSearchParams {
  return {
    origin: payload.origin,
    destination: payload.destination,
    departureDate: payload.depart_date,
    returnDate: payload.return_date ?? undefined,
    adults: payload.pax ?? 1,
    children: payload.children ?? 0,
    infants: payload.infants ?? 0,
    travelClass: payload.cabin,
    nonStop: payload.non_stop ?? payload.constraints?.nonstop_only ?? false,
    flexibility: payload.flexibility,
    useMiles: payload.use_miles ?? payload.award_only ?? false,
    // ...
  };
}
```

#### Schritt 2: Parallele API-Aufrufe

```typescript
async function runSearchFlightsTool(
  ctx: ToolExecutionContext,
  payload: FlightSearchInput,
  toolCallId: string,
): Promise<ToolExecutionResult> {
  const params = mapSearchPayloadToParams(payload);
  
  // Parallele Aufrufe zu beiden APIs
  const [amadeusResult, seatsResult] = await Promise.all([
    callAmadeusSearch(params, ctx.authHeader).catch((error) => {
      console.warn("[TOOL] Amadeus search failed", error);
      return null;
    }),
    callSeatsAero(params, ctx.authHeader).catch((error) => {
      console.warn("[TOOL] Seats.aero search failed", error);
      return null;
    }),
  ]);
  
  // ... Ergebnis-Verarbeitung
}
```

#### Schritt 3: Seats.aero API-Aufruf

```typescript
async function callSeatsAero(
  params: FlightSearchParams,
  authHeader: string,
): Promise<AwardSearchResult> {
  if (!FUNCTIONS_URL) {
    throw new Error("Supabase functions URL missing");
  }
  
  // Aufruf der Supabase Edge Function
  const response = await fetch(`${FUNCTIONS_URL}/functions/v1/seatsaero-flight-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      travelClass: params.travelClass,
      adults: params.adults,
      children: params.children ?? 0,
      infants: params.infants ?? 0,
      flexibility: params.flexibility ?? 0,
      includeReturnAwards: Boolean(params.returnDate),
      maxResults: 5,
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seats.aero error ${response.status}: ${text}`);
  }
  
  return await response.json();
}
```

### 5.2 Seats.aero Edge Function

Die Edge Function `seatsaero-flight-search` ist eine separate Supabase Edge Function:

**Datei**: `supabase/functions/seatsaero-flight-search/index.ts`

**Umgebungsvariablen**:
- `SEATSAERO_API_KEY` - API-Key für Seats.aero Partner API
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key

**API-Endpunkt**: `https://seats.aero/partnerapi`

**Hauptfunktion**:

```typescript
async function runSeatSearch(
  params: {
    origin: string;
    destination: string;
    departureDate: string;
    travelClass: ClassKey;
    flexibility?: number;
    maxResults: number;
  },
  signal?: AbortSignal,
) {
  // 1. Datum-Validierung und Flexibility-Handling
  const baseDate = ensureDate(departureDate);
  const flex = Math.min(Math.max(flexibility ?? 0, 0), MAX_FLEXIBILITY_DAYS);
  const startDate = flex > 0 ? adjustDate(baseDate, -flex) : baseDate;
  const endDate = flex > 0 ? adjustDate(baseDate, flex) : baseDate;

  // 2. API-Request konstruieren
  const searchUrl = new URL(`${SEATSAERO_BASE_URL}/search`);
  searchUrl.searchParams.set("origin_airport", origin);
  searchUrl.searchParams.set("destination_airport", destination);
  searchUrl.searchParams.set("cabin", apiValue); // "economy", "premium", "business", "first"
  searchUrl.searchParams.set("start_date", startDate);
  searchUrl.searchParams.set("end_date", endDate);
  searchUrl.searchParams.set("take", "10");
  searchUrl.searchParams.set("include_trips", "true");

  // 3. API-Aufruf
  const raw = await fetchJSON(searchUrl, signal);
  
  // 4. Ergebnisse verarbeiten und sortieren
  const entries = Array.isArray(raw.data) ? raw.data : [];
  const sorted = entries
    .map((entry) => ({ entry, miles: milesFrom(entry, key) ?? Number.POSITIVE_INFINITY }))
    .filter(({ entry, miles }) => {
      const availability = Boolean((entry as Record<string, unknown>)[`${key}Available`]);
      const seats = seatsFrom(entry, key) ?? 0;
      return (availability || seats > 0) && Number.isFinite(miles);
    })
    .sort((a, b) => a.miles - b.miles)
    .slice(0, maxResults)
    .map(({ entry }) => entry);

  // 5. Trip-Details für jeden Flug laden
  const flights: FlightResult[] = [];
  for (const entry of sorted) {
    const flight = await buildFlight(entry, key, cabin, signal);
    if (flight) flights.push(flight);
  }

  return {
    flights,
    stats: {
      totalAvailable: raw.count ?? entries.length,
      hasMore: raw.hasMore ?? false,
      startDate,
      endDate,
      cabin,
    },
  };
}
```

**Cabin-Mapping**:

```typescript
const CLASS_MAP = {
  ECONOMY: { key: "Y", cabin: "Economy", apiValue: "economy" },
  PREMIUM_ECONOMY: { key: "W", cabin: "Premium Economy", apiValue: "premium" },
  BUSINESS: { key: "J", cabin: "Business", apiValue: "business" },
  FIRST: { key: "F", cabin: "First", apiValue: "first" },
} as const;
```

**Response-Format**:

```typescript
interface FlightResult {
  id: string;
  provider: "seatsaero";
  price: string; // z.B. "85.000 Meilen + $450"
  pricePerPerson: string;
  airline: string;
  cabin: string;
  tags: string[];
  totalStops: number;
  miles: number | null;
  taxes: { amount: number | null; currency: string | null };
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
```

### 5.3 Ergebnis-Formatierung für Chat

Nach dem API-Aufruf werden die Ergebnisse für den Chat formatiert:

```typescript
// In runSearchFlightsTool()
const hasAmadeus = Boolean((amadeusResult as FlightSearchResult | null)?.results?.count);
const hasSeats = Boolean(seatsResult?.results?.count);
const prefersAwards = Boolean(params.useMiles || payload.use_miles || payload.award_only);

if (hasAmadeus || hasSeats) {
  const sections: string[] = [];
  if (prefersAwards) {
    if (hasSeats) sections.push(formatAwardResultsForChat(seatsResult as AwardSearchResult));
    if (hasAmadeus) sections.push(formatFlightResultsForChat(amadeusResult as FlightSearchResult));
  } else {
    if (hasAmadeus) sections.push(formatFlightResultsForChat(amadeusResult as FlightSearchResult));
    if (hasSeats) sections.push(formatAwardResultsForChat(seatsResult as AwardSearchResult));
  }
  
  // ... Message zusammenstellen
}
```

### 5.4 Session State Update

Nach erfolgreicher Suche wird der Session State aktualisiert:

```typescript
const statePatch: Partial<SessionState> = {
  last_flight_request: {
    origin: payload.origin,
    destination: payload.destination,
    depart_date: payload.depart_date,
    return_date: payload.return_date ?? null,
    cabin: payload.cabin,
    pax: payload.pax,
    award_only: payload.award_only,
    loyalty_programs: payload.loyalty_programs,
    constraints: payload.constraints,
  },
  pending_flight_request: null,
};
```

### 5.5 Tool Call Update

Der Tool-Call wird mit dem Ergebnis aktualisiert:

```typescript
await updateToolCall(ctx.serviceSupabase ?? ctx.supabase, toolCallId, {
  status: "succeeded",
  response: { amadeusResult, seatsResult },
});
```

---

## 6. Amadeus Integration im Detail

### 6.1 Amadeus API-Aufruf

Das Tool `search_flights` ruft parallel zur Seats.aero API auch die Amadeus API auf:

```typescript
async function callAmadeusSearch(
  params: FlightSearchParams,
  authHeader: string,
): Promise<AwardSearchResult | FlightSearchResult> {
  if (!FUNCTIONS_URL) {
    throw new Error("Supabase functions URL missing");
  }
  const response = await fetch(`${FUNCTIONS_URL}/functions/v1/amadeus-flight-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ ...params, debug: true }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flight API error ${response.status}: ${text}`);
  }
  return await response.json();
}
```

### 6.2 Amadeus Edge Function

Die Edge Function `amadeus-flight-search` ist eine separate Supabase Edge Function:

**Datei**: `supabase/functions/amadeus-flight-search/index.ts`

**Umgebungsvariablen**:
- `AMADEUS_API_KEY` - Amadeus API Client ID
- `AMADEUS_API_SECRET` - Amadeus API Client Secret
- `AMADEUS_ENV` - Environment (test/prod), Default: "test"
- `AMADEUS_BASE_URL` - API Base URL (test.api.amadeus.com oder api.amadeus.com)
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key

**API-Endpunkte**:
- **Token Endpoint**: `https://{AMADEUS_BASE_URL}/v1/security/oauth2/token`
- **Flight Offers**: `https://{AMADEUS_BASE_URL}/v2/shopping/flight-offers`

### 6.3 Amadeus Token Management

Amadeus verwendet OAuth2 mit Access Tokens, die gecacht werden:

```typescript
// Token wird in Supabase gespeichert und wiederverwendet
async function getAmadeusToken(supabase: SupabaseClient | null): Promise<{ token: string; source: TokenSource }> {
  // 1. Versuche gecachten Token zu verwenden
  const cached = await supabase?.rpc("get_amadeus_token_for_api", { p_environment: environment });
  
  if (cached?.data?.access_token && cached.data.expires_at > Date.now()) {
    return { token: cached.data.access_token, source: "cache" };
  }
  
  // 2. Neuen Token anfordern
  const tokenURL = `${AMADEUS_API_URL}/v1/security/oauth2/token`;
  const response = await fetch(tokenURL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AMADEUS_CLIENT_ID,
      client_secret: AMADEUS_CLIENT_SECRET,
    }),
  });
  
  const tokenData = await response.json();
  
  // 3. Token in Supabase speichern
  await supabase?.rpc("store_amadeus_token_secure", {
    p_access_token: tokenData.access_token,
    p_token_type: tokenData.token_type,
    p_expires_in: tokenData.expires_in,
    p_environment: environment,
  });
  
  return { token: tokenData.access_token, source: "new" };
}
```

### 6.4 Amadeus Flight Search

```typescript
// Beispiel: Amadeus Flight Offers API Call
const searchParams = new URLSearchParams({
  originLocationCode: params.origin,
  destinationLocationCode: params.destination,
  departureDate: params.departureDate,
  adults: String(params.adults),
  children: String(params.children ?? 0),
  infants: String(params.infants ?? 0),
  travelClass: params.travelClass.toLowerCase(),
  currencyCode: "EUR",
  max: "10",
});

const response = await fetch(`${AMADEUS_API_URL}/v2/shopping/flight-offers?${searchParams}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.amadeus+json",
  },
});
```

### 6.5 Amadeus Response Format

Amadeus liefert strukturierte Flight Offers mit Preisen, Segmenten und Buchungsinformationen:

```typescript
interface AmadeusFlightOffer {
  type: "flight-offer";
  id: string;
  source: "GDS";
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  oneWay: boolean;
  lastTicketingDate: string;
  numberOfBookableSeats: number;
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: { iataCode: string; terminal?: string; at: string };
      arrival: { iataCode: string; terminal?: string; at: string };
      carrierCode: string;
      number: string;
      aircraft: { code: string };
      duration: string;
    }>;
  }>;
  price: {
    currency: string;
    total: string;
    base: string;
    fees: Array<{ amount: string; type: string }>;
    grandTotal: string;
  };
  pricingOptions: {
    fareType: string[];
    includedCheckedBagsOnly: boolean;
  };
  validatingAirlineCodes: string[];
  travelerPricings: Array<{
    travelerId: string;
    fareOption: string;
    travelerType: string;
    price: {
      total: string;
      base: string;
    };
    fareDetailsBySegment: Array<{
      segmentId: string;
      cabin: string;
      fareBasis: string;
      class: string;
      includedCheckedBags: { quantity: number };
    }>;
  }>;
}
```

### 6.6 Parallele Verarbeitung

Beide APIs (Seats.aero und Amadeus) werden parallel aufgerufen:

```typescript
const [amadeusResult, seatsResult] = await Promise.all([
  callAmadeusSearch(params, ctx.authHeader).catch((error) => {
    console.warn("[TOOL] Amadeus search failed", error);
    return null; // Graceful degradation
  }),
  callSeatsAero(params, ctx.authHeader).catch((error) => {
    console.warn("[TOOL] Seats.aero search failed", error);
    return null; // Graceful degradation
  }),
]);
```

---

## 7. Knowledge Base Tool (`search_knowledge_base`) im Detail

### 7.1 Übersicht

Das Tool `search_knowledge_base` ermöglicht semantische Suche über die eigene Wissensdatenbank mit RAG (Retrieval-Augmented Generation).

**Zweck**: Durchsucht die MYLO Wissensdatenbank nach Informationen zu Meilenprogrammen, Award-Strategien, Airline-Regeln und vorhandener Dokumentation.

### 7.2 Implementierung

**Datei**: `supabase/functions/chat-rag/index.ts` - Funktion `runRetrieveDocsTool`

```typescript
async function runRetrieveDocsTool(
  ctx: ToolExecutionContext,
  args: { query: string; top_k?: number },
  toolCallId: string,
): Promise<ToolExecutionResult> {
  const topK = Math.min(Math.max(args.top_k ?? 6, 1), 20);
  const docs = await retrieveDocs(ctx.serviceSupabase ?? ctx.supabase, args.query, topK);
  
  // ... Ergebnis-Verarbeitung
}
```

### 7.3 Hybrid Search Implementation

Das Tool verwendet eine Hybrid-Search-Strategie (BM25 + Vector Similarity):

```typescript
async function retrieveDocs(
  client: SupabaseClient,
  query: string,
  topK: number,
) {
  // 1. Embedding für Vector Search generieren
  const embedding = await getEmbedding(query);
  
  // 2. Parallele Suche: BM25 (Keyword) + Vector (Semantic)
  const [{ data: bm25 }, { data: vec }] = await Promise.all([
    client.rpc("text_search_chunks", { 
      query_text: query, 
      match_count: Math.max(4, topK) 
    }),
    client.rpc("match_chunks", { 
      query_embedding: embedding, 
      match_count: Math.max(4, topK) 
    }),
  ]);
  
  // 3. Ergebnisse zusammenführen und deduplizieren
  const results: Array<{ id: string; content: string; document_id: string; similarity?: number }> = [];
  const add = (rows: unknown, similarityKey?: string) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const rec = row as Record<string, unknown>;
      const id = String(rec.id);
      const existing = results.find((r) => r.id === id);
      const entry = existing ?? { 
        id, 
        content: String(rec.content ?? ""), 
        document_id: String(rec.document_id ?? "") 
      };
      if (similarityKey && typeof rec[similarityKey] === "number") {
        entry.similarity = Math.max(entry.similarity ?? 0, rec[similarityKey] as number);
      }
      if (!existing) results.push(entry);
    }
  };
  
  add(bm25);
  add(vec, "similarity");
  
  // 4. Nach Similarity sortieren und topK zurückgeben
  results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  return results.slice(0, topK);
}
```

### 7.4 OpenAI Embeddings API

Für die Vector-Suche wird die OpenAI Embeddings API verwendet:

```typescript
async function getEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: text 
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API error: ${await response.text()}`);
  }
  
  const json = await response.json();
  return json.data?.[0]?.embedding ?? [];
}
```

**API-Details**:
- **Endpoint**: `https://api.openai.com/v1/embeddings`
- **Model**: `text-embedding-3-small`
- **Input**: Query-Text (String)
- **Output**: Embedding-Vektor (Array von Zahlen)

### 7.5 Supabase RPC Functions

Die Datenbank stellt zwei RPC-Funktionen bereit:

1. **`text_search_chunks`** - BM25 Keyword-Suche
   ```sql
   -- Beispielaufruf
   SELECT * FROM text_search_chunks(query_text => 'Miles & More', match_count => 6);
   ```

2. **`match_chunks`** - Vector Similarity Search
   ```sql
   -- Beispielaufruf
   SELECT * FROM match_chunks(query_embedding => '[0.123, -0.456, ...]', match_count => 6);
   ```

### 7.6 Response-Verarbeitung

Nach der Suche werden die Ergebnisse formatiert:

```typescript
if (docs.length === 0) {
  // Keine Ergebnisse gefunden
  const statePatch: Partial<SessionState> = {
    pending_gpt_query: {
      query: args.query,
      asked_at: new Date().toISOString(),
    },
  };
  return {
    status: "succeeded",
    message: "Ich habe in unserer Wissensbasis nichts Passendes gefunden. Soll ich stattdessen das Web durchsuchen?",
    statePatch,
    metadata: {
      mode: "rag_no_results",
      suggested_tool: "ask_gpt",
      query: args.query,
    },
  };
}

// Ergebnisse gefunden - als Bullet-List formatieren
const bulletList = docs
  .map((doc, index) => `**${index + 1}.** ${doc.content.slice(0, 240)}…`)
  .join("\n\n");

return {
  status: "succeeded",
  message: `Ich habe folgende relevante Punkte gefunden:\n\n${bulletList}`,
  raw: docs,
  metadata: {
    mode: "rag_docs",
    query: args.query,
    top_k: topK,
    sources: docs.map((doc) => ({
      id: doc.id,
      document_id: doc.document_id,
      snippet: doc.content,
      similarity: doc.similarity ?? null,
    })),
  },
};
```

### 7.7 Session State Integration

Wenn keine Ergebnisse gefunden werden, wird der Session State aktualisiert, um einen Fallback zu `ask_gpt` vorzuschlagen:

```typescript
pending_gpt_query: {
  query: args.query,
  asked_at: new Date().toISOString(),
}
```

---

## 8. GPT Fallback Tool (`ask_gpt`) im Detail

### 8.1 Übersicht

Das Tool `ask_gpt` ermöglicht direkte Anfragen an ChatGPT, wenn die Wissensdatenbank keine Antwort liefert oder allgemeine Fragen gestellt werden.

**Zweck**: Nutzt ChatGPT für allgemeine Fragen, Web-Suche oder wenn RAG keine Antwort hat.

### 8.2 Implementierung

**Datei**: `supabase/functions/chat-rag/index.ts` - Funktion `runAskGptTool`

```typescript
async function runAskGptTool(
  ctx: ToolExecutionContext,
  args: { query: string; context?: string | null; web_search?: boolean; temperature?: number },
  toolCallId: string,
): Promise<ToolExecutionResult> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    throw new Error('Ungültige Anfrage für ask_gpt');
  }

  const contextText = typeof args.context === 'string' ? args.context.trim() : '';
  
  // Temperature-Unterstützung (nur für nicht-gpt-5 Modelle)
  const supportsCustomTemperature = !OPENAI_MODEL.toLowerCase().startsWith('gpt-5');
  const requestedTemperature = typeof args.temperature === 'number' 
    ? Math.max(0, Math.min(1, args.temperature)) 
    : undefined;

  // Message-Array zusammenstellen
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nDu antwortest jetzt als ChatGPT-5 direkt auf die Nutzerfrage. Nutze dein aktuelles Wissen. Wenn Fakten unsicher sind, weise darauf hin.`,
    },
  ];

  if (contextText) {
    messages.push({ role: 'user', content: `Kontext:\n${contextText}` });
  }
  messages.push({ role: 'user', content: query });

  // OpenAI-Aufruf ohne Tools (reine Chat-Completion)
  const callOptions: { allowTools: boolean; temperature?: number } = { allowTools: false };
  if (supportsCustomTemperature && typeof requestedTemperature === 'number') {
    callOptions.temperature = requestedTemperature;
  }

  const completion = await callOpenAI(messages, callOptions);
  await recordUsageMetrics(ctx, completion.usage, 'ask_gpt');
  
  const choice = completion.choices?.[0];
  const content = choice?.message?.content?.trim();
  
  if (!content) {
    throw new Error('Keine Antwort von ChatGPT erhalten');
  }

  // Response speichern
  const responsePayload = {
    message: content,
    metadata: {
      model: OPENAI_MODEL,
      finish_reason: choice?.finish_reason ?? null,
      web_search: Boolean(args.web_search),
    },
  };

  await updateToolCall(ctx.serviceSupabase ?? ctx.supabase, toolCallId, {
    status: 'succeeded',
    response: responsePayload,
  });

  return {
    status: 'succeeded',
    message: content,
    raw: responsePayload,
    metadata: {
      mode: 'gpt',
      web_search: Boolean(args.web_search),
    },
  };
}
```

### 8.3 OpenAI Chat Completions API

Das Tool verwendet die OpenAI Chat Completions API ohne Tool-Calls:

```typescript
async function callOpenAI(
  messages: ChatMessage[],
  options?: Partial<{ allowTools: boolean; temperature: number }>,
) {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL, // z.B. "gpt-5"
    messages,
  };
  
  // WICHTIG: Bei ask_gpt werden KEINE Tools verwendet
  if (options?.allowTools !== false) {
    body.tools = toolSchemas;
    body.tool_choice = 'auto';
  }
  
  if (typeof options?.temperature === 'number') {
    body.temperature = options.temperature;
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}
```

**API-Details**:
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Method**: POST
- **Model**: Konfigurierbar über `OPENAI_MODEL` (Default: "gpt-5")
- **Tools**: Werden bei `ask_gpt` deaktiviert (`allowTools: false`)

### 8.4 Context-Handling

Das Tool unterstützt optionalen Kontext aus vorherigen Nachrichten:

```typescript
if (contextText) {
  messages.push({ role: 'user', content: `Kontext:\n${contextText}` });
}
messages.push({ role: 'user', content: query });
```

### 8.5 Temperature-Control

Temperature kann für nicht-gpt-5 Modelle angepasst werden:

```typescript
const supportsCustomTemperature = !OPENAI_MODEL.toLowerCase().startsWith('gpt-5');
const requestedTemperature = typeof args.temperature === 'number' 
  ? Math.max(0, Math.min(1, args.temperature)) 
  : undefined;
```

### 8.6 Web-Search (Optional)

Der Parameter `web_search` kann gesetzt werden, wird aber aktuell nur in den Metadaten gespeichert. Die tatsächliche Web-Suche-Integration würde zusätzliche Implementierung erfordern.

### 8.7 Usage Metrics

Jeder `ask_gpt` Aufruf wird für Analytics gespeichert:

```typescript
await recordUsageMetrics(ctx, completion.usage, 'ask_gpt');
```

---

## 9. Externe APIs Übersicht

### 9.1 Alle verwendeten externen APIs

| API | Endpoint | Verwendet von | Authentifizierung |
|-----|----------|---------------|-------------------|
| **Seats.aero Partner API** | `https://seats.aero/partnerapi` | `search_flights` Tool | `Partner-Authorization` Header |
| **Amadeus Flight Offers API** | `https://api.amadeus.com/v2/shopping/flight-offers` | `search_flights` Tool | OAuth2 Bearer Token |
| **Amadeus Token API** | `https://api.amadeus.com/v1/security/oauth2/token` | `amadeus-flight-search` Function | Client Credentials |
| **OpenAI Embeddings API** | `https://api.openai.com/v1/embeddings` | `search_knowledge_base` Tool | Bearer Token |
| **OpenAI Chat Completions API** | `https://api.openai.com/v1/chat/completions` | `ask_gpt` Tool + Haupt-Chat | Bearer Token |

### 9.2 API-Call-Flow

```
User Message
    ↓
LLM entscheidet Tool-Call
    ↓
┌─────────────────────────────────────────────────┐
│ search_flights                                   │
│   ├─→ Seats.aero API (via Edge Function)        │
│   └─→ Amadeus API (via Edge Function)           │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ search_knowledge_base                           │
│   ├─→ OpenAI Embeddings API                     │
│   └─→ Supabase RPC (text_search + match_chunks)│
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ ask_gpt                                         │
│   └─→ OpenAI Chat Completions API (ohne Tools) │
└─────────────────────────────────────────────────┘
```

### 9.3 Edge Functions als API-Wrapper

Die externen APIs werden über Supabase Edge Functions aufgerufen:

1. **`seatsaero-flight-search`** - Wrapper für Seats.aero API
2. **`amadeus-flight-search`** - Wrapper für Amadeus API mit Token-Management

Diese Funktionen bieten:
- Zentralisierte Fehlerbehandlung
- Request-Logging
- Response-Normalisierung
- Integration mit Supabase Database

---

## 10. Tool Execution Context

### 10.1 Interface: `ToolExecutionContext`

```typescript
interface ToolExecutionContext {
  chatId: string;
  userId: string;
  authHeader: string;
  supabase: SupabaseClient;
  serviceSupabase: SupabaseClient | null;
  sessionState: SessionState;
  emit: SSEEmitter;
  debug: boolean;
  debugEvents: DebugEventEntry[];
}
```

### 10.2 Interface: `ToolExecutionResult`

```typescript
interface ToolExecutionResult {
  status: "succeeded" | "failed";
  message: string;
  raw?: unknown;
  statePatch?: Partial<SessionState>;
  metadata?: Record<string, unknown>;
}
```

---

## 11. Tool Call Recording

### 11.1 Funktion: `recordToolCall`

Erstellt einen neuen Tool-Call-Eintrag in der Datenbank:

```typescript
async function recordToolCall(
  client: SupabaseClient,
  chatId: string,
  toolName: string,
  request: unknown,
) {
  // 1. Dedupe-Key generieren
  const dedupe = await sha256(JSON.stringify({ chatId, toolName, request }));

  // 2. Prüfen ob bereits vorhanden
  const existing = await client
    .from("tool_call")
    .select("id")
    .eq("chat_id", chatId)
    .eq("dedupe_key", dedupe)
    .maybeSingle();
  
  if (existing?.data?.id) {
    return { id: existing.data.id, dedupe };
  }

  // 3. Neuen Eintrag erstellen
  const { data, error } = await client
    .from("tool_call")
    .insert({
      chat_id: chatId,
      tool_name: toolName,
      status: "queued",
      request,
      dedupe_key: dedupe,
    })
    .select("id")
    .single();
  
  // 4. Fehlerbehandlung für Race Conditions
  if (error || !data?.id) {
    const isDuplicate = typeof error?.message === 'string' && 
                       error.message.includes('duplicate key value');
    if (isDuplicate) {
      // Retry: Eintrag nochmal lesen
      const retry = await client
        .from("tool_call")
        .select("id")
        .eq("chat_id", chatId)
        .eq("dedupe_key", dedupe)
        .maybeSingle();
      if (retry?.data?.id) {
        return { id: retry.data.id, dedupe };
      }
    }
    throw new Error(`Tool call could not be recorded: ${error?.message ?? "unknown"}`);
  }
  
  return { id: data.id, dedupe };
}
```

### 11.2 Funktion: `updateToolCall`

Aktualisiert einen bestehenden Tool-Call:

```typescript
async function updateToolCall(
  client: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await client
    .from("tool_call")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[TOOL] Failed to update tool_call", error);
  }
}
```

---

## 12. LLM Integration

### 12.1 Tool Call Detection

Nach dem LLM-Aufruf wird geprüft, ob ein Tool-Call gemacht wurde:

```typescript
const completion = await callOpenAI(openAiMessages);
const choice = completion.choices?.[0];
const toolCall = choice?.message?.tool_calls?.[0];

if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments ?? "{}");
  
  // Tool-Call verarbeiten
  const toolCallRecord = await recordToolCall(serviceSupabase ?? supabase, chatId, toolCall.function.name, args);
  emit("tool_started", { tool: toolCall.function.name, job_id: toolCallRecord.id });
  
  const pipeline = await runToolPipeline(toolCall.function.name, args, ctx, {
    openAiMessages,
    toolCall: { 
      id: toolCallRecord.id, 
      name: toolCall.function.name, 
      chatToolCallId: toolCall.id 
    },
    skipFinalCompletion: toolCall.function.name === 'search_flights',
  });
  
  emit("assistant_token", { content: pipeline.finalText });
  // ... Final Response
}
```

### 12.2 OpenAI API Call

```typescript
async function callOpenAI(
  messages: ChatMessage[],
  options?: Partial<{ allowTools: boolean; temperature: number }>,
) {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
  };
  
  if (options?.allowTools !== false) {
    body.tools = toolSchemas;
    body.tool_choice = 'auto';
  }
  
  if (typeof options?.temperature === 'number') {
    body.temperature = options.temperature;
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}
```

---

## 13. Session State Management

### 13.1 Interface: `SessionState`

```typescript
interface SessionState {
  last_flight_request?: {
    origin: string;
    destination: string;
    depart_date: string;
    return_date?: string | null;
    cabin: string;
    pax: number;
    award_only?: boolean;
    loyalty_programs?: string[];
    constraints?: {
      max_taxes?: number;
      nonstop_only?: boolean;
      alliances?: string[];
    };
  };
  pending_flight_request?: {
    origin?: string;
    destination?: string;
    depart_date?: string;
    return_date?: string | null;
    cabin?: string;
    pax?: number;
    flexibility?: number;
    award_only?: boolean;
    loyalty_programs?: string[];
    constraints?: {
      max_taxes?: number;
      nonstop_only?: boolean;
      alliances?: string[];
    };
  } | null;
  pending_gpt_query?: {
    query: string;
    asked_at?: string;
  } | null;
  selected_itineraries?: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  memory?: Array<{ type: string; content: string; created_at: string }>;
}
```

### 13.2 Session State Funktionen

```typescript
// Session State lesen
async function getSessionState(
  client: SupabaseClient,
  chatId: string,
): Promise<SessionState> {
  // ... Implementation
}

// Session State aktualisieren
async function mergeSessionState(
  client: SupabaseClient,
  chatId: string,
  patch: Partial<SessionState>,
): Promise<SessionState> {
  // ... Implementation
}
```

---

## 14. Error Handling

### 14.1 Fehlerbehandlung in Tool Execution

```typescript
try {
  // Tool ausführen
  const execution = await executeTool(toolName, toolArgs, ctx, toolCallRecord.id);
  
  // Erfolg
  await updateToolCall(client, toolCallRecord.id, {
    status: "succeeded",
    response: execution.raw,
  });
  
} catch (error) {
  // Fehler
  await updateToolCall(client, toolCallRecord.id, {
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  });
  
  return {
    status: "failed",
    message: "Die Flugsuche ist leider fehlgeschlagen...",
  };
}
```

### 14.2 Graceful Degradation

Bei Fehlern werden Fallbacks genutzt:

```typescript
// Parallele Aufrufe mit Fallback
const [amadeusResult, seatsResult] = await Promise.all([
  callAmadeusSearch(params, ctx.authHeader).catch((error) => {
    console.warn("[TOOL] Amadeus search failed", error);
    return null; // Graceful degradation
  }),
  callSeatsAero(params, ctx.authHeader).catch((error) => {
    console.warn("[TOOL] Seats.aero search failed", error);
    return null; // Graceful degradation
  }),
]);
```

---

## 15. Debugging & Monitoring

### 15.1 Debug Events

```typescript
interface DebugEventEntry {
  type: string;
  payload: Record<string, unknown>;
}

function pushDebugEvent(ctx: ToolExecutionContext, type: string, payload: Record<string, unknown>) {
  if (!ctx.debug) return;
  const safePayload = cloneForDebug(payload ?? {});
  ctx.debugEvents.push({ type, payload: safePayload });
  ctx.emit("debug", { type, payload: safePayload });
}
```

**Debug Event Types**:
- `tool_pipeline_start` - Tool-Pipeline gestartet
- `tool_pipeline_execution` - Tool ausgeführt
- `tool_pipeline_state_patch` - Session State aktualisiert
- `llm_tool_call_arguments` - LLM hat Tool-Call gemacht
- `llm_choice` - LLM hat Entscheidung getroffen

### 15.2 Usage Metrics

```typescript
async function recordUsageMetrics(
  ctx: ToolExecutionContext,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  operation: string,
) {
  await client.from("api_usage").insert({
    user_id: ctx.userId,
    chat_id: ctx.chatId,
    model: OPENAI_MODEL,
    operation,
    tokens_prompt: promptTokens,
    tokens_completion: completionTokens,
    tokens_total: totalTokens,
    cost_usd: 0,
  });
}
```

---

## 16. Integration in Chat-Flow

### 16.1 SSE (Server-Sent Events) Stream

```typescript
return createSSEStream(async (emit) => {
  ctx.emit = emit;
  emit("init", { chatId, created });
  
  // LLM-Aufruf
  const completion = await callOpenAI(openAiMessages);
  
  // Tool-Call erkannt?
  const toolCall = choice?.message?.tool_calls?.[0];
  
  if (toolCall) {
    const args = JSON.parse(toolCall.function.arguments ?? "{}");
    const toolCallRecord = await recordToolCall(serviceSupabase ?? supabase, chatId, toolCall.function.name, args);
    
    emit("tool_started", { tool: toolCall.function.name, job_id: toolCallRecord.id });
    
    const pipeline = await runToolPipeline(toolCall.function.name, args, ctx, {
      openAiMessages,
      toolCall: { id: toolCallRecord.id, name: toolCall.function.name, chatToolCallId: toolCall.id },
      skipFinalCompletion: toolCall.function.name === 'search_flights',
    });
    
    emit("assistant_token", { content: pipeline.finalText });
    emit("final", {
      message: { role: "assistant", content: pipeline.finalText },
      session_state: pipeline.state,
      tool_result: pipeline.execution.raw ?? null,
    });
  }
});
```

---

## 17. Beispiel: Kompletter Flow für Seats.aero

### 17.1 User Request

```
User: "Suche mir Business Class Flüge von FRA nach JFK am 15. März 2025"
```

### 17.2 LLM entscheidet Tool-Call

```json
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "search_flights",
      "arguments": "{\"origin\":\"FRA\",\"destination\":\"JFK\",\"depart_date\":\"2025-03-15\",\"cabin\":\"BUSINESS\",\"award_only\":true}"
    }
  }]
}
```

### 17.3 Tool Execution

1. **recordToolCall** → Erstellt Eintrag in DB (Status: `queued`)
2. **updateToolCall** → Status: `running`
3. **runSearchFlightsTool** → Führt Suche aus
   - `callSeatsAero` → Aufruf Edge Function
   - Edge Function ruft Seats.aero API auf
   - Ergebnisse werden formatiert
4. **updateToolCall** → Status: `succeeded`, Response gespeichert
5. **mergeSessionState** → `last_flight_request` aktualisiert
6. **persistMessage** → Tool-Message gespeichert

### 17.4 Response

```json
{
  "status": "succeeded",
  "message": "Ich habe folgende Business Class Award-Flüge gefunden:\n\n1. Lufthansa: 85.000 Meilen + $450\n   Abflug: FRA 10:30, Ankunft: JFK 13:15\n   ...",
  "raw": {
    "amadeusResult": null,
    "seatsResult": {
      "success": true,
      "results": {
        "count": 3,
        "flights": [...]
      }
    }
  },
  "statePatch": {
    "last_flight_request": {
      "origin": "FRA",
      "destination": "JFK",
      "depart_date": "2025-03-15",
      "cabin": "BUSINESS",
      "pax": 1,
      "award_only": true
    }
  }
}
```

---

## 18. Umgebungsvariablen

### 18.1 Chat-RAG Function

```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 18.2 Seats.aero Function

```bash
SEATSAERO_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 18.3 Amadeus Function

```bash
AMADEUS_API_KEY=...
AMADEUS_API_SECRET=...
AMADEUS_ENV=test  # oder "prod"
AMADEUS_BASE_URL=test.api.amadeus.com  # oder "api.amadeus.com"
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 19. Wichtige Dateien

### 19.1 Hauptfunktionen

- `supabase/functions/chat-rag/index.ts` - Haupt-Chat-Function mit Tool-Call-System
- `supabase/functions/seatsaero-flight-search/index.ts` - Seats.aero Edge Function
- `supabase/functions/amadeus-flight-search/index.ts` - Amadeus Edge Function
- `supabase/functions/_shared/amadeus-client.ts` - Amadeus Token-Management

### 19.2 Datenbank-Migrationen

- `supabase/migrations/20250919120000_chatbot_architecture.sql` - Tool-Call-Tabelle

### 19.3 Dokumentation

- `docs/context/MYLO_3_Tools_Implementation_Guide.md` - Tool-Implementierungs-Guide
- `docs/context/seatsaero_partner_api.md` - Seats.aero API Dokumentation

---

## 20. Zusammenfassung

### 20.1 Wichtige Konzepte

1. **Tool Schemas** - JSON-Schemas für OpenAI Function Calling
2. **Tool Registry** - Datenbank-Tabelle für Audit und Retries
3. **Tool Pipeline** - Verwaltet den gesamten Lebenszyklus
4. **Session State** - Speichert Kontext zwischen Tool-Calls
5. **Deduplication** - Verhindert doppelte Tool-Calls
6. **Graceful Degradation** - Fallbacks bei Fehlern

### 20.2 Alle Tool Calls im Überblick

#### Tool 1: `search_flights`
- **APIs**: Seats.aero Partner API + Amadeus Flight Offers API
- **Edge Functions**: `seatsaero-flight-search`, `amadeus-flight-search`
- **Zweck**: Flugsuche (Award + Cash)
- **Parallele Ausführung**: Ja

#### Tool 2: `search_knowledge_base`
- **APIs**: OpenAI Embeddings API (intern)
- **Datenbank**: Supabase pgvector (BM25 + Vector Search)
- **Zweck**: Semantische Suche in Wissensdatenbank
- **Hybrid Search**: BM25 + Vector Similarity

#### Tool 3: `ask_gpt`
- **APIs**: OpenAI Chat Completions API
- **Zweck**: ChatGPT Fallback für allgemeine Fragen
- **Tools deaktiviert**: Ja (nur Chat-Completion)

### 20.3 Externe APIs Zusammenfassung

1. **Seats.aero Partner API** - Award-Flüge
2. **Amadeus Flight Offers API** - Cash-Flüge
3. **Amadeus Token API** - OAuth2 Token-Management
4. **OpenAI Embeddings API** - Vector Embeddings für RAG
5. **OpenAI Chat Completions API** - LLM Responses

---

## 21. Nützliche Befehle für Debugging

### 21.1 Tool-Calls in DB anzeigen

```sql
SELECT 
  id,
  tool_name,
  status,
  created_at,
  started_at,
  finished_at,
  error
FROM tool_call
WHERE chat_id = '<chat-id>'
ORDER BY created_at DESC;
```

### 21.2 Tool-Call Details

```sql
SELECT 
  request,
  response,
  error
FROM tool_call
WHERE id = '<tool-call-id>';
```

---

**Ende der Dokumentation**

