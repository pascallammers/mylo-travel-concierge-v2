# Research: V1 zu V2 Tool-Calling Migration

**Task ID:** v1-to-v2-tool-calling-migration  
**Date:** 31. Oktober 2024  
**Type:** Full-Stack (Backend APIs + Frontend Integration)  
**Goal:** Migration des Tool-Calling-Systems von V1 (Supabase) zu V2 (Next.js)

---

## 🎯 Objective

Migrate the existing V1 tool-calling system (Seats.aero, Amadeus, Knowledge Base) from Supabase Edge Functions to V2 Next.js architecture using Vercel AI SDK.

---

## 🔍 Research Findings

### 1. V1 Architecture Analysis (Production)

**Location of V1 Documentation:**
- `documentation/context/mylo-tool-calling.md` (vollständige V1-Architekturdokumentation)

**V1 Tech Stack:**
```
Platform: Supabase Edge Functions (Deno)
LLM: OpenAI GPT (Function Calling API)
Database: PostgreSQL (Supabase)
Tool-Definition: JSON-Schema für OpenAI
Deployment: Separate Edge Functions als Microservices
```

**V1 Hauptkomponenten:**

1. **Tool Schema Definition** (`toolSchemas`)
   - JSON-Schemas für OpenAI Function Calling
   - Definiert Parameter und Requirements für jedes Tool

2. **Tool Execution Pipeline** (`runToolPipeline`)
   - Verwaltet kompletten Tool-Ausführungszyklus
   - Status-Management: queued → running → succeeded/failed

3. **Tool Execution Functions**
   - `executeTool()` - Router-Funktion
   - `runSearchFlightsTool()` - Flugsuche-Implementierung
   - Weitere tool-spezifische Funktionen

4. **Tool Call Registry** (Database)
   - Tabelle: `tool_call`
   - Speichert alle Tool-Calls für Audit und Retries
   - Deduplication via `dedupe_key`

5. **Session State Management**
   - Speichert Kontext zwischen Tool-Calls
   - `last_flight_request`, `pending_flight_request`, etc.

**V1 Tool-Call Registry Schema:**
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

**V1 Seats.aero Integration:**
- Edge Function: `seatsaero-flight-search/index.ts`
- API: `https://seats.aero/partnerapi`
- Auth: Partner-Authorization Header
- Searches award flights with miles/points

**V1 Amadeus Integration:**
- Edge Function: `amadeus-flight-search/index.ts`
- API: Amadeus Flight Offers API v2
- Auth: OAuth2 Token (cached in database)
- Searches regular cash flights

**V1 Tool Execution Flow:**
```
User Message → OpenAI GPT (Function Calling)
    ↓
Tool Call Decision → recordToolCall() (DB)
    ↓
runToolPipeline() → executeTool()
    ↓
Edge Functions (seatsaero-flight-search, amadeus-flight-search)
    ↓
External APIs (Seats.aero, Amadeus)
    ↓
updateToolCall() → Response
```

---

### 2. V2 Architecture Analysis (Current Development)

**Codebase Locations:**
- Main Chat API: `app/api/search/route.ts`
- Tools: `lib/tools/*.ts` (23 tools)
- Tool Registration: `app/actions.ts` (groupTools, groupInstructions)
- Database: Drizzle ORM (`lib/db/`)

**V2 Tech Stack:**
```
Platform: Next.js 15 (App Router) auf Vercel
LLM: OpenAI GPT-5 (fixed configuration)
Database: PostgreSQL (Drizzle ORM)
Tool-Definition: Zod + Vercel AI SDK tool() function
Deployment: Next.js API Routes (serverless)
```

**V2 Tool Pattern (Existing Example: web-search.ts):**
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const webSearchTool = (dataStream: UIMessageStreamWriter) => 
  tool({
    description: 'Search the web for information',
    parameters: z.object({
      queries: z.array(z.string()).min(3).max(5),
      maxResults: z.array(z.number()).min(1),
      topics: z.array(z.enum(['general', 'news'])),
      quality: z.array(z.enum(['default', 'best']))
    }),
    execute: async ({ queries, maxResults, topics, quality }) => {
      // Implementation
      const results = await searchProvider.search(...);
      
      // Streaming updates
      dataStream?.write({
        type: 'data-query_completion',
        data: { query, status: 'completed' }
      });
      
      return results;
    }
  });
```

**V2 Tool Integration (app/api/search/route.ts):**
```typescript
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
    // ... 23 tools total
    // ❌ FEHLT: search_flights, amadeus, seats_aero
  }
});
```

**V2 Tool Groups System (app/actions.ts):**
```typescript
const groupTools = {
  web: ['web_search', 'greeting', 'code_interpreter', ...],
  academic: ['academic_search', 'code_interpreter', 'datetime'],
  youtube: ['youtube_search', 'datetime'],
  stocks: ['stock_chart', 'currency_converter', 'datetime'],
  chat: [], // No tool-calling
  // ❌ FEHLT: flights group
};

const groupInstructions = {
  web: `You are an AI web search engine...`,
  academic: `You are an academic research assistant...`,
  // ❌ FEHLT: flights instructions
};
```

**V2 AI Provider Configuration (ai/providers.ts):**
```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const DEFAULT_MODEL = 'gpt-5';
export const languageModel = openai(DEFAULT_MODEL);

// No authentication required for the app
export function requiresAuthentication(): boolean {
  return false;
}
```

---

### 3. Gap Analysis

#### ❌ Missing Components in V2:

**Critical:**
1. **Flight Search Tools**
   - No `search_flights` tool
   - No Seats.aero integration
   - No Amadeus integration
   - No flights tool group

2. **Tool-Call Registry**
   - No tool-call tracking in database
   - No status management (queued, running, succeeded, failed)
   - No deduplication system
   - No audit trail

3. **Session State Management**
   - No `last_flight_request` state
   - No `pending_flight_request` state
   - No state persistence between tool-calls

4. **API Credentials & Token Management**
   - No Seats.aero API key
   - No Amadeus OAuth2 token management
   - No token caching system

**Partially Present:**
1. **Memory System**
   - ✅ Memory tools exist (Supermemory-based)
   - ❌ No RAG with pgvector like V1
   - ❌ No Hybrid Search (BM25 + Vector)

2. **Code Interpreter**
   - ✅ Present in V2
   - ✅ Similar to V1 implementation

---

### 4. External APIs Analysis

**APIs Required:**

1. **Seats.aero Partner API**
   - Endpoint: `https://seats.aero/partnerapi`
   - Auth: `Partner-Authorization: Bearer <API_KEY>`
   - Purpose: Award flight search
   - Response: Flight availability with miles/points pricing

2. **Amadeus Flight Offers API v2**
   - Endpoint: `https://api.amadeus.com/v2/shopping/flight-offers`
   - Auth: OAuth2 Bearer Token
   - Token Endpoint: `/v1/security/oauth2/token`
   - Token Lifespan: ~30 minutes (requires caching)
   - Purpose: Cash flight search
   - Response: Flight offers with cash pricing

3. **OpenAI API**
   - ✅ Already integrated in V2
   - Model: GPT-5

---

### 5. Database Schema Requirements

**New Tables Needed:**

1. **tool_calls**
   ```typescript
   {
     id: uuid (PK),
     chatId: uuid (FK → chats.id),
     toolName: text,
     status: enum('queued', 'running', 'succeeded', 'failed', 'timeout', 'canceled'),
     request: jsonb,
     response: jsonb,
     error: text?,
     dedupeKey: text (unique),
     createdAt: timestamp,
     startedAt: timestamp?,
     finishedAt: timestamp?
   }
   ```

2. **session_states**
   ```typescript
   {
     id: uuid (PK),
     chatId: uuid (FK → chats.id, unique),
     state: jsonb,
     updatedAt: timestamp
   }
   ```

3. **amadeus_tokens**
   ```typescript
   {
     id: uuid (PK),
     environment: text ('test' | 'prod'),
     accessToken: text,
     tokenType: text,
     expiresAt: timestamp,
     createdAt: timestamp
   }
   ```

---

### 6. Architecture Decision: Migration Approach

**Option A: Full Next.js Migration** ⭐ **RECOMMENDED**

**Pros:**
- ✅ Unified codebase
- ✅ Simpler deployment (Vercel only)
- ✅ Better developer experience
- ✅ Leverages Vercel AI SDK
- ✅ Easier debugging

**Cons:**
- ⚠️ API calls run through Next.js (potentially longer response times)
- ⚠️ Token management needs reimplementation
- ⚠️ Complete code migration required

**Implementation:**
```typescript
// lib/tools/flight-search.ts
export const flightSearchTool = tool({
  description: 'Search for flights',
  parameters: z.object({ /* ... */ }),
  execute: async (params) => {
    // Direct API calls from Next.js
    const [seatsResult, amadeusResult] = await Promise.all([
      fetchSeatsAero(params),
      fetchAmadeus(params)
    ]);
    return formatResults(seatsResult, amadeusResult);
  }
});
```

---

**Option B: Hybrid with Edge Functions**

**Pros:**
- ✅ Minimal migration of existing Edge Functions
- ✅ Edge Functions remain unchanged
- ✅ Faster initial migration

**Cons:**
- ❌ Two separate deployments (Vercel + Supabase)
- ❌ More complex infrastructure
- ❌ Higher latency (extra network hop)
- ❌ Harder debugging
- ❌ Duplicate credential management

**NOT RECOMMENDED** - Adds unnecessary complexity.

---

### 7. Existing V2 Patterns to Follow

**Tool Implementation Pattern:**
```typescript
// lib/tools/<tool-name>.ts
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Clear description',
  parameters: z.object({
    // Zod schema
  }),
  execute: async (params) => {
    // Implementation
    return result;
  }
});
```

**Tool Registration in Chat:**
```typescript
// app/api/search/route.ts
tools: {
  my_tool: myTool,
  // ... other tools
}
```

**Tool Group Definition:**
```typescript
// app/actions.ts
const groupTools = {
  myGroup: ['my_tool', 'datetime'],
};

const groupInstructions = {
  myGroup: `Instructions for this group...`,
};
```

---

### 8. Environment Variables Required

**New Secrets for Vercel:**
```bash
# Amadeus API
AMADEUS_API_KEY=<Client ID>
AMADEUS_API_SECRET=<Client Secret>
AMADEUS_ENV=test # or 'prod'

# Seats.aero API
SEATSAERO_API_KEY=<Partner API Key>

# Already exist:
OPENAI_API_KEY=<API Key>
DATABASE_URL=<PostgreSQL Connection String>
```

---

### 9. Performance Considerations

**Identified Bottlenecks:**
1. **Sequential API Calls:** V1 calls Seats.aero and Amadeus in parallel
2. **Token Management:** Amadeus token needs caching (database)
3. **Database Queries:** Tool-call registry adds DB overhead

**Optimization Strategies:**
1. ✅ Use `Promise.all()` for parallel API calls
2. ✅ Cache Amadeus tokens in database (30-minute TTL)
3. ✅ Use Drizzle connection pooling
4. 🔄 Optional: Redis caching for flight results (5-minute TTL)

---

### 10. Security Considerations

**API Key Management:**
- Store in Vercel Environment Variables (encrypted)
- Never expose in client-side code
- Use server-side API routes only

**Database Security:**
- Tool-call registry accessible only via authenticated requests
- Session state tied to user's chat (authorization check)

**Rate Limiting:**
- Monitor API call frequency
- Implement backoff strategy for failed requests
- Track costs per user (optional)

---

### 11. Testing Requirements

**Unit Tests:**
- Seats.aero API client
- Amadeus API client
- Token management
- Tool execution logic

**Integration Tests:**
- End-to-end flight search flow
- Tool-call registry operations
- Session state persistence
- Parallel API calls

**Manual Testing:**
- Various flight search queries
- Error handling (API failures)
- Token expiration scenarios
- Deduplication verification

---

### 12. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Seats.aero API changes | Medium | High | Pin API version, monitoring, fallback to Amadeus |
| Amadeus token issues | Low | Medium | Retry logic, token cache, fallback mechanism |
| Performance problems | Medium | Medium | Parallel calls, caching, timeout handling |
| Rate limiting | Low | Low | Request throttling, backoff strategy |
| Database load | Low | Medium | Connection pooling, query optimization |
| Cost overruns | Medium | Medium | API call monitoring, rate limiting, caching |

---

## 📋 Key Questions for User

Before implementation, clarify:

1. **API Access:**
   - ✅ Do we have Seats.aero Partner API access?
   - ✅ Do we have Amadeus API credentials?
   - ❓ Which Amadeus environment initially (test/prod)?

2. **Scope:**
   - ✅ Focus on Award (Seats.aero) + Cash flights (Amadeus)?
   - ❓ Additional filters needed (Airline, Alliances)?
   - ❓ Multi-city search in scope?

3. **Performance:**
   - ❓ Acceptable response time? (<5s recommended)
   - ❓ Implement response caching (Redis)?

4. **Budget:**
   - ❓ API call budget per month?
   - ❓ Rate limits of the APIs?

---

## 🎯 Next Steps

Based on research findings:

1. **Create Planning Phase document:**
   - Detailed implementation steps
   - File structure
   - Code examples
   - Timeline estimation

2. **Setup Phase 0:**
   - Database schema creation
   - Environment variables
   - API credentials

3. **Begin Implementation:**
   - Follow strict task-based workflow
   - Modular code (≤600 lines per file)
   - Test-driven development

---

## 📚 References

**V1 Documentation:**
- `documentation/context/mylo-tool-calling.md`

**V2 Reference Code:**
- `app/api/search/route.ts` - Chat integration
- `lib/tools/web-search.ts` - Tool pattern example
- `lib/tools/` - 23 existing tools
- `app/actions.ts` - Tool groups
- `ai/providers.ts` - AI configuration

**External Documentation:**
- Seats.aero Partner API docs
- Amadeus Flight Offers API v2 docs
- Vercel AI SDK docs: https://sdk.vercel.ai/docs

---

**Research Completed:** 31. Oktober 2024  
**Next Phase:** Planning
