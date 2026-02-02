# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- TypeScript 5+ - Full application codebase (frontend, backend, utilities)
- JavaScript - Configuration files and dynamic imports

**Secondary:**
- SQL - Database migrations and queries
- YAML - Docker Compose configuration

## Runtime

**Environment:**
- Node.js 22 (Alpine Linux based per Dockerfile)

**Package Manager:**
- pnpm 10.16.1
- Lockfile: `pnpm-lock.yaml`

## Frameworks

**Core:**
- Next.js 15.5.9 - Full-stack React framework with App Router
- React 19.2.3 - UI component library

**UI/Design:**
- Radix UI - Headless component library (multiple packages: accordion, dialog, dropdown-menu, etc.)
- Tailwind CSS 4.1.13 - Utility-first CSS framework
- Framer Motion 12.23.21 - Animation library
- Embla Carousel 8.6.0 - Carousel component

**AI & LLM:**
- Vercel AI SDK (ai 5.0.51) - Core LLM orchestration
- @ai-sdk/anthropic 2.0.18 - Claude/Anthropic integration
- @ai-sdk/openai 2.0.34 - OpenAI integration
- @ai-sdk/xai 2.0.22 - X.AI integration
- @ai-sdk/google 2.0.16 - Google Gemini integration
- @ai-sdk/groq 2.0.21 - Groq integration
- @ai-sdk/mistral 2.0.16 - Mistral integration
- @ai-sdk/elevenlabs 1.0.11 - ElevenLabs text-to-speech
- @ai-sdk/react 2.0.51 - React hooks for AI SDK

**Database:**
- Drizzle ORM 0.44.5 - Type-safe SQL query builder
- Drizzle Kit 0.31.4 - Database migrations and schema tools
- @neondatabase/serverless 1.0.1 - Neon PostgreSQL driver
- postgres 3.4.7 - PostgreSQL client library
- drizzle-orm/cache/upstash - Upstash Redis caching integration

**Authentication:**
- Better Auth 8e825ad (GitHub PR version) - Authentication framework
- bcryptjs 3.0.3 - Password hashing
- @polar-sh/better-auth 1.1.4 - Polar payments auth plugin
- @dodopayments/better-auth 1.1.3 - DodoPayments auth plugin

**Payment Processing:**
- @polar-sh/sdk 0.35.2 - Polar subscription management
- dodopayments 2.1.0 - DodoPayments integration
- @dodopayments/core 0.1.16 - DodoPayments core

**Data Fetching & Caching:**
- @tanstack/react-query 5.90.2 - Client-side data fetching and caching
- @upstash/redis 1.35.4 - Upstash Redis client
- @upstash/qstash 2.8.3 - Upstash QStash task queue
- redis 5.8.2 - Redis client library

**Travel/Flight APIs:**
- @duffel/api 4.21.2 - Duffel flight search SDK
- @daytonaio/sdk 0.103.0 - Daytona sandbox/dev environment SDK

**Web Scraping & Search:**
- @mendable/firecrawl-js 4.3.5 - FireCrawl web scraping
- @tavily/core 0.5.12 - Tavily search API
- exa-js 1.9.3 - Exa search engine
- @supermemory/tools 1.0.4 - Supermemory knowledge integration

**Email:**
- resend 6.0.3 - Resend email service

**Cloud Storage:**
- @aws-sdk/client-s3 3.884.0 - AWS S3
- @aws-sdk/lib-storage 3.884.0 - AWS S3 multipart upload
- @vercel/blob 2.0.0 - Vercel Blob storage

**Content & Markdown:**
- react-markdown 10.1.0 - Markdown React component
- marked-react 3.0.1 - Marked markdown parser
- remark-gfm 4.0.1 - GitHub Flavored Markdown support
- remark-math 6.0.0 - Math expression support
- rehype-katex 7.0.1 - KaTeX rendering
- react-katex 3.1.0 - React KaTeX component
- highlight.js 11.11.1 - Code syntax highlighting
- sugar-high 0.9.3 - Lightweight syntax highlighter
- prismjs 1.30.0 - Prism syntax highlighting

**Charts & Data Visualization:**
- echarts 5.6.0 - Apache ECharts visualization
- echarts-for-react 3.0.2 - React wrapper for ECharts
- recharts 2.15.3 - React charting library
- leaflet 1.9.4 - Map library

**Utilities:**
- date-fns 4.1.0 - Date utility library
- luxon 3.7.1 - Date/time library
- zod 3.25.76 - TypeScript-first schema validation
- react-hook-form 7.61.1 - React form management
- @hookform/resolvers 5.2.1 - Form validation resolvers
- uuid 11.1.0 - UUID generation
- axios 1.12.2 - HTTP client
- dotenv 16.5.0 - Environment variable loading
- yaml 2.8.1 - YAML parser
- clsx 2.1.1 - Conditional CSS classnames
- tailwind-merge 3.3.1 - Tailwind CSS utilities merger

**Special Purpose:**
- agentation 1.1.0 - Agent framework integration (development mode)
- canvas-confetti 1.9.3 - Confetti animation
- supermemory 3.0.0-alpha.26 - Knowledge/memory integration
- valyu-js 2.1.0 - Valyu API client
- vaul 1.1.2 - Drawer component
- sonner 2.0.7 - Toast notifications
- @react-email/components 0.5.3 - Email component library
- youtube-caption-extractor 1.9.1 - YouTube caption extraction

**Testing & Quality:**
- tsx 4.20.6 - TypeScript test runner
- @testing-library/react 16.3.0 - React component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- happy-dom 20.0.10 - Lightweight DOM implementation

**Build & Development:**
- @tailwindcss/postcss 4.1.13 - PostCSS Tailwind plugin
- postcss >= 8.5.5 - CSS transformation
- eslint 9.39.1 - JavaScript linter
- @typescript-eslint/eslint-plugin 8.46.4 - TypeScript ESLint rules
- @typescript-eslint/parser 8.46.4 - TypeScript parser for ESLint
- prettier 3.6.2 - Code formatter
- knip - Unused dependency detector
- jiti 2.6.0 - Dynamic import loader
- @t3-oss/env-nextjs 0.13.8 - Environment variable validation

**Edge/Vercel:**
- @vercel/analytics 1.5.0 - Vercel web analytics
- @vercel/speed-insights 1.2.0 - Vercel speed metrics
- @vercel/edge-config 1.4.0 - Vercel edge configuration
- @vercel/functions 3.1.0 - Vercel Functions

**Observability:**
- agentation 1.1.0 - Development mode agent framework

## Configuration

**Environment:**
- Configuration via `.env.local` file
- Environment validation using `@t3-oss/env-nextjs` with Zod schemas in `env/server.ts` and `env/client.ts`
- Server-side vars in `env/server.ts`
- Public vars in `env/client.ts` (NEXT_PUBLIC_* only)

**Build:**
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript compiler options
- `.eslintrc.json` - ESLint configuration (extends next/core-web-vitals)
- `.prettierrc` - Prettier formatting rules (semi: true, singleQuote: true, trailingComma: all, printWidth: 120)
- `drizzle.config.ts` - Database migration configuration
- `postcss.config.mjs` - PostCSS configuration

## Platform Requirements

**Development:**
- Node.js 22 (Alpine Linux)
- pnpm 10.16.1 package manager
- PostgreSQL database (Neon)
- Redis instance (Upstash)

**Production:**
- Docker containerized deployment (see `Dockerfile`)
- Node.js 22 Alpine runtime
- Environment variables from Vercel/deployment platform
- Standalone Next.js build output
- Runs on port 3000 as non-root user (nextjs:1001)

**Deployment:**
- Vercel (inferred from `vercel.json` and analytics/speed-insights packages)
- Docker deployment option available
- cron jobs via `vercel.json` (`/api/clean_images` hourly, `/api/cron/awardwallet-sync` every 6 hours)

---

*Stack analysis: 2026-02-02*
