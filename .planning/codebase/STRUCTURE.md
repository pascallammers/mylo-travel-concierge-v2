# Codebase Structure

**Analysis Date:** 2026-02-02

## Directory Layout

```
mylo-travel-concierge-v2/
├── app/                          # Next.js App Router pages and API routes
│   ├── (auth)/                   # Auth-related routes (sign-in, reset-password)
│   ├── (chat)/                   # Main chat interface routes
│   │   ├── new/                  # New chat creation page
│   │   └── search/               # Search results page
│   ├── admin/                    # Admin dashboard (analytics, users, KB)
│   ├── api/                      # API route handlers
│   │   ├── admin/                # Admin endpoints
│   │   ├── auth/                 # Better Auth routes
│   │   ├── chat/                 # Chat processing endpoints
│   │   ├── knowledge-base/       # KB management endpoints
│   │   ├── webhooks/             # Subscription webhooks (Polar, DodoPayments)
│   │   ├── cron/                 # Scheduled job endpoints
│   │   └── ...other endpoints
│   ├── layout.tsx                # Root layout with providers and fonts
│   ├── actions.ts                # Main server actions for chat, user, settings
│   └── ...other routes           # Public pages (pricing, terms, about)
│
├── components/                   # Reusable React components
│   ├── chat-interface.tsx        # Main chat UI component
│   ├── chat-dialogs.tsx          # Chat-related dialog modals
│   ├── messages.tsx              # Message display and rendering
│   ├── navbar.tsx                # Top navigation bar
│   ├── ui/                       # Shadcn/Radix UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...other UI primitives
│   ├── message-parts/            # Message rendering components (search results, charts)
│   ├── core/                     # Core animation and utility components
│   ├── admin/                    # Admin-specific components
│   ├── awardwallet/              # AwardWallet integration components
│   ├── chat-sidebar/             # Sidebar for chat history
│   ├── dialogs/                  # Custom dialog components
│   └── ...other feature components
│
├── lib/                          # Core library code
│   ├── auth.ts                   # Better Auth configuration
│   ├── auth-client.ts            # Client-side auth utilities
│   ├── auth-utils.ts             # Server-side auth helpers
│   ├── db/                       # Database layer
│   │   ├── index.ts              # Drizzle ORM setup with replicas and caching
│   │   ├── schema.ts             # PostgreSQL schema definitions
│   │   └── queries/              # Query functions
│   │       ├── queries.ts        # Main queries export
│   │       ├── kb-documents.ts   # Knowledge base queries
│   │       ├── awardwallet.ts    # AwardWallet integration queries
│   │       └── ...other domain queries
│   ├── tools/                    # AI tool implementations
│   │   ├── web-search.ts         # Exa web search
│   │   ├── x-search.ts           # Twitter/X search
│   │   ├── youtube-search.ts     # YouTube content search
│   │   ├── flight-tracker.ts     # Flight tracking tool
│   │   ├── knowledge-base-query.ts  # Internal KB search
│   │   ├── currency-converter.ts # Currency conversion
│   │   ├── code-interpreter.ts   # Python code execution
│   │   └── ...20+ other tools
│   ├── config/                   # Configuration files
│   │   ├── knowledge-base.ts     # KB initialization
│   │   └── amex-transfer-ratios.ts
│   ├── errors/                   # Error definitions
│   │   ├── kb-errors.ts          # Knowledge base errors
│   │   └── ...other error types
│   ├── utils.ts                  # General utility functions
│   ├── chat-utils.ts             # Chat-specific helpers
│   ├── connectors.tsx            # External data connector utilities
│   ├── email.ts                  # Email template/sending
│   ├── performance-cache.ts      # In-memory caching for performance
│   ├── subscription.ts           # Subscription logic
│   └── types.ts                  # TypeScript type definitions
│
├── ai/                           # AI provider configuration
│   └── providers.ts              # OpenAI/xAI model switching, capabilities
│
├── contexts/                     # React Context providers
│   └── user-context.tsx          # User data context
│
├── hooks/                        # Custom React hooks
│   ├── use-chat-history.ts       # Chat history management
│   ├── use-user-data.ts          # User data fetching
│   ├── use-cached-user-data.tsx  # Cached user data
│   ├── use-usage-data.ts         # Usage statistics
│   ├── use-mobile.ts             # Mobile detection
│   ├── use-location.ts           # Geolocation
│   ├── use-local-storage.tsx     # Local storage persistence
│   └── ...other custom hooks
│
├── env/                          # Environment variable validation
│   ├── client.ts                 # Client-side env vars (prefixed NEXT_PUBLIC_)
│   └── server.ts                 # Server-side env vars
│
├── public/                       # Static assets
│   ├── icons/
│   └── images/
│
├── drizzle/                      # Database migrations
│   └── migrations/               # Generated migration files
│
├── scripts/                      # Utility scripts
│
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies and scripts
└── .eslintrc.json                # ESLint configuration
```

## Directory Purposes

**app/:**
- Purpose: Next.js App Router entry points, layout structure, API routes
- Contains: Page components, layout wrappers, server actions, API route handlers
- Key files: `layout.tsx` (root layout), `actions.ts` (main server actions), `providers.tsx` (React providers)

**components/:**
- Purpose: Reusable React components organized by feature/domain
- Contains: Functional components, UI primitives (via Shadcn), custom elements
- Patterns: Client components unless marked `'use server'`; lazy-loaded for code splitting

**lib/:**
- Purpose: Shared business logic, database access, utilities, tool implementations
- Contains: Server-only code, ORM setup, type definitions, helper functions
- Patterns: Server actions import from lib; client code imports only non-sensitive utilities

**lib/db/:**
- Purpose: Database abstraction layer
- Contains: Drizzle ORM setup, PostgreSQL schema, query builders
- Key pattern: Queries exported from `queries.ts` and domain-specific files; replicas for read scaling

**lib/tools/:**
- Purpose: AI tool implementations that can be called by language models
- Contains: Search engines, APIs, calculators, memory management, flight/loyalty trackers
- Pattern: Each tool exports config object with description, parameters schema, and execute function

**ai/:**
- Purpose: AI model provider configuration
- Contains: Model switching logic (OpenAI vs xAI), capabilities flags, model parameters
- Pattern: Single source of truth for model selection via `USE_XAI` environment variable

**contexts/:**
- Purpose: React Context providers for application state
- Contains: User context with login state, user data
- Pattern: Wrapped in layout via providers; custom hooks access via useContext

**hooks/:**
- Purpose: Custom React hooks for reusable stateful logic
- Contains: Data fetching, local storage, UI utilities, geolocation
- Pattern: Hooks follow React conventions; named `use*`; many depend on server actions

**env/:**
- Purpose: Environment variable validation with Zod schemas
- Contains: Type-safe access to process.env
- Pattern: `client.ts` exports `clientEnv` for browser-safe vars; `server.ts` exports `serverEnv`

**drizzle/:**
- Purpose: Database migration management
- Contains: Auto-generated migration files from schema changes
- Pattern: Generated by Drizzle Kit; committed to version control

## Key File Locations

**Entry Points:**

- `app/layout.tsx`: Root HTML layout, global styles, font loading, analytics setup
- `app/(chat)/page.tsx`: Main chat interface entry point (protected route)
- `app/api/chat/route.ts`: Chat message processing endpoint (if exists)
- `app/actions.ts`: Main server actions (getUserData, suggestQuestions, updateChat, etc.)

**Configuration:**

- `app/providers.tsx`: React provider setup (QueryClient, UserProvider, Themes, DataStreamProvider)
- `lib/auth.ts`: Better Auth configuration with database adapter and plugins
- `ai/providers.ts`: AI model selection and capabilities
- `next.config.ts`: Next.js configuration, compiler options, headers

**Core Logic:**

- `components/chat-interface.tsx`: Main chat UI with useChat hook integration
- `lib/chat-utils.ts`: Chat utilities for parsing, formatting, message handling
- `lib/db/schema.ts`: PostgreSQL table definitions (user, session, chat, message, subscription)
- `lib/tools/`: Tool implementations (25+ total)

**Testing:**

- `lib/**/*.test.ts`: Unit tests (chat-utils, auth, password-reset, KB queries)
- `lib/**/*.integration.test.ts`: Integration tests (tool calls, flight tracker)
- `components/**/*.test.tsx`: Component tests (settings dialog)

## Naming Conventions

**Files:**

- React components: PascalCase (`ChatInterface.tsx`, `Navbar.tsx`)
- Hooks: `use` prefix in camelCase (`use-chat-history.ts`, `use-mobile.ts`)
- Utilities/helpers: camelCase (`chat-utils.ts`, `performance-cache.ts`)
- Server actions: camelCase (`get-user.ts` if separated, or in `actions.ts`)
- Types/schemas: camelCase (`types.ts`, `schema.ts`)
- Tests: Same name as source with `.test.ts` or `.integration.test.ts` suffix

**Directories:**

- Feature domains: kebab-case (`chat-sidebar/`, `message-parts/`, `awardwallet/`)
- API routes: kebab-case matching endpoint path (`api/admin/`, `api/knowledge-base/`)
- Page groups (protected/public): Parentheses for grouping (`(auth)/`, `(chat)/`)

**Code Identifiers:**

- Components: PascalCase (`ChatInterface`, `Navbar`)
- Functions: camelCase (`suggestQuestions`, `getCurrentUser`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_MODEL`, `UPSTASH_REDIS_REST_URL`)
- Types: PascalCase (`ChatMessage`, `ChatTools`, `ErrorCode`)
- React hooks/context: camelCase starting with `use` (`useUser`, `useChat`, `useSession`)

## Where to Add New Code

**New Feature (e.g., new search capability):**

- Primary code:
  - Tool implementation: `lib/tools/your-search-type.ts`
  - UI component: `components/your-search-results.tsx`
  - Types: Update `lib/types.ts` ChatTools type
- Tests: `lib/tools/your-search-type.test.ts` (unit) or `.integration.test.ts` (with external API)
- Registration: Import and add tool to tool list in server action or tool loader

**New Component/Feature:**

- Implementation: `components/feature-name/` (folder) or `components/feature-name.tsx` (file)
- Context if needed: `contexts/feature-context.tsx`
- Custom hooks: `hooks/use-feature.ts`
- Types: `lib/types.ts` or feature-specific type file

**New Server Action:**

- Location: `app/actions.ts` for main chat actions, or `app/api/[route]/route.ts` for endpoint
- Pattern: Mark with `'use server'`, validate user, call lib functions
- Testing: `lib/chat-utils.test.ts` or similar for underlying logic

**New Database Query:**

- Location: `lib/db/queries/your-domain.ts` if domain-specific, else `lib/db/queries.ts`
- Pattern: Export async functions returning typed data via Drizzle
- Schema change: Update `lib/db/schema.ts`, run `drizzle-kit generate`, commit migration

**Utilities:**

- Shared helpers: `lib/utils.ts` (general) or domain-specific file (`lib/chat-utils.ts`)
- React hooks: `hooks/use-your-hook.ts`
- Configuration: `lib/config/your-config.ts`

## Special Directories

**app/api/:**
- Purpose: API route handlers following Next.js App Router conventions
- Generated: No; manually created per endpoint
- Committed: Yes; part of source control

**(auth)/ and (chat)/ Route Groups:**
- Purpose: Logical grouping without affecting URL structure
- Generated: No; manually created
- Committed: Yes; convention for organization

**lib/db/queries/:**
- Purpose: Encapsulated database access patterns
- Generated: Migrations auto-generated by Drizzle Kit; queries manually written
- Committed: Migrations committed; queries are source code

**drizzle/migrations/:**
- Purpose: Version control for schema changes
- Generated: Yes; generated by `drizzle-kit generate` from schema.ts changes
- Committed: Yes; migrations applied to production database

**.next/:**
- Purpose: Next.js build output (chunks, cache, types)
- Generated: Yes; auto-generated during build
- Committed: No; in .gitignore

**node_modules/:**
- Purpose: Dependency packages
- Generated: Yes; created by pnpm install
- Committed: No; managed via package.json and pnpm-lock.yaml

---

*Structure analysis: 2026-02-02*
