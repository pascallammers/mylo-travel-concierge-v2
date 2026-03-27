import 'server-only';

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from './index';
import {
  flightDeals,
  priceHistory,
  dealRoutes,
  userDealPreferences,
  user,
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
    conditions.push(eq(flightDeals.cabinClass, params.cabinClass as 'economy' | 'premium_economy' | 'business' | 'first'));
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
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first' = 'economy',
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
  for (const route of routes) {
    const existing = await db
      .select({ id: dealRoutes.id })
      .from(dealRoutes)
      .where(and(eq(dealRoutes.origin, route.origin), eq(dealRoutes.destination, route.destination)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(dealRoutes).values({
        origin: route.origin,
        destination: route.destination,
        priority: 1,
        source: 'basis',
        isActive: true,
      });
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
