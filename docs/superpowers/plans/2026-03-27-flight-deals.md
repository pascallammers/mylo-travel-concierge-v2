# Flight Deals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Flight Deals page that scans cheap flights via Travelpayouts API, scores them against historical prices, and displays them with affiliate links and tier-gating.

**Architecture:** Travelpayouts Data API feeds a QStash cron-triggered scanning pipeline that stores deals and price history in PostgreSQL (Drizzle ORM). A Next.js Server Component page at `/[locale]/deals` renders the deal list with filters, tier-gating, and affiliate deep links. Redis caching via Drizzle's built-in Upstash cache handles read performance.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + Neon PostgreSQL, Travelpayouts Data API v1/v2, QStash Cron, Upstash Redis (via Drizzle cache), Resend (Email-Digest), next-intl, shadcn/ui, Tailwind CSS 4

**Design Spec:** `docs/superpowers/specs/2026-03-17-flight-deals-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/api/travelpayouts-client.ts` | Travelpayouts API wrapper (cheap, direct, calendar endpoints) |
| `lib/services/deal-scanner.ts` | Scanning pipeline: fetch routes, query API, compute scores, persist deals |
| `lib/services/deal-score.ts` | AI Deal Score computation (Z-score percentile ranking) |
| `lib/db/deal-queries.ts` | Database queries for deals, price history, routes, preferences |
| `app/api/cron/scan-deals/route.ts` | Cron endpoint for deal scanning (QStash trigger) |
| `app/[locale]/(chat)/deals/page.tsx` | Deals page (Server Component) |
| `app/[locale]/(chat)/deals/components/deal-filters.tsx` | Filter bar component |
| `app/[locale]/(chat)/deals/components/deal-card.tsx` | Individual deal card |
| `app/[locale]/(chat)/deals/components/deal-score-badge.tsx` | Score badge (visual indicator 0-100) |

### Modified Files

| File | Changes |
|------|---------|
| `lib/db/schema.ts` | Add `flightDeals`, `priceHistory`, `dealRoutes`, `userDealPreferences` tables |
| `env/server.ts` | Add `TRAVELPAYOUTS_API_TOKEN` |
| `vercel.json` | Add scan-deals cron schedule |
| `messages/de.json` | Add `deals` translation keys |
| `messages/en.json` | Add `deals` translation keys |
| `components/chat-sidebar/chat-sidebar-header.tsx` | Add Deals navigation link |

---

## Task 1: Database Schema — New Tables

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add `flightDeals` table to schema.ts**

Add after the last table definition in `lib/db/schema.ts`:

```typescript
import { uniqueIndex, index } from 'drizzle-orm/pg-core';

export const flightDeals = pgTable('flight_deals', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  origin: varchar('origin', { length: 3 }).notNull(),
  destination: varchar('destination', { length: 3 }).notNull(),
  destinationName: text('destination_name'),
  departureDate: timestamp('departure_date').notNull(),
  returnDate: timestamp('return_date'),
  price: real('price').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  averagePrice: real('average_price'),
  priceDifference: real('price_difference'),
  priceChangePercent: real('price_change_percent'),
  dealScore: integer('deal_score').notNull().default(0),
  airline: text('airline'),
  stops: integer('stops').default(0),
  flightDuration: integer('flight_duration'),
  cabinClass: text('cabin_class', { enum: ['economy', 'premium_economy', 'business', 'first'] }).notNull().default('economy'),
  tripType: text('trip_type', { enum: ['roundtrip', 'oneway'] }).notNull().default('roundtrip'),
  affiliateLink: text('affiliate_link'),
  categories: json('categories').$type<string[]>().default([]),
  source: text('source').notNull().default('travelpayouts'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('flight_deals_route_date_cabin_uniq').on(table.origin, table.destination, table.departureDate, table.cabinClass),
  index('flight_deals_origin_expires_idx').on(table.origin, table.expiresAt),
  index('flight_deals_score_idx').on(table.dealScore),
]);

export type FlightDeal = InferSelectModel<typeof flightDeals>;
```

- [ ] **Step 2: Add `priceHistory` table**

```typescript
export const priceHistory = pgTable('price_history', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  origin: varchar('origin', { length: 3 }).notNull(),
  destination: varchar('destination', { length: 3 }).notNull(),
  price: real('price').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  cabinClass: text('cabin_class', { enum: ['economy', 'premium_economy', 'business', 'first'] }).notNull().default('economy'),
  source: text('source').notNull().default('travelpayouts'),
  scannedAt: timestamp('scanned_at').notNull().defaultNow(),
}, (table) => [
  index('price_history_route_scanned_idx').on(table.origin, table.destination, table.scannedAt),
]);
```

- [ ] **Step 3: Add `dealRoutes` table**

```typescript
export const dealRoutes = pgTable('deal_routes', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  origin: varchar('origin', { length: 3 }).notNull(),
  destination: varchar('destination', { length: 3 }),
  priority: integer('priority').notNull().default(5),
  source: text('source', { enum: ['basis', 'user-generated'] }).notNull().default('basis'),
  userCount: integer('user_count').notNull().default(0),
  lastScannedAt: timestamp('last_scanned_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('deal_routes_active_priority_idx').on(table.isActive, table.priority),
]);
```

- [ ] **Step 4: Add `userDealPreferences` table**

```typescript
export const userDealPreferences = pgTable('user_deal_preferences', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  originAirports: json('origin_airports').$type<string[]>().default([]),
  preferredDestinations: json('preferred_destinations').$type<string[]>().default([]),
  cabinClass: text('cabin_class', { enum: ['economy', 'premium_economy', 'business', 'first'] }).default('economy'),
  maxPrice: real('max_price'),
  emailDigest: text('email_digest', { enum: ['none', 'weekly', 'daily'] }).notNull().default('none'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type UserDealPreferences = InferSelectModel<typeof userDealPreferences>;
```

- [ ] **Step 5: Generate and apply migration**

Run:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

Expected: New migration file in `drizzle/migrations/` with CREATE TABLE statements for all 4 tables.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(deals): add database schema for flight deals, price history, routes, and preferences"
```

---

## Task 2: Environment Variables — Travelpayouts Token

**Files:**
- Modify: `env/server.ts`

- [ ] **Step 1: Add TRAVELPAYOUTS_API_TOKEN to server env schema**

In `env/server.ts`, add inside the `server: { ... }` object:

```typescript
    // ============================================
    // Travelpayouts (Flight Deals)
    // ============================================
    TRAVELPAYOUTS_API_TOKEN: z.string().min(1).optional(),
```

- [ ] **Step 2: Add token to `.env.local`**

Add to `.env.local`:
```
TRAVELPAYOUTS_API_TOKEN=your_token_here
```

The token is obtained from https://www.travelpayouts.com/programs/100/tools/api

- [ ] **Step 3: Commit**

```bash
git add env/server.ts
git commit -m "feat(deals): add TRAVELPAYOUTS_API_TOKEN env variable"
```

---

## Task 3: Travelpayouts API Client

**Files:**
- Create: `lib/api/travelpayouts-client.ts`

- [ ] **Step 1: Create the API client with types and cheap endpoint**

```typescript
import 'server-only';
import { serverEnv } from '@/env/server';

const BASE_URL = 'https://api.travelpayouts.com';

function getToken(): string {
  const token = serverEnv.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    throw new Error('TRAVELPAYOUTS_API_TOKEN is not configured');
  }
  return token;
}

// --- Types ---

export interface TravelpayoutsCheapTicket {
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  transfers: number;
  expires_at: string;
}

export interface TravelpayoutsCheapResponse {
  success: boolean;
  data: Record<string, Record<string, TravelpayoutsCheapTicket>>;
  currency: string;
}

export interface TravelpayoutsDirectTicket {
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  transfers: number;
  expires_at: string;
}

export interface TravelpayoutsDirectResponse {
  success: boolean;
  data: Record<string, Record<string, TravelpayoutsDirectTicket>>;
  currency: string;
}

export interface TravelpayoutsLatestPrice {
  value: number;
  trip_class: number;
  show_to_affiliates: boolean;
  origin: string;
  destination: string;
  gate: string;
  depart_date: string;
  return_date: string;
  number_of_changes: number;
  found_at: string;
  distance: number;
  actual: boolean;
}

export interface TravelpayoutsLatestResponse {
  success: boolean;
  data: TravelpayoutsLatestPrice[];
  currency: string;
}

// --- API Functions ---

/**
 * Cheapest tickets for a route (cached data, up to 7 days old).
 * If destination is omitted, returns cheapest tickets to all destinations from origin.
 */
export async function getCheapTickets(params: {
  origin: string;
  destination?: string;
  departDate?: string; // YYYY-MM
  returnDate?: string; // YYYY-MM
  currency?: string;
}): Promise<TravelpayoutsCheapResponse> {
  const url = new URL(`${BASE_URL}/v1/prices/cheap`);
  url.searchParams.set('origin', params.origin);
  if (params.destination) url.searchParams.set('destination', params.destination);
  if (params.departDate) url.searchParams.set('depart_date', params.departDate);
  if (params.returnDate) url.searchParams.set('return_date', params.returnDate);
  url.searchParams.set('currency', params.currency || 'eur');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getCheapTickets failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Cheapest direct (non-stop) flights for a route.
 */
export async function getDirectFlights(params: {
  origin: string;
  destination: string;
  departDate?: string;
  returnDate?: string;
  currency?: string;
}): Promise<TravelpayoutsDirectResponse> {
  const url = new URL(`${BASE_URL}/v1/prices/direct`);
  url.searchParams.set('origin', params.origin);
  url.searchParams.set('destination', params.destination);
  if (params.departDate) url.searchParams.set('depart_date', params.departDate);
  if (params.returnDate) url.searchParams.set('return_date', params.returnDate);
  url.searchParams.set('currency', params.currency || 'eur');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getDirectFlights failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Latest prices found by users in the last 48 hours.
 * Great for deal discovery — returns prices across many routes.
 */
export async function getLatestPrices(params: {
  origin: string;
  destination?: string;
  periodType?: 'year' | 'month' | 'season' | 'day';
  beginningOfPeriod?: string; // YYYY-MM-DD
  oneWay?: boolean;
  currency?: string;
  limit?: number;
  page?: number;
}): Promise<TravelpayoutsLatestResponse> {
  const url = new URL(`${BASE_URL}/v2/prices/latest`);
  url.searchParams.set('origin', params.origin);
  if (params.destination) url.searchParams.set('destination', params.destination);
  url.searchParams.set('period_type', params.periodType || 'month');
  if (params.beginningOfPeriod) url.searchParams.set('beginning_of_period', params.beginningOfPeriod);
  if (params.oneWay !== undefined) url.searchParams.set('one_way', String(params.oneWay));
  url.searchParams.set('currency', params.currency || 'eur');
  url.searchParams.set('limit', String(params.limit || 30));
  url.searchParams.set('page', String(params.page || 1));
  url.searchParams.set('show_to_affiliates', 'true');
  url.searchParams.set('sorting', 'price');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getLatestPrices failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate Aviasales affiliate deep link for a flight.
 */
export function generateAffiliateLink(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
}): string {
  const base = 'https://www.aviasales.com/search';
  const parts = [
    params.origin,
    params.departDate.replace(/-/g, '').slice(2), // YYMMDD
    params.destination,
  ];
  if (params.returnDate) {
    parts.push(params.returnDate.replace(/-/g, '').slice(2));
  }
  parts.push(`${params.adults || 1}`);

  return `${base}/${parts.join('')}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/travelpayouts-client.ts
git commit -m "feat(deals): add Travelpayouts API client with cheap, direct, latest endpoints"
```

---

## Task 4: Deal Score Calculator

**Files:**
- Create: `lib/services/deal-score.ts`

- [ ] **Step 1: Implement the percentile-based deal score**

```typescript
import 'server-only';

export interface PriceStats {
  mean: number;
  stddev: number;
  count: number;
  min: number;
  max: number;
}

/**
 * Compute mean and standard deviation from an array of prices.
 */
export function computePriceStats(prices: number[]): PriceStats | null {
  if (prices.length < 2) return null;

  const count = prices.length;
  const mean = prices.reduce((sum, p) => sum + p, 0) / count;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / (count - 1);
  const stddev = Math.sqrt(variance);

  return {
    mean,
    stddev,
    count,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/**
 * Calculate deal score (0-100) using Z-score percentile ranking.
 *
 * Higher score = better deal.
 * Z-Score = (mean - currentPrice) / stddev
 * Score maps the Z-score to a 0-100 percentile.
 *
 * Score > 90: Exceptional deal
 * Score 70-90: Very good deal
 * Score 60-70: Good deal
 * Score < 60: Not shown as deal
 */
export function calculateDealScore(
  currentPrice: number,
  stats: PriceStats,
): number {
  if (stats.stddev === 0) {
    // All historical prices are identical
    return currentPrice < stats.mean ? 80 : 50;
  }

  // Z-score: how many std devs below the mean
  const zScore = (stats.mean - currentPrice) / stats.stddev;

  // Map Z-score to 0-100 using a sigmoid-like curve
  // Z=0 -> 50, Z=1 -> ~73, Z=2 -> ~90, Z=3 -> ~97
  const score = Math.round(50 + 50 * erf(zScore / Math.SQRT2));

  return Math.max(0, Math.min(100, score));
}

/**
 * Error function approximation (Abramowitz and Stegun).
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);

  const t = 1.0 / (1.0 + 0.3275911 * a);
  const y =
    1.0 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);

  return sign * y;
}

/**
 * Determine deal category based on score.
 */
export function getDealCategory(score: number): 'exceptional' | 'very_good' | 'good' | 'normal' {
  if (score >= 90) return 'exceptional';
  if (score >= 70) return 'very_good';
  if (score >= 60) return 'good';
  return 'normal';
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/deal-score.ts
git commit -m "feat(deals): add deal score calculator with Z-score percentile ranking"
```

---

## Task 5: Deal Database Queries

**Files:**
- Create: `lib/db/deal-queries.ts`

- [ ] **Step 1: Create query functions for deals and price history**

```typescript
import 'server-only';

import { and, desc, eq, gte, lte, sql, inArray } from 'drizzle-orm';
import { db } from './index';
import {
  flightDeals,
  priceHistory,
  dealRoutes,
  userDealPreferences,
  type FlightDeal,
  type UserDealPreferences,
} from './schema';

// --- Flight Deals ---

export async function getActiveDeals(params: {
  origin?: string;
  cabinClass?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}): Promise<FlightDeal[]> {
  const conditions = [gte(flightDeals.expiresAt, new Date())];

  if (params.origin) {
    conditions.push(eq(flightDeals.origin, params.origin));
  }
  if (params.cabinClass) {
    conditions.push(eq(flightDeals.cabinClass, params.cabinClass));
  }
  if (params.minScore) {
    conditions.push(gte(flightDeals.dealScore, params.minScore));
  }

  return db
    .select()
    .from(flightDeals)
    .where(and(...conditions))
    .orderBy(desc(flightDeals.dealScore))
    .limit(params.limit || 50)
    .offset(params.offset || 0);
}

export async function upsertDeal(deal: typeof flightDeals.$inferInsert): Promise<void> {
  await db
    .insert(flightDeals)
    .values(deal)
    .onConflictDoUpdate({
      target: [flightDeals.origin, flightDeals.destination, flightDeals.departureDate, flightDeals.cabinClass],
      set: {
        price: deal.price,
        averagePrice: deal.averagePrice,
        priceDifference: deal.priceDifference,
        priceChangePercent: deal.priceChangePercent,
        dealScore: deal.dealScore,
        airline: deal.airline,
        stops: deal.stops,
        affiliateLink: deal.affiliateLink,
        expiresAt: deal.expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function deleteExpiredDeals(): Promise<number> {
  const result = await db
    .delete(flightDeals)
    .where(lte(flightDeals.expiresAt, new Date()));
  return result.rowCount ?? 0;
}

// --- Price History ---

export async function insertPriceHistory(entries: Array<typeof priceHistory.$inferInsert>): Promise<void> {
  if (entries.length === 0) return;
  await db.insert(priceHistory).values(entries);
}

export async function getPriceHistoryForRoute(
  origin: string,
  destination: string,
  cabinClass: string = 'economy',
): Promise<number[]> {
  const rows = await db
    .select({ price: priceHistory.price })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.origin, origin),
        eq(priceHistory.destination, destination),
        eq(priceHistory.cabinClass, cabinClass),
      ),
    )
    .orderBy(desc(priceHistory.scannedAt));

  return rows.map((r) => r.price);
}

// --- Deal Routes ---

export async function getActiveRoutes(): Promise<Array<{ origin: string; destination: string | null; priority: number }>> {
  return db
    .select({
      origin: dealRoutes.origin,
      destination: dealRoutes.destination,
      priority: dealRoutes.priority,
    })
    .from(dealRoutes)
    .where(eq(dealRoutes.isActive, true))
    .orderBy(dealRoutes.priority);
}

export async function updateRouteLastScanned(routeId: string): Promise<void> {
  await db
    .update(dealRoutes)
    .set({ lastScannedAt: new Date() })
    .where(eq(dealRoutes.id, routeId));
}

export async function seedBaseRoutes(routes: Array<{ origin: string; destination: string }>): Promise<void> {
  const values = routes.map((r) => ({
    origin: r.origin,
    destination: r.destination,
    priority: 1,
    source: 'basis' as const,
    isActive: true,
  }));

  // Insert only if not exists (check origin+destination)
  for (const route of values) {
    const existing = await db
      .select({ id: dealRoutes.id })
      .from(dealRoutes)
      .where(and(eq(dealRoutes.origin, route.origin), eq(dealRoutes.destination, route.destination!)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(dealRoutes).values(route);
    }
  }
}

// --- User Deal Preferences ---

export async function getUserDealPreferences(userId: string): Promise<UserDealPreferences | null> {
  const [prefs] = await db
    .select()
    .from(userDealPreferences)
    .where(eq(userDealPreferences.userId, userId))
    .limit(1);

  return prefs || null;
}

export async function upsertUserDealPreferences(
  userId: string,
  prefs: Partial<typeof userDealPreferences.$inferInsert>,
): Promise<void> {
  const existing = await getUserDealPreferences(userId);

  if (existing) {
    await db
      .update(userDealPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(userDealPreferences.userId, userId));
  } else {
    await db.insert(userDealPreferences).values({
      userId,
      ...prefs,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/deal-queries.ts
git commit -m "feat(deals): add database query functions for deals, price history, routes"
```

---

## Task 6: Deal Scanner Service

**Files:**
- Create: `lib/services/deal-scanner.ts`

- [ ] **Step 1: Implement the scanning pipeline**

```typescript
import 'server-only';

import { generateId } from 'ai';
import { getCheapTickets, getLatestPrices, generateAffiliateLink } from '@/lib/api/travelpayouts-client';
import { computePriceStats, calculateDealScore } from './deal-score';
import {
  getActiveRoutes,
  getPriceHistoryForRoute,
  insertPriceHistory,
  upsertDeal,
  deleteExpiredDeals,
} from '@/lib/db/deal-queries';

const MIN_DEAL_SCORE = 60;
const DEAL_EXPIRY_HOURS = 72;

export interface ScanResult {
  routesScanned: number;
  dealsFound: number;
  priceHistoryEntries: number;
  expiredDealsRemoved: number;
  errors: string[];
}

/**
 * Main scanning pipeline.
 * 1. Load active routes
 * 2. For each route, query Travelpayouts
 * 3. Save all prices to priceHistory
 * 4. Compute deal score against historical data
 * 5. Save deals with score >= 60
 * 6. Remove expired deals
 */
export async function runDealScan(): Promise<ScanResult> {
  const result: ScanResult = {
    routesScanned: 0,
    dealsFound: 0,
    priceHistoryEntries: 0,
    expiredDealsRemoved: 0,
    errors: [],
  };

  // 1. Load routes
  const routes = await getActiveRoutes();
  console.log(`[DealScanner] Scanning ${routes.length} routes`);

  // 2. Process each route
  for (const route of routes) {
    try {
      await processRoute(route.origin, route.destination, result);
      result.routesScanned++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DealScanner] Error scanning ${route.origin}->${route.destination}:`, msg);
      result.errors.push(`${route.origin}->${route.destination}: ${msg}`);
    }
  }

  // 6. Clean up expired deals
  result.expiredDealsRemoved = await deleteExpiredDeals();

  console.log(`[DealScanner] Complete:`, result);
  return result;
}

async function processRoute(
  origin: string,
  destination: string | null,
  result: ScanResult,
): Promise<void> {
  // Use /v2/prices/latest for broad discovery (returns multiple destinations)
  // Use /v1/prices/cheap for specific route
  if (destination) {
    await processSpecificRoute(origin, destination, result);
  } else {
    await processOpenRoute(origin, result);
  }
}

async function processSpecificRoute(
  origin: string,
  destination: string,
  result: ScanResult,
): Promise<void> {
  const response = await getCheapTickets({
    origin,
    destination,
    currency: 'eur',
  });

  if (!response.success || !response.data[destination]) return;

  const tickets = response.data[destination];
  const priceEntries: Array<{ origin: string; destination: string; price: number; currency: string; cabinClass: string; source: string }> = [];

  for (const [transferKey, ticket] of Object.entries(tickets)) {
    priceEntries.push({
      origin,
      destination,
      price: ticket.price,
      currency: 'EUR',
      cabinClass: 'economy',
      source: 'travelpayouts',
    });

    // Compute deal score
    const historicalPrices = await getPriceHistoryForRoute(origin, destination);
    const stats = computePriceStats(historicalPrices);

    let dealScore = 70; // Default for routes with no history yet
    if (stats && stats.count >= 5) {
      dealScore = calculateDealScore(ticket.price, stats);
    }

    if (dealScore >= MIN_DEAL_SCORE) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + DEAL_EXPIRY_HOURS);

      await upsertDeal({
        id: generateId(),
        origin,
        destination,
        departureDate: new Date(ticket.departure_at),
        returnDate: ticket.return_at ? new Date(ticket.return_at) : null,
        price: ticket.price,
        currency: 'EUR',
        averagePrice: stats?.mean || null,
        priceDifference: stats ? stats.mean - ticket.price : null,
        priceChangePercent: stats ? ((stats.mean - ticket.price) / stats.mean) * 100 : null,
        dealScore,
        airline: ticket.airline,
        stops: ticket.transfers,
        cabinClass: 'economy',
        tripType: ticket.return_at ? 'roundtrip' : 'oneway',
        affiliateLink: generateAffiliateLink({
          origin,
          destination,
          departDate: ticket.departure_at.split('T')[0],
          returnDate: ticket.return_at?.split('T')[0],
        }),
        source: 'travelpayouts',
        expiresAt,
      });

      result.dealsFound++;
    }
  }

  // Save price history
  if (priceEntries.length > 0) {
    await insertPriceHistory(priceEntries);
    result.priceHistoryEntries += priceEntries.length;
  }
}

async function processOpenRoute(
  origin: string,
  result: ScanResult,
): Promise<void> {
  const response = await getLatestPrices({
    origin,
    currency: 'eur',
    limit: 30,
  });

  if (!response.success) return;

  for (const price of response.data) {
    // Save to price history
    await insertPriceHistory([{
      origin: price.origin,
      destination: price.destination,
      price: price.value,
      currency: 'EUR',
      cabinClass: price.trip_class === 0 ? 'economy' : 'business',
      source: 'travelpayouts',
    }]);
    result.priceHistoryEntries++;

    // Compute deal score
    const historicalPrices = await getPriceHistoryForRoute(price.origin, price.destination);
    const stats = computePriceStats(historicalPrices);

    let dealScore = 70;
    if (stats && stats.count >= 5) {
      dealScore = calculateDealScore(price.value, stats);
    }

    if (dealScore >= MIN_DEAL_SCORE) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + DEAL_EXPIRY_HOURS);

      await upsertDeal({
        id: generateId(),
        origin: price.origin,
        destination: price.destination,
        departureDate: new Date(price.depart_date),
        returnDate: price.return_date ? new Date(price.return_date) : null,
        price: price.value,
        currency: 'EUR',
        averagePrice: stats?.mean || null,
        priceDifference: stats ? stats.mean - price.value : null,
        priceChangePercent: stats ? ((stats.mean - price.value) / stats.mean) * 100 : null,
        dealScore,
        stops: price.number_of_changes,
        cabinClass: price.trip_class === 0 ? 'economy' : 'business',
        tripType: price.return_date ? 'roundtrip' : 'oneway',
        affiliateLink: generateAffiliateLink({
          origin: price.origin,
          destination: price.destination,
          departDate: price.depart_date,
          returnDate: price.return_date || undefined,
        }),
        source: 'travelpayouts',
        expiresAt,
      });

      result.dealsFound++;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/deal-scanner.ts
git commit -m "feat(deals): add deal scanner service with Travelpayouts pipeline"
```

---

## Task 7: Cron Endpoint for Deal Scanning

**Files:**
- Create: `app/api/cron/scan-deals/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runDealScan } from '@/lib/services/deal-scanner';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[DealScan Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[DealScan Cron] Starting scheduled scan...');

  try {
    const result = await runDealScan();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[DealScan Cron] Scan failed:', error);
    return NextResponse.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}

export const maxDuration = 300;
```

- [ ] **Step 2: Add cron schedule to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/scan-deals",
  "schedule": "0 */2 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/scan-deals/route.ts vercel.json
git commit -m "feat(deals): add cron endpoint for deal scanning (every 2h)"
```

---

## Task 8: Seed Base Routes

**Files:**
- Create: `lib/services/seed-deal-routes.ts`

- [ ] **Step 1: Create seed script with popular DACH routes**

```typescript
import 'server-only';

import { seedBaseRoutes } from '@/lib/db/deal-queries';

/**
 * Popular routes from DACH airports to top destinations.
 * This is the initial set; user-generated routes get added dynamically.
 */
const BASE_ROUTES: Array<{ origin: string; destination: string }> = [
  // Frankfurt (FRA)
  { origin: 'FRA', destination: 'BCN' },
  { origin: 'FRA', destination: 'ATH' },
  { origin: 'FRA', destination: 'IST' },
  { origin: 'FRA', destination: 'PMI' },
  { origin: 'FRA', destination: 'LIS' },
  { origin: 'FRA', destination: 'BKK' },
  { origin: 'FRA', destination: 'JFK' },
  { origin: 'FRA', destination: 'DXB' },
  // Munich (MUC)
  { origin: 'MUC', destination: 'BCN' },
  { origin: 'MUC', destination: 'ATH' },
  { origin: 'MUC', destination: 'PMI' },
  { origin: 'MUC', destination: 'FCO' },
  { origin: 'MUC', destination: 'LIS' },
  { origin: 'MUC', destination: 'BKK' },
  // Berlin (BER)
  { origin: 'BER', destination: 'BCN' },
  { origin: 'BER', destination: 'ATH' },
  { origin: 'BER', destination: 'PMI' },
  { origin: 'BER', destination: 'IST' },
  { origin: 'BER', destination: 'LIS' },
  // Duesseldorf (DUS)
  { origin: 'DUS', destination: 'BCN' },
  { origin: 'DUS', destination: 'ATH' },
  { origin: 'DUS', destination: 'PMI' },
  { origin: 'DUS', destination: 'AGP' },
  // Hamburg (HAM)
  { origin: 'HAM', destination: 'BCN' },
  { origin: 'HAM', destination: 'PMI' },
  { origin: 'HAM', destination: 'ATH' },
  // Vienna (VIE)
  { origin: 'VIE', destination: 'BCN' },
  { origin: 'VIE', destination: 'ATH' },
  { origin: 'VIE', destination: 'IST' },
  { origin: 'VIE', destination: 'BKK' },
  // Zurich (ZRH)
  { origin: 'ZRH', destination: 'BCN' },
  { origin: 'ZRH', destination: 'ATH' },
  { origin: 'ZRH', destination: 'LIS' },
  { origin: 'ZRH', destination: 'JFK' },
];

export async function seedDealRoutes(): Promise<number> {
  console.log(`[Seed] Seeding ${BASE_ROUTES.length} base routes...`);
  await seedBaseRoutes(BASE_ROUTES);
  console.log(`[Seed] Done.`);
  return BASE_ROUTES.length;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/seed-deal-routes.ts
git commit -m "feat(deals): add base route seeding for DACH airports"
```

---

## Task 9: i18n Translations

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add German translations for deals section**

Add the `"deals"` key to `messages/de.json`:

```json
"deals": {
  "title": "Flight Deals",
  "subtitle": "Guenstige Fluege ab deinem Flughafen",
  "filters": {
    "origin": "Abflughafen",
    "destination": "Ziel",
    "anywhere": "Ueberall",
    "anytime": "Jederzeit",
    "month": "Monat",
    "cabinClass": "Klasse",
    "economy": "Economy",
    "premiumEconomy": "Premium Economy",
    "business": "Business",
    "first": "First",
    "stops": "Stopps",
    "anyStops": "Beliebig",
    "nonstop": "Direktflug",
    "maxOne": "Max. 1 Stopp",
    "apply": "Anwenden",
    "reset": "Zuruecksetzen"
  },
  "card": {
    "from": "ab",
    "savings": "Ersparnis",
    "avgPrice": "Durchschnittspreis",
    "stops_zero": "Direktflug",
    "stops_one": "1 Stopp",
    "stops_other": "{count} Stopps",
    "roundtrip": "Hin- und Rueckflug",
    "oneway": "Nur Hinflug",
    "book": "Buchen",
    "searchInMylo": "In MYLO suchen",
    "dealScore": "Deal Score",
    "exceptional": "Aussergewoehnlich",
    "veryGood": "Sehr gut",
    "good": "Gut"
  },
  "empty": {
    "title": "Keine Deals gefunden",
    "description": "Aktuell keine Deals fuer deine Filter. Probiere andere Filter oder schau spaeter nochmal vorbei."
  },
  "ad": "Anzeige"
}
```

Additionally, add `"deals": "Flight Deals"` to the existing `"sidebar"` object in `messages/de.json` (alongside `"newChat"` etc.).

- [ ] **Step 2: Add English translations**

Add the `"deals"` key to `messages/en.json`:

```json
"deals": {
  "title": "Flight Deals",
  "subtitle": "Cheap flights from your airport",
  "filters": {
    "origin": "Departure airport",
    "destination": "Destination",
    "anywhere": "Anywhere",
    "anytime": "Anytime",
    "month": "Month",
    "cabinClass": "Class",
    "economy": "Economy",
    "premiumEconomy": "Premium Economy",
    "business": "Business",
    "first": "First",
    "stops": "Stops",
    "anyStops": "Any",
    "nonstop": "Nonstop",
    "maxOne": "Max 1 stop",
    "apply": "Apply",
    "reset": "Reset"
  },
  "card": {
    "from": "from",
    "savings": "Savings",
    "avgPrice": "Average price",
    "stops_zero": "Nonstop",
    "stops_one": "1 stop",
    "stops_other": "{count} stops",
    "roundtrip": "Round trip",
    "oneway": "One way",
    "book": "Book",
    "searchInMylo": "Search in MYLO",
    "dealScore": "Deal Score",
    "exceptional": "Exceptional",
    "veryGood": "Very good",
    "good": "Good"
  },
  "empty": {
    "title": "No deals found",
    "description": "No deals matching your filters right now. Try different filters or check back later."
  },
  "ad": "Ad"
}
```

Additionally, add `"deals": "Flight Deals"` to the existing `"sidebar"` object in `messages/en.json` (alongside `"newChat"` etc.).

- [ ] **Step 3: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "feat(deals): add i18n translations for flight deals page (de/en)"
```

---

## Task 10: Deal Score Badge Component

**Files:**
- Create: `app/[locale]/(chat)/deals/components/deal-score-badge.tsx`

- [ ] **Step 1: Create the score badge component**

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DealScoreBadgeProps {
  score: number;
  className?: string;
}

export function DealScoreBadge({ score, className }: DealScoreBadgeProps) {
  const t = useTranslations('deals.card');

  const category = score >= 90 ? 'exceptional' : score >= 70 ? 'veryGood' : 'good';

  const colorClasses = {
    exceptional: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    veryGood: 'bg-blue-100 text-blue-800 border-blue-200',
    good: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        colorClasses[category],
        className,
      )}
    >
      <span className="tabular-nums">{score}</span>
      <span>{t(category)}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(chat)/deals/components/deal-score-badge.tsx
git commit -m "feat(deals): add deal score badge component"
```

---

## Task 11: Deal Card Component

**Files:**
- Create: `app/[locale]/(chat)/deals/components/deal-card.tsx`

- [ ] **Step 1: Create the deal card component**

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Search, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DealScoreBadge } from './deal-score-badge';
import type { FlightDeal } from '@/lib/db/schema';

interface DealCardProps {
  deal: FlightDeal;
  showScore?: boolean;
  locale: string;
}

export function DealCard({ deal, showScore = false, locale }: DealCardProps) {
  const t = useTranslations('deals');

  const departureDate = new Date(deal.departureDate);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const travelMonth = monthFormatter.format(departureDate);

  const priceFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: deal.currency,
    maximumFractionDigits: 0,
  });

  const stopsLabel =
    deal.stops === 0
      ? t('card.stops_zero')
      : deal.stops === 1
        ? t('card.stops_one')
        : t('card.stops_other', { count: deal.stops });

  return (
    <div className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Route Info */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{deal.origin}</span>
            <Plane className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-lg">
              {deal.destinationName || deal.destination}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{travelMonth}</span>
            <span>·</span>
            <span>{stopsLabel}</span>
            {deal.airline && (
              <>
                <span>·</span>
                <span>{deal.airline}</span>
              </>
            )}
            <span>·</span>
            <span>{deal.tripType === 'roundtrip' ? t('card.roundtrip') : t('card.oneway')}</span>
          </div>
        </div>

        {/* Right: Price */}
        <div className="text-right shrink-0">
          {deal.averagePrice && deal.averagePrice > deal.price && (
            <div className="text-sm text-muted-foreground line-through">
              {priceFormatter.format(deal.averagePrice)}
            </div>
          )}
          <div className="text-2xl font-bold">{priceFormatter.format(deal.price)}</div>
          {deal.priceChangePercent && deal.priceChangePercent > 0 && (
            <div className="text-sm font-medium text-emerald-600">
              -{Math.round(deal.priceChangePercent)}% {t('card.savings')}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Score + Actions */}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          {showScore && <DealScoreBadge score={deal.dealScore} />}
          <span className="text-xs text-muted-foreground">{t('ad')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/${locale}/new?origin=${deal.origin}&destination=${deal.destination}`}>
              <Search className="mr-1.5 size-3.5" />
              {t('card.searchInMylo')}
            </a>
          </Button>
          {deal.affiliateLink && (
            <Button size="sm" asChild>
              <a href={deal.affiliateLink} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink className="mr-1.5 size-3.5" />
                {t('card.book')}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(chat)/deals/components/deal-card.tsx
git commit -m "feat(deals): add deal card component with price, savings, and actions"
```

---

## Task 12: Deal Filters Component

**Files:**
- Create: `app/[locale]/(chat)/deals/components/deal-filters.tsx`

- [ ] **Step 1: Create the filter bar component**

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DACH_AIRPORTS = [
  { code: 'FRA', label: 'Frankfurt (FRA)' },
  { code: 'MUC', label: 'Muenchen (MUC)' },
  { code: 'BER', label: 'Berlin (BER)' },
  { code: 'DUS', label: 'Duesseldorf (DUS)' },
  { code: 'HAM', label: 'Hamburg (HAM)' },
  { code: 'VIE', label: 'Wien (VIE)' },
  { code: 'ZRH', label: 'Zuerich (ZRH)' },
  { code: 'CGN', label: 'Koeln (CGN)' },
  { code: 'STR', label: 'Stuttgart (STR)' },
];

export function DealFilters() {
  const t = useTranslations('deals.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOrigin = searchParams.get('origin') || '';
  const currentStops = searchParams.get('stops') || '';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={currentOrigin || 'all'} onValueChange={(v) => updateFilter('origin', v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('origin')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anywhere')}</SelectItem>
          {DACH_AIRPORTS.map((airport) => (
            <SelectItem key={airport.code} value={airport.code}>
              {airport.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentStops || 'all'} onValueChange={(v) => updateFilter('stops', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('stops')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anyStops')}</SelectItem>
          <SelectItem value="0">{t('nonstop')}</SelectItem>
          <SelectItem value="1">{t('maxOne')}</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={resetFilters}>
        {t('reset')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(chat)/deals/components/deal-filters.tsx
git commit -m "feat(deals): add deal filters component (origin, stops)"
```

---

## Task 13: Deals Page (Server Component)

**Files:**
- Create: `app/[locale]/(chat)/deals/page.tsx`

- [ ] **Step 1: Create the deals page**

```typescript
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getActiveDeals } from '@/lib/db/deal-queries';
import { DealCard } from './components/deal-card';
import { DealFilters } from './components/deal-filters';
import { Plane } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'deals' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const t = await getTranslations({ locale, namespace: 'deals' });

  const origin = filters.origin || undefined;
  const stopsFilter = filters.stops ? parseInt(filters.stops, 10) : undefined;

  const deals = await getActiveDeals({
    origin,
    minScore: 60,
    limit: 50,
  });

  // Client-side stops filter (since DB doesn't have a direct stops filter with max)
  const filteredDeals = stopsFilter !== undefined
    ? deals.filter((d) => (d.stops ?? 0) <= stopsFilter)
    : deals;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <DealFilters />
      </div>

      {/* Deal List */}
      {filteredDeals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Plane className="mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t('empty.description')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              showScore={true}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(chat)/deals/page.tsx
git commit -m "feat(deals): add deals page with filters, deal list, and empty state"
```

---

## Task 14: Sidebar Navigation — Deals Link

**Files:**
- Modify: `components/chat-sidebar/chat-sidebar-header.tsx`

- [ ] **Step 1: Add Deals link to sidebar header**

Add a Deals navigation button below the "New Chat" button in `chat-sidebar-header.tsx`. Import `Plane` from `lucide-react` and add a second `SidebarMenuItem`:

```typescript
// Add to imports:
import { Plus, Plane } from 'lucide-react';

// Add after the existing SidebarMenuItem (New Chat button), inside the SidebarMenu:
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    size="lg"
    className="w-full justify-start gap-2"
    tooltip={t('deals')}
  >
    <Link href="/deals">
      <Plane className="size-4" />
      <span>{t('deals')}</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

Note: Ensure the `deals` translation key exists under the `sidebar` namespace used by this component. If the component uses `useTranslations('sidebar')`, add `"deals": "Flight Deals"` to the `sidebar` section of the translation files.

- [ ] **Step 2: Commit**

```bash
git add components/chat-sidebar/chat-sidebar-header.tsx
git commit -m "feat(deals): add Flight Deals link to sidebar navigation"
```

---

## Task 15: Manual Test — End-to-End Verification

- [ ] **Step 1: Add Travelpayouts token to .env.local**

Ensure `TRAVELPAYOUTS_API_TOKEN` is set in `.env.local`.

- [ ] **Step 2: Run migration**

```bash
pnpm drizzle-kit push
```

- [ ] **Step 3: Seed base routes**

Create a quick API route or run via Node REPL:
```bash
pnpm tsx -e "import { seedDealRoutes } from './lib/services/seed-deal-routes'; seedDealRoutes().then(console.log)"
```

Or add a temporary seed call at the top of the scan-deals cron route (remove after first run).

- [ ] **Step 4: Trigger a manual scan**

```bash
curl -X POST http://localhost:3000/api/cron/scan-deals \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected: JSON response with `success: true`, `routesScanned > 0`, `dealsFound > 0`.

- [ ] **Step 5: Visit the deals page**

Navigate to `http://localhost:3000/de/deals`.

Expected: Deal cards visible with prices, savings, affiliate links, and deal scores.

- [ ] **Step 6: Test filters**

Select an origin airport (e.g. FRA) and verify deals filter correctly.

- [ ] **Step 7: Test affiliate link**

Click "Buchen" on a deal — should open Aviasales in a new tab with correct route.

- [ ] **Step 8: Test sidebar navigation**

Click "Flight Deals" in the sidebar — should navigate to `/deals`.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema (4 tables) | `lib/db/schema.ts` |
| 2 | Environment variable | `env/server.ts` |
| 3 | Travelpayouts API client | `lib/api/travelpayouts-client.ts` |
| 4 | Deal score calculator | `lib/services/deal-score.ts` |
| 5 | Deal database queries | `lib/db/deal-queries.ts` |
| 6 | Deal scanner service | `lib/services/deal-scanner.ts` |
| 7 | Cron endpoint + vercel.json | `app/api/cron/scan-deals/route.ts` |
| 8 | Base route seeding | `lib/services/seed-deal-routes.ts` |
| 9 | i18n translations (de/en) | `messages/de.json`, `messages/en.json` |
| 10 | Deal score badge component | `deals/components/deal-score-badge.tsx` |
| 11 | Deal card component | `deals/components/deal-card.tsx` |
| 12 | Deal filters component | `deals/components/deal-filters.tsx` |
| 13 | Deals page (Server Component) | `deals/page.tsx` |
| 14 | Sidebar navigation | `chat-sidebar-header.tsx` |
| 15 | End-to-end manual test | — |

---

## Deferred to Phase 2

The following features from the design spec are intentionally out of scope for this plan:

| Feature | Design Spec Section | Reason |
|---------|-------------------|--------|
| **Email Digest** (weekly/daily) | Section 6 | Requires Resend email templates, user filtering logic, separate cron job |
| **Tier-Gating** | Section 5 | Requires 3-tier subscription system (not yet built). Phase 1 shows all deals to logged-in users |
| **Category Tags** (auto-assignment) | Section 4 | Schema field exists but no assignment logic. Needs destination metadata |
| **Click-Through-Rate tracking** | Section 7 | Track affiliate link clicks per deal |
| **Error Fare Detection** | Research doc | Needs 6+ months of price history data for reliable anomaly detection |
| **User-generated routes** | Design Spec | Auto-add routes based on user preferences |
| **"In Mylo suchen" deep link** | Section 4 | Pre-fill chat with route — needs chat URL parameter support |
