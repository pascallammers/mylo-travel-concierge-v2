# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**AI Model Providers:**
- OpenAI - LLM via @ai-sdk/openai
  - SDK/Client: @ai-sdk/openai 2.0.34
  - Auth: OPENAI_API_KEY env var

- X.AI (XAI) - LLM via @ai-sdk/xai (currently selected as primary)
  - SDK/Client: @ai-sdk/xai 2.0.22
  - Auth: XAI_API_KEY env var
  - Config: USE_XAI=true flag in env/server.ts

- Anthropic Claude - LLM via @ai-sdk/anthropic
  - SDK/Client: @ai-sdk/anthropic 2.0.18
  - Auth: ANTHROPIC_API_KEY env var

- Google Gemini - LLM via @ai-sdk/google
  - SDK/Client: @ai-sdk/google 2.0.16, @google/genai 1.30.0
  - Auth: GOOGLE_GENERATIVE_AI_API_KEY env var

- Groq - LLM via @ai-sdk/groq
  - SDK/Client: @ai-sdk/groq 2.0.21
  - Auth: GROQ_API_KEY env var

- Mistral - LLM via @ai-sdk/mistral
  - SDK/Client: @ai-sdk/mistral 2.0.16
  - Auth: Not visible in env schema (check deployment)

**Audio & Speech:**
- ElevenLabs - Text-to-speech
  - SDK/Client: @ai-sdk/elevenlabs 1.0.11
  - Auth: ELEVENLABS_API_KEY env var

**Travel & Flight Data:**
- Amadeus - Flight and travel API
  - Implementation: `lib/api/amadeus-client.ts`
  - Base URL: test.api.amadeus.com (test) or api.amadeus.com (prod)
  - Auth: AMADEUS_API_KEY, AMADEUS_API_SECRET env vars
  - Token management: `lib/api/amadeus-token.ts` with automatic token refresh
  - Features: Flight offer search with retry logic

- Duffel - Flight search API
  - SDK/Client: @duffel/api 4.21.2
  - Implementation: `lib/api/duffel-client.ts`
  - Auth: DUFFEL_API_KEY env var (optional for backwards compatibility)
  - Features: Alternative flight search provider

- SeatSaero - Seat availability tracking
  - Implementation: `lib/api/seats-aero-client.ts`
  - Auth: SEATSAERO_API_KEY env var
  - Features: Seat tracking and availability monitoring

- AwardWallet - Frequent flyer account management
  - Implementation: `lib/api/awardwallet-client.ts`
  - Auth: AWARDWALLET_API_KEY env var
  - Features: OAuth integration and account synchronization
  - Callback: AWARDWALLET_CALLBACK_URL env var
  - Proxy: AWARDWALLET_PROXY_URL env var (optional)
  - Cron sync: Scheduled every 6 hours via vercel.json

**Web Search & Scraping:**
- Tavily - Web search API
  - SDK/Client: @tavily/core 0.5.12
  - Auth: TAVILY_API_KEY env var

- Exa - AI-powered search
  - SDK/Client: exa-js 1.9.3
  - Auth: EXA_API_KEY env var

- FireCrawl - Web scraping/crawling
  - SDK/Client: @mendable/firecrawl-js 4.3.5
  - Auth: FIRECRAWL_API_KEY env var

**Maps & Location:**
- Google Maps - Maps and location services
  - SDK/Client: @google/generative-ai 0.24.1 (geo context)
  - Auth: GOOGLE_MAPS_API_KEY (server), NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (client)
  - Features: Map display, geocoding, street view integration

- Mapbox - Alternative maps provider
  - Auth: MAPBOX_ACCESS_TOKEN, NEXT_PUBLIC_MAPBOX_TOKEN env vars
  - Usage: Map tiles and geographic data

- TripAdvisor - Travel information
  - Auth: TRIPADVISOR_API_KEY env var

**Weather & Aviation:**
- OpenWeather - Weather data
  - Auth: OPENWEATHER_API_KEY env var

- Aviation Stack - Flight data
  - Auth: AVIATION_STACK_API_KEY env var

**Media & Entertainment:**
- The Movie Database (TMDB) - Movie/entertainment data
  - Auth: TMDB_API_KEY env var
  - Features: Movie/show metadata and imagery

- YouTube - Video metadata
  - Auth: YT_ENDPOINT env var
  - Features: Caption extraction via youtube-caption-extractor

**Other APIs:**
- Valyu - Financial/value data
  - SDK/Client: valyu-js 2.1.0
  - Auth: VALYU_API_KEY env var

- CoinGecko - Cryptocurrency data
  - Auth: COINGECKO_API_KEY env var

- Parallel Networks - Additional data provider
  - Auth: PARALLEL_API_KEY env var

## Data Storage

**Databases:**
- PostgreSQL (Neon) - Primary database
  - Connection: DATABASE_URL env var pointing to neon.aws.neon.tech
  - Client: @neondatabase/serverless (neon HTTP driver)
  - ORM: Drizzle ORM 0.44.5
  - Schema: `lib/db/schema.ts`
  - Migrations: Stored in `drizzle/migrations/` directory
  - Replica read support: Via drizzle-orm/pg-core withReplicas()

**Caching:**
- Upstash Redis - Distributed cache and task queue
  - REST Client: @upstash/redis 1.35.4
  - QStash: @upstash/qstash 2.8.3
  - Auth: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN env vars
  - Drizzle Integration: upstashCache() with 10-minute default TTL (ex: 600)
  - Standard Redis: redis 5.8.2 package for optional direct connections
  - Redis URL: REDIS_URL env var

**File Storage:**
- AWS S3 - Object storage
  - SDK: @aws-sdk/client-s3, @aws-sdk/lib-storage
  - Auth: AWS credentials from environment (implicit)
  - Features: Multipart upload support via lib-storage

- Vercel Blob - Vercel-managed file storage
  - SDK: @vercel/blob 2.0.0
  - Auth: BLOB_READ_WRITE_TOKEN env var
  - Features: Serverless file storage

## Authentication & Identity

**Auth Provider:**
- Better Auth - Custom authentication framework
  - Implementation: `lib/auth.ts`
  - Config: Drizzle adapter with PostgreSQL provider
  - Rate limiting: 50 requests per 60 seconds
  - Cookie caching: Enabled with 5-minute max age
  - Features: Email/password, session management, verification
  - Password hashing: bcryptjs (custom hash/verify functions)

**OAuth Providers:**
- GitHub
  - Auth: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET env vars

- Google
  - Auth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET env vars

- Twitter/X
  - Auth: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET env vars

**Database Tables (Better Auth via Drizzle):**
- `user` - User accounts
- `session` - Session management
- `account` - OAuth account links
- `verification` - Email verification tokens (also used for password reset)
- Custom tables: `chat`, `message`, `customInstructions`, `stream`

**Secret Management:**
- Auth secret: BETTER_AUTH_SECRET env var
- Webhook secrets: POLAR_WEBHOOK_SECRET, DODO_PAYMENTS_WEBHOOK_SECRET

## Payment & Subscription

**Polar - Primary subscription provider:**
- SDK: @polar-sh/sdk 0.35.2
- Auth Plugin: @polar-sh/better-auth 1.1.4
- Features: Subscription management, customer portal, webhooks
- Client initialization: `lib/auth.ts` (Polar constructor)
- Sandbox mode: Enabled in development (NODE_ENV !== 'production')
- Webhook endpoint: Integrated via better-auth plugins
- Webhook secret: POLAR_WEBHOOK_SECRET env var
- Product IDs: NEXT_PUBLIC_STARTER_TIER env var
- Success URL: `/success` route

**DodoPayments - Secondary payment provider:**
- SDK: dodopayments 2.1.0
- Auth Plugin: @dodopayments/better-auth 1.1.3
- Features: Checkout, customer portal, payment webhooks
- Client initialization: `lib/auth.ts` (DodoPayments constructor)
- Environment: test_mode (dev) or live_mode (prod)
- Webhook secret: DODO_PAYMENTS_WEBHOOK_SECRET env var
- Product IDs: NEXT_PUBLIC_PREMIUM_TIER env var
- Success URL: `/success` route
- Database tables: `subscription` and `payment` (via better-auth schema)

**Database Tables (Payments):**
- `subscription` - Active subscriptions from Polar
- `payment` - Payment records from DodoPayments
- Fields tracked: status, amount, currency, customer info, metadata

## Monitoring & Observability

**Error Tracking:**
- None detected - not using Sentry or similar

**Logs:**
- Console logging throughout codebase
- Production: Logs output to console (console.log filtered in production)
- Development: Full console logging enabled

**Analytics:**
- Vercel Analytics: @vercel/analytics 1.5.0
- Vercel Speed Insights: @vercel/speed-insights 1.2.0

**PostHog (Analytics Client):**
- Public key: NEXT_PUBLIC_POSTHOG_KEY env var
- Host: NEXT_PUBLIC_POSTHOG_HOST env var
- (Configuration present but implementation not verified in explored files)

## CI/CD & Deployment

**Hosting:**
- Vercel - Primary deployment platform
  - Configuration: `vercel.json`
  - Analytics & Speed Insights packages integrated
  - Edge config: @vercel/edge-config 1.4.0
  - Functions: @vercel/functions 3.1.0

**Build System:**
- Next.js with Turbopack enabled (next dev --turbopack, next build --turbopack)
- Standalone output mode for Docker deployments
- Preview deployments supported (via wildcard origin in auth)

**Cron Jobs (Vercel):**
- `GET /api/clean_images` - Scheduled hourly (0 * * * *)
- `GET /api/cron/awardwallet-sync` - Scheduled every 6 hours (0 */6 * * *)

**Database Migrations:**
- Drizzle Kit for schema management
- Config: `drizzle.config.ts`
- Migrations folder: `drizzle/migrations/`
- Environment: Uses DATABASE_URL from env

## Environment Configuration

**Required server env vars (validated via Zod in env/server.ts):**
```
# AI Providers
XAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
USE_XAI (boolean flag for primary provider)

# Database & Cache
DATABASE_URL, REDIS_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

# Auth
BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET, TWITTER_CLIENT_ID/SECRET

# Travel APIs
AMADEUS_API_KEY, AMADEUS_API_SECRET, AMADEUS_ENV, DUFFEL_API_KEY (optional)

# Search & Web APIs
TAVILY_API_KEY, EXA_API_KEY, FIRECRAWL_API_KEY

# Maps & Location
GOOGLE_MAPS_API_KEY, MAPBOX_ACCESS_TOKEN, TRIPADVISOR_API_KEY

# Other Services
ELEVENLABS_API_KEY, TMDB_API_KEY, YT_ENDPOINT, OPENWEATHER_API_KEY
VALYU_API_KEY, COINGECKO_API_KEY, PARALLEL_API_KEY

# Storage & Files
BLOB_READ_WRITE_TOKEN

# Payments
POLAR_WEBHOOK_SECRET, DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_SECRET
NEXT_PUBLIC_PREMIUM_TIER, NEXT_PUBLIC_PREMIUM_SLUG, NEXT_PUBLIC_STARTER_TIER, NEXT_PUBLIC_STARTER_SLUG

# Email
RESEND_API_KEY

# Cron & Security
CRON_SECRET, WEBHOOK_SECRET, QSTASH_TOKEN

# AwardWallet
AWARDWALLET_API_KEY, AWARDWALLET_CALLBACK_URL (optional), AWARDWALLET_PROXY_URL (optional)

# Other
SMITHERY_API_KEY, DAYTONA_API_KEY, SUPERMEMORY_API_KEY, ALLOWED_ORIGINS (optional)
```

**Required client env vars (validated in env/client.ts):**
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY - Maps display on client
```

**Optional public vars:**
```
NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_APP_URL
```

## Webhooks & Callbacks

**Incoming Webhooks:**
- Polar subscription webhooks
  - Endpoint: Via Better Auth plugin integration
  - Events: subscription.created, subscription.active, subscription.canceled, subscription.revoked, subscription.uncanceled, subscription.updated
  - Processing: `lib/auth.ts` (lines 337-456)
  - Side effects: Cache invalidation on user subscription changes

- DodoPayments payment webhooks
  - Endpoint: Via Better Auth plugin integration
  - Events: payment.succeeded, payment.failed, payment.cancelled, payment.processing
  - Processing: `lib/auth.ts` (lines 158-270)
  - Side effects: Payment record upsert, cache invalidation

- AwardWallet OAuth callback
  - Endpoint: AWARDWALLET_CALLBACK_URL (Supabase function)
  - Purpose: OAuth callback handling for account linking

- Zapier webhook (incoming)
  - URL: WEBHOOK_URL_ZAPIER = https://xtafjkbijtobputmulwy.supabase.co/functions/v1/thrivecard-webhook
  - Purpose: Inbound automation from external sources

**Outgoing Webhooks:**
- None currently configured (webhook infrastructure in place but not actively used)

## Security Headers

**Configured via Next.js (next.config.ts):**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin

**Trusted Origins (CORS):**
- http://localhost:3000
- https://mylo-travel-concierge-v2.vercel.app
- https://mylo-travel-concierge-v2-*.vercel.app (preview deployments)

---

*Integration audit: 2026-02-02*
