# 🛠️ MYLO - Technology Stack

> Complete technical architecture and tooling decisions

---

## Overview

MYLO is built on a modern, serverless-first architecture optimized for AI workloads, real-time interactions, and global scalability.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│    Next.js 15 + React 19 + Tailwind CSS + Radix UI          │
├─────────────────────────────────────────────────────────────┤
│                      API Layer                               │
│         Next.js API Routes + Server Actions                  │
├─────────────────────────────────────────────────────────────┤
│                     AI Layer                                 │
│    Vercel AI SDK (OpenAI, xAI, Anthropic, Google, etc.)     │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│              NeonDB (PostgreSQL) + Drizzle ORM              │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure                              │
│         Vercel (Hosting) + Upstash (Redis/QStash)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend

### Framework: Next.js 15 (Canary)
- **Version**: `15.6.0-canary.25`
- **Features Used**: App Router, Server Components, Server Actions, Turbopack
- **Rationale**: Industry-leading React framework with excellent DX, built-in optimization, and Vercel integration

### UI Library: React 19
- **Version**: `^19.1.1`
- **Features Used**: Server Components, Hooks, Suspense, Concurrent Features
- **Rationale**: Latest React with improved performance and server-first architecture

### Styling: Tailwind CSS 4
- **Version**: `^4.1.13`
- **Features Used**: CSS-first config, container queries, modern utilities
- **Rationale**: Utility-first CSS with excellent performance and DX

### Component Library: Radix UI
- **Packages**: `@radix-ui/react-*` (dialog, dropdown, tabs, etc.)
- **Features Used**: Accessible primitives, headless components
- **Rationale**: Fully accessible, unstyled components for custom design

### Additional UI Libraries
| Library | Purpose | Version |
|---------|---------|---------|
| `lucide-react` | Icon library | `^0.544.0` |
| `framer-motion` | Animations | `^12.23.21` |
| `sonner` | Toast notifications | `^2.0.7` |
| `cmdk` | Command palette | `^1.1.1` |
| `vaul` | Drawer component | `^1.1.2` |
| `recharts` | Charts | `^2.15.3` |
| `echarts` | Advanced charts | `^5.6.0` |
| `leaflet` | Maps | `^1.9.4` |

---

## AI & Language Models

### Core: Vercel AI SDK
- **Version**: `5.0.51`
- **Features Used**: Streaming, tool calling, multi-model support, UI components
- **Rationale**: Best-in-class SDK for AI chat applications

### Model Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| **OpenAI** | GPT-5 | Primary language model |
| **xAI** | Grok 4 Fast | Alternative reasoning model |
| **Anthropic** | Claude | Fallback/specific tasks |
| **Google** | Gemini | Multimodal capabilities |
| **Groq** | Llama variants | Fast inference |
| **Mistral** | Mistral models | European alternative |

### AI Configuration
```typescript
// Switchable via USE_XAI environment variable
const USE_XAI = process.env.USE_XAI === 'true';
// Default: GPT-5, Alternative: Grok 4 Fast
```

### AI Tools/Capabilities
- Text generation with streaming
- Tool/function calling
- Vision (image understanding)
- PDF processing
- Code interpretation (via Daytona)

---

## Backend & Database

### Database: NeonDB (PostgreSQL Serverless)
- **Package**: `@neondatabase/serverless`
- **Features Used**: Connection pooling, branching, autoscaling
- **Rationale**: Serverless PostgreSQL with instant branching for development

### ORM: Drizzle
- **Version**: `^0.44.5`
- **Features Used**: Type-safe queries, migrations, relations
- **Rationale**: Lightweight, performant TypeScript ORM

### Database Schema Overview
```
Tables:
├── user                 # User accounts
├── session              # Auth sessions
├── account              # OAuth accounts
├── verification         # Email verification
├── chat                 # Conversation threads
├── message              # Chat messages
├── stream               # Streaming state
├── subscription         # Payment subscriptions
├── payment              # Payment records
├── extreme_search_usage # Usage tracking
├── message_usage        # Rate limiting
├── custom_instructions  # User preferences
├── lookout              # Scheduled searches
├── tool_calls           # Tool execution logs
├── session_states       # Chat state persistence
├── amadeus_tokens       # API token cache
└── user_access_control  # Access management
```

### Caching: Upstash Redis
- **Package**: `@upstash/redis`
- **Features Used**: Session caching, rate limiting, performance cache
- **Rationale**: Serverless Redis with HTTP API

### Queue: Upstash QStash
- **Package**: `@upstash/qstash`
- **Features Used**: Scheduled tasks, background jobs
- **Rationale**: Serverless message queue for lookouts/alerts

---

## Authentication & Authorization

### Auth: Better Auth
- **Package**: `better-auth` + `@dodopayments/better-auth` + `@polar-sh/better-auth`
- **Features Used**: Email/password, OAuth, session management
- **Rationale**: Modern, flexible auth library with payment integrations

### Supported Auth Methods
- Email/Password with verification
- OAuth providers (Google, GitHub, etc.)
- Magic links
- Session-based authentication

### Authorization Model
```typescript
// User roles
type Role = 'user' | 'admin';

// Feature flags
type FeatureFlag = 
  | 'FLIGHT_SEARCH'
  | 'EXTREME_SEARCH'
  | 'MEMORY_COMPANION'
  | 'CONNECTORS';

// Access levels
type AccessLevel = 'basic' | 'pro';
```

---

## Payments & Subscriptions

### Primary: Polar.sh
- **Package**: `@polar-sh/sdk`, `@polar-sh/better-auth`
- **Features**: Subscriptions, webhooks, checkout
- **Regions**: Global (except India)

### Secondary: DodoPayments
- **Package**: `dodopayments`, `@dodopayments/core`, `@dodopayments/better-auth`
- **Features**: One-time payments, Indian market support
- **Regions**: India (UPI, local cards)

### Subscription Tiers
| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic chat, limited searches |
| Pro | $X/mo | Unlimited, connectors, priority |

---

## Search & Data APIs

### Web Search
| Provider | Package | Use Case |
|----------|---------|----------|
| Exa | `exa-js` | AI-powered search |
| Tavily | `@tavily/core` | Fact-checking, research |
| Firecrawl | `@mendable/firecrawl-js` | Web scraping |
| SuperMemory | `supermemory` | Memory storage |

### Travel APIs
| Provider | Use Case |
|----------|----------|
| Seats.aero | Award flight search |
| Amadeus | Flight search, tracking |
| Google Places | Location search, maps |

### Other Data Sources
- YouTube API (video search)
- Reddit API (community content)
- X/Twitter API (social search)
- TMDB (movies/TV)
- CoinGecko (crypto data)
- Alpha Vantage (stock data)

---

## Infrastructure & Deployment

### Hosting: Vercel
- **Features Used**: Edge Functions, Analytics, Speed Insights, Blob Storage, Edge Config
- **Deployment**: Automatic via Git
- **Regions**: Global edge network

### Packages
```json
{
  "@vercel/analytics": "^1.5.0",
  "@vercel/blob": "^2.0.0",
  "@vercel/edge-config": "^1.4.0",
  "@vercel/functions": "^3.1.0",
  "@vercel/speed-insights": "^1.2.0"
}
```

### File Storage: Vercel Blob + AWS S3
- **Vercel Blob**: Temporary uploads, avatars
- **AWS S3**: Document storage, backups

---

## Development Tooling

### Package Manager: pnpm
- **Version**: `10.16.1`
- **Rationale**: Fast, disk-efficient package management

### Build Tools
| Tool | Purpose |
|------|---------|
| Turbopack | Development bundling |
| TypeScript 5 | Type checking |
| ESLint 9 | Code linting |
| Prettier | Code formatting |

### Testing
| Tool | Purpose |
|------|---------|
| tsx | Test runner |
| @testing-library/react | Component testing |
| happy-dom | DOM environment |

### Development Commands
```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm fix          # Format with Prettier
pnpm test         # Run unit tests
pnpm test:watch   # Watch mode
```

---

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=
DIRECT_URL=

# Authentication
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# AI Providers
OPENAI_API_KEY=
XAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Payments
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
DODO_PAYMENTS_API_KEY=

# Search APIs
EXA_API_KEY=
TAVILY_API_KEY=
FIRECRAWL_API_KEY=

# Caching
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# Feature Flags
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=
USE_XAI=
```

---

## Security Considerations

### Data Protection
- All data encrypted in transit (HTTPS)
- Database encryption at rest (Neon)
- Secrets managed via environment variables
- No client-side exposure of API keys

### Authentication Security
- Session-based auth with HTTP-only cookies
- CSRF protection
- Rate limiting on auth endpoints
- Email verification required

### API Security
- Rate limiting per user
- Request validation with Zod
- Sanitized inputs
- Error messages don't leak internals

---

## Monitoring & Observability

### Analytics
- Vercel Analytics (page views, performance)
- Vercel Speed Insights (Core Web Vitals)

### Logging
- Console logging (development)
- Structured logs in production
- Error tracking via console

### Future Considerations
- Sentry for error tracking
- DataDog for APM
- Custom analytics dashboard

---

## Architecture Decisions

### Why Serverless?
- **Scalability**: Auto-scales with demand
- **Cost**: Pay per use, no idle costs
- **DX**: Focus on code, not infrastructure

### Why Next.js App Router?
- **Performance**: Server Components reduce JS bundle
- **SEO**: Server-side rendering
- **DX**: Colocation of data fetching

### Why Drizzle over Prisma?
- **Performance**: Lighter weight, faster queries
- **Type Safety**: Better TypeScript inference
- **Edge Compatible**: Works in serverless edge

### Why Multiple AI Providers?
- **Redundancy**: Fallback if one provider fails
- **Cost Optimization**: Use cheaper models when appropriate
- **Capability**: Different models for different tasks

---

*Last Updated: November 2025*
*Maintained by: Engineering Team*
