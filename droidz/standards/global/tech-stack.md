# Tech Stack

## Overview

This document defines the technical stack for the Mylo Travel Concierge project. All development must use these technologies and follow the established patterns.

## Framework & Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.6+ (Canary) | Full-stack React framework with App Router |
| **React** | 19.x | UI library with Server Components |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Node.js** | 20+ | Runtime environment |
| **pnpm** | 10.x | Package manager |

## Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Radix UI** | Latest | Accessible UI primitives |
| **shadcn/ui** | Custom | Component library (copied, not installed) |
| **Framer Motion** | 12.x | Animation library |
| **Lucide React** | Latest | Icon library |
| **Hugeicons** | Latest | Additional icons |
| **TanStack Query** | 5.x | Server state management |
| **nuqs** | 2.x | URL state management |

## Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Drizzle ORM** | 0.44+ | Type-safe SQL ORM |
| **PostgreSQL** | 16+ | Primary database (via Neon) |
| **Neon Serverless** | Latest | Serverless Postgres driver |
| **better-auth** | Latest | Authentication framework |
| **Zod** | 3.x | Schema validation |

## AI & LLM Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vercel AI SDK** | 5.x | AI streaming & tools |
| **@ai-sdk/anthropic** | Latest | Claude models |
| **@ai-sdk/openai** | Latest | GPT models |
| **@ai-sdk/google** | Latest | Gemini models |
| **@ai-sdk/xai** | Latest | Grok models |
| **@ai-sdk/groq** | Latest | Groq inference |
| **@ai-sdk/mistral** | Latest | Mistral models |

## External Services

| Service | Purpose |
|---------|---------|
| **Vercel** | Deployment & hosting |
| **Neon** | Serverless PostgreSQL |
| **Polar.sh** | Subscription management |
| **Dodo Payments** | Payment processing |
| **Resend** | Transactional email |
| **Upstash Redis** | Rate limiting & caching |
| **Vercel Blob** | File storage |

## Testing Stack

| Technology | Purpose |
|------------|---------|
| **tsx --test** | Native Node.js test runner |
| **Testing Library** | React component testing |
| **happy-dom** | DOM simulation |

## Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Drizzle Kit** | Database migrations |
| **Turbopack** | Fast bundler (dev) |

## File Structure

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── api/               # API routes
│   └── [dynamic]/         # Dynamic routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── [feature]/        # Feature components
├── lib/                   # Shared utilities
│   ├── api/              # External API clients
│   ├── db/               # Database (Drizzle)
│   ├── tools/            # AI SDK tools
│   └── utils/            # Helper functions
├── hooks/                 # React hooks
├── contexts/              # React contexts
├── env/                   # Environment schemas
└── drizzle/              # DB migrations
```

## Key Conventions

### Imports
```typescript
// External packages first
import { z } from 'zod';
import { tool } from 'ai';

// Internal absolute imports
import { db } from '@/lib/db';
import { ChatSDKError } from '@/lib/errors';

// Relative imports last
import { localHelper } from './helpers';
```

### Environment Variables
- Server-only: `env/server.ts` with `serverEnv`
- Client-safe: `env/client.ts` with `clientEnv`
- Never expose server env to client

### Database
- Schema: `lib/db/schema.ts`
- Queries: `lib/db/queries.ts`
- Use `.$withCache()` for read queries
- Use transactions for multi-step writes
