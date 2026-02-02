# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Server-driven AI chat application using Next.js App Router with server actions and edge computing. Modular tool-based architecture with real-time streaming response handling and database-persisted conversation history.

**Key Characteristics:**
- Server Actions (`'use server'`) for backend operations, client components (`'use client'`) for UI
- Streaming AI responses via `@ai-sdk/react` useChat hook with custom transport handling
- Pluggable tool system with 25+ integrated tools (search, finance, maps, memory, flight tracking)
- Multi-provider AI model support (OpenAI GPT-5, xAI Grok-4-Fast) with environment-based switching
- PostgreSQL (Neon) database with Drizzle ORM and read replicas; Upstash Redis caching layer
- Authentication via Better Auth with Polar/DodoPayments subscription integration

## Layers

**Server Layer:**
- Purpose: Handles authentication, database operations, AI inference, and third-party API calls
- Location: `app/api/`, `app/actions.ts`, `lib/auth.ts`, `lib/db/queries/`
- Contains: Server Actions, API routes (Next.js App Router), Drizzle queries, authentication logic
- Depends on: Database, third-party APIs (Tavily, Exa, YouTube, X/Twitter, Gemini), AI models
- Used by: Client components via server actions and API endpoints

**Client Layer:**
- Purpose: Renders interactive UI, manages local state, handles user input and streaming responses
- Location: `components/`, `app/(chat)/`, `app/(auth)/`, `hooks/`, `contexts/`
- Contains: React components, custom hooks, context providers, UI state management
- Depends on: Server actions, API routes, AI SDK React hooks
- Used by: Next.js pages in app directory

**Database Layer:**
- Purpose: Persists user data, chat history, messages, custom instructions, subscriptions
- Location: `lib/db/index.ts`, `lib/db/schema.ts`, `lib/db/queries/`
- Contains: Drizzle ORM configuration, PostgreSQL schema definitions, query functions
- Depends on: Neon (PostgreSQL), Upstash Redis (cache)
- Used by: Server actions and API routes

**AI/Tools Layer:**
- Purpose: Provides LLM integration and specialized tool implementations
- Location: `ai/providers.ts`, `lib/tools/`
- Contains: Model configuration (OpenAI/xAI switching), 25+ tool definitions (search, maps, finance, etc.)
- Depends on: Multiple AI provider SDKs (@ai-sdk/openai, @ai-sdk/xai, @ai-sdk/google, @ai-sdk/groq, etc.)
- Used by: Server actions for message processing

**Authentication Layer:**
- Purpose: Session management, user verification, OAuth integration, subscription management
- Location: `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-utils.ts`
- Contains: Better Auth configuration, session validation, OAuth providers, subscription webhooks
- Depends on: Better Auth, Drizzle, Polar SDK, DodoPayments SDK
- Used by: Server actions and middleware for protected routes

## Data Flow

**Chat Message Processing:**

1. User submits message via `ChatInterface` (client)
2. `useChat` hook sends message to `/api/chat` endpoint or server action
3. Server action:
   - Validates user authentication via Better Auth
   - Loads relevant tools based on message context
   - Calls selected AI model with system prompt and tools
   - AI processes message, selects and executes tools in parallel
4. Tools execute (search, API calls, database queries)
5. AI generates response incorporating tool results
6. Response streams back to client in chunks via DefaultChatTransport
7. Client displays streamed response in real-time
8. Message and metadata persisted to PostgreSQL via Drizzle
9. Chat title auto-generated if new conversation

**State Management:**

- Global: TanStack React Query (TanQuery) for server state, QueryClientProvider in `app/providers.tsx`
- Session: Better Auth session context, validated on every server action
- UI State: useReducer with `chatReducer` for complex chat state (see `components/chat-state.ts`)
- Local Storage: Persisted settings (custom instructions enabled, upgrade dialog state)
- Context API: `UserProvider` for user data, `DataStreamProvider` for streaming events

## Key Abstractions

**Chat System:**
- Purpose: Encapsulates conversation management, message history, AI interaction
- Examples: `components/chat-interface.tsx`, `lib/chat-utils.ts`, `app/(chat)/page.tsx`
- Pattern: useChat hook from @ai-sdk/react handles streaming and state synchronization

**Tool System:**
- Purpose: Abstracts specialized capabilities (search, maps, flight tracking, memory, etc.)
- Examples: `lib/tools/web-search.ts`, `lib/tools/flight-tracker.ts`, `lib/tools/knowledge-base-query.ts`
- Pattern: Each tool exports configuration object with execute function; dynamically loaded based on context

**Database Queries:**
- Purpose: Encapsulates database access with type-safe Drizzle ORM
- Examples: `lib/db/queries.ts`, `lib/db/queries/kb-documents.ts`
- Pattern: Pure async functions returning typed data; called from server actions only

**Authentication:**
- Purpose: Manages user identity and access control
- Examples: `lib/auth.ts` (Better Auth config), `lib/access-control.ts` (role-based access)
- Pattern: Session-based auth with cookie storage; server-side validation on protected operations

**Error Handling:**
- Purpose: Standardizes error types across surfaces (chat, API, database, auth)
- Examples: `lib/errors.ts`, `lib/errors/kb-errors.ts`
- Pattern: `ChatSDKError` class with error code (type:surface) and visibility levels

## Entry Points

**Chat Page:**
- Location: `app/(chat)/page.tsx`
- Triggers: User navigates to "/" after authentication
- Responsibilities: Auth guard, renders ChatInterface component, suspense handling

**API Routes:**
- Location: `app/api/` (various subdirectories)
- Triggers: POST/GET requests from client or external webhooks
- Responsibilities: Process specific operations (chat, search, upload, webhooks)

**Server Actions:**
- Location: `app/actions.ts` (main), scattered in components
- Triggers: Client form submissions, button clicks, useChat hook calls
- Responsibilities: Authentication checks, database operations, AI inference, business logic

**Cron Jobs:**
- Location: `app/api/cron/` endpoints
- Triggers: Scheduled via external service (Upstash QStash or similar)
- Responsibilities: Cleanup operations, subscription checks, image optimization

## Error Handling

**Strategy:** Layered error handling with surface-aware visibility and type-based routing.

**Patterns:**

- **Server Actions:** Errors caught and wrapped in ChatSDKError, returned to client for display
- **API Routes:** Custom error responses via `ChatSDKError.toResponse()`, hides sensitive info in production
- **Database:** Errors logged server-side only; user sees generic "try again" message
- **Tools:** Tool execution errors caught by AI SDK, model decides whether to retry or inform user
- **Validation:** Zod schemas validate input before processing; errors returned immediately
- **Auth:** Unauthorized access redirects to sign-in; token expiration handled gracefully

## Cross-Cutting Concerns

**Logging:** Console-based in development; production removes console.log via Next.js compiler plugin. Critical errors logged with context via ChatSDKError.

**Validation:** Zod schema validation on:
- Environment variables (client.ts, server.ts)
- User input (message content, file uploads)
- API responses (tool results, external API data)
- Database records (chat, message schema constraints)

**Authentication:** Server actions check user via `getUser()` before processing sensitive data. Public routes (pricing, terms) have no auth requirement. Protected routes redirect to sign-in.

**Rate Limiting:** Better Auth rate limiting (50 requests per 60s) on auth endpoints. Tool-specific limits checked in each tool (e.g., extreme_search usage tracking via `usageCountCache`).

**Performance Caching:**
- Upstash Redis for database query results (10-minute TTL via cache middleware)
- Performance cache for token usage counts (in-memory with time-based expiration)
- useChat hook manages client-side message cache with stale-while-revalidate strategy

**Subscription Integration:** Polar and DodoPayments webhooks update subscription status. Usage limits enforced via `requiresProSubscription()` checks in AI provider config.

---

*Architecture analysis: 2026-02-02*
