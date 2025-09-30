# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scira is an AI-powered search engine built with Next.js 15 that provides multi-modal search capabilities across web, academic papers, YouTube, social media, and more. The application integrates with multiple LLM providers (xAI, Anthropic, Google, OpenAI, Groq) and offers specialized tools for code execution, financial analysis, weather, maps, and cryptocurrency data.

## Development Commands

```bash
# Install dependencies (pnpm 10.16.1 is pinned)
pnpm install

# Development server with Turbopack (runs on http://localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Linting and formatting
pnpm lint          # Run ESLint with Next.js config
pnpm fix           # Format code with Prettier

# Dependency audit
pnpm knip          # Find unused files, exports, and dependencies

# Docker deployment
docker compose up  # Launch containerized stack
```

## Database Management

The project uses Drizzle ORM with PostgreSQL:

```bash
# Generate migrations after schema changes in lib/db/schema.ts
npx drizzle-kit generate

# Apply migrations to database
npx drizzle-kit migrate

# Open Drizzle Studio for database inspection
npx drizzle-kit studio
```

Schema is located at `lib/db/schema.ts` with migrations in `drizzle/migrations/`. Manual indexes are in `create_indexes.sql`.

## Architecture Overview

### Core Application Structure

- **`app/`** - Next.js 15 app router with route groups:
  - `(auth)/` - Authentication pages (sign-in, sign-up)
  - `(search)/` - Main search interface
  - `api/` - API routes including `/api/search` (main chat endpoint)
  - Route-level actions in `actions.ts` (server actions)

- **`ai/providers.ts`** - Central AI model registry defining all available LLM models through the `scira` custom provider. Models are prefixed with `scira-*` (e.g., `scira-grok-3`, `scira-anthropic`). Each model has metadata including pro/auth requirements, vision support, reasoning capabilities.

- **`lib/tools/`** - AI tools for search and data retrieval:
  - Exports centralized in `index.ts`
  - Each tool implements Vercel AI SDK tool format
  - Tools: web-search, academic-search, youtube-search, extreme-search, code-interpreter, stock-chart, currency-converter, weather, map-tools, flight-tracker, crypto-tools, connectors-search, etc.

- **`lib/auth.ts`** - Authentication using Better Auth with multiple providers (GitHub, Google, Twitter, Microsoft) and integrations with Polar.sh and DodoPayments for subscriptions

- **`lib/subscription.ts`** - Subscription management combining Polar.sh (international) and DodoPayments (India) with caching via `performance-cache.ts`

- **`lib/connectors.tsx`** - Supermemory connector integrations for syncing external data sources (Notion, Google Drive, etc.)

- **`components/`** - React components using shadcn/ui and Tailwind CSS
  - shadcn components in `components/ui/`
  - Custom components colocated with usage context

### Authentication & Authorization

Authentication is handled by Better Auth with session-based auth. Key files:
- `lib/auth.ts` - Server-side auth config
- `lib/auth-client.ts` - Client-side auth hooks
- `middleware.ts` - Route protection (protectedRoutes: `/lookout`, `/xql`)

Pro subscription is required for certain models and features. Check `ai/providers.ts` model definitions for `pro: true` and `requiresAuth: true` flags.

### Search Flow

1. User sends message to `/api/search/route.ts`
2. Route validates user, checks subscription/usage limits
3. Determines search group config (`getGroupConfig`) which defines available tools
4. Calls Vercel AI SDK's `streamText` with appropriate model and tools
5. AI decides which tools to call based on query
6. Results streamed back to client with markdown parsing via `lib/parser.ts`
7. Messages saved to database in `lib/db/queries.ts`

### Search Groups

Search groups define tool availability by context (defined in `app/actions.ts`):
- **web** - General web search (Tavily)
- **memory** - User's personal memory (requires auth)
- **analysis** - Code execution, stocks, currency
- **chat** - Direct AI conversation
- **x** - X/Twitter search
- **reddit** - Reddit search
- **academic** - Academic papers (Exa)
- **youtube** - YouTube videos (Exa)
- **extreme** - Multi-step deep research

### Tool Integration Pattern

Tools follow this structure:
```typescript
export const myTool = coreTool({
  description: "What this tool does",
  parameters: z.object({...}),
  execute: async (params, { toolCallId }) => {
    // API calls, data processing
    return { /* results */ };
  },
});
```

Tools are conditionally added to `streamText` based on search group and user permissions.

### Performance Optimizations

- **`lib/performance-cache.ts`** - In-memory caching for user data, subscriptions, usage counts (5-15 min TTL)
- **`lib/user-data-server.ts`** - Cached unified user data fetching
- Custom instructions cached at 5 min TTL
- Database queries use `$withCache()` where applicable
- Upstash Redis for rate limiting and queue management

### Database Schema

Key tables (see `lib/db/schema.ts`):
- `user`, `session`, `account`, `verification` - Auth tables
- `chat`, `message`, `stream` - Conversation data
- `subscription`, `payment` - Billing
- `extremeSearchUsage`, `messageUsage` - Usage tracking
- `customInstructions` - User preferences
- `lookout` - Scheduled monitoring tasks

## Environment Variables

Copy `.env.example` to `.env.local`. Key variables:

**Required for core functionality:**
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth secret key
- AI provider keys: `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`
- Search: `EXA_API_KEY`, `TAVILY_API_KEY`

**OAuth providers:**
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

**Billing:**
- `POLAR_ACCESS_TOKEN` (Polar.sh for international)
- `DODO_PAYMENTS_API_KEY` (DodoPayments for India)

See README.md for complete list of optional service integrations (weather, maps, flights, etc.).

## Important Code Patterns

### Adding a New AI Model

1. Add model to `ai/providers.ts` in the `scira.languageModels` object
2. Add model metadata to `models` array with pro/auth/vision flags
3. Model automatically available in UI model selector

### Adding a New Tool

1. Create tool file in `lib/tools/my-tool.ts`
2. Export from `lib/tools/index.ts`
3. Import and conditionally add to tool array in `/api/search/route.ts` based on search group
4. Consider adding to appropriate search group config in `app/actions.ts`

### Server Actions Pattern

Server actions in `app/actions.ts` use `'use server'` directive. Common pattern:
```typescript
export async function myAction() {
  'use server';
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  // ... action logic
}
```

### Type Imports

Use `@/` path alias for all imports:
```typescript
import { tool } from '@/lib/tools';
import { db } from '@/lib/db';
```

## Testing & Validation

Before committing:
1. Run `pnpm lint` to check for linting errors
2. Run `pnpm build` to verify production build
3. Test key user flows: search, auth callbacks, tool invocations
4. For schema changes, test migrations locally before committing

No automated test suite exists yet. When adding tests, place unit tests beside source files (`lib/foo.test.ts`) and use Vitest or Playwright.

## Deployment Notes

- Primarily deployed on Vercel
- Requires PostgreSQL database (Neon recommended)
- Set all environment variables in Vercel dashboard
- Production uses `NODE_ENV=production` to switch Polar.sh/DodoPayments to live mode
- Edge Config (`@vercel/edge-config`) used for feature flags and discount configuration
- Cron jobs via Upstash QStash for scheduled tasks (lookout monitoring)

## Common Gotchas

- **Turbopack:** Dev and build use `--turbopack` flag. Some webpack-specific configs may not work.
- **Middleware:** Route protection in `middleware.ts` has specific exclusions for webhooks and public API endpoints.
- **Better Auth:** Uses cookie-based sessions with 5-min cookie cache. Clear session cache when debugging auth issues.
- **Tool execution:** Tools must return serializable data (no functions, class instances) since results are stored in DB.
- **Model reasoning:** Some models (e.g., `scira-qwen-235-think`) extract reasoning into separate stream via middleware. Check `ai/providers.ts` for middleware wrappers.
- **Subscription checks:** Always use `getComprehensiveUserData()` or `getCurrentUser()` to get cached user with pro status, not direct DB queries.

## Code Style

- TypeScript strict mode enabled
- Use Tailwind CSS utility classes, not custom CSS
- Prefer functional React components with hooks
- Server components by default; use `'use client'` only when needed
- PascalCase for components, camelCase for functions/variables, `use` prefix for hooks
- Let Prettier handle formatting (no manual whitespace edits)