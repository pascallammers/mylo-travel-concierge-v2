import 'server-only';

import { generateId } from 'ai';
import { serverEnv } from '@/env/server';
import { searchSeatsAero } from '@/lib/api/seats-aero-client';
import {
  generateAffiliateLink,
  getCheapTickets,
  getLatestPrices,
  type TravelpayoutsCheapTicket,
} from '@/lib/api/travelpayouts-client';
import { computePriceStats, calculateDealScore } from './deal-score';
import { scanPointsDealsForRoute, shouldScanSeatsAero } from './deal-scanner-points';
import {
  getActiveRoutes,
  getPriceHistoryForRoute,
  insertPriceHistory,
  upsertDeal,
  deleteExpiredDeals,
} from '@/lib/db/deal-queries';

const MIN_DEAL_SCORE = 60;
const DEAL_EXPIRY_HOURS = 72;

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

interface PriceHistoryEntry {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  cabinClass: CabinClass;
  source: string;
}

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

  const now = new Date();
  const routes = await getActiveRoutes();
  const shouldScanPointsDeals = Boolean(process.env.SEATSAERO_API_KEY) && shouldScanSeatsAero(now);
  console.log(`[DealScanner] Scanning ${routes.length} routes`);

  for (const route of routes) {
    try {
      await processRoute(route.origin, route.destination, result);

      if (shouldScanPointsDeals && route.destination) {
        const pointsResult = await scanPointsDealsForRoute(
          {
            origin: route.origin,
            destination: route.destination,
          },
          {
            now,
            searchSeatsAero,
            upsertDeal,
            insertPriceHistory,
            generateId,
          },
        );

        result.dealsFound += pointsResult.dealsFound;
        result.priceHistoryEntries += pointsResult.priceHistoryEntries;
        result.errors.push(...pointsResult.errors);
      }

      result.routesScanned++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DealScanner] Error scanning ${route.origin}->${route.destination}:`, msg);
      result.errors.push(`${route.origin}->${route.destination}: ${msg}`);
    }
  }

  result.expiredDealsRemoved = await deleteExpiredDeals();

  console.log(`[DealScanner] Complete:`, result);
  return result;
}

async function processRoute(
  origin: string,
  destination: string | null,
  result: ScanResult,
): Promise<void> {
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

  const tickets: TravelpayoutsCheapTicket[] = Object.values(response.data[destination] ?? {});
  const priceEntries: PriceHistoryEntry[] = tickets.map((ticket) => ({
    origin,
    destination,
    price: ticket.price,
    currency: 'EUR',
    cabinClass: 'economy',
    source: 'travelpayouts',
  }));

  if (priceEntries.length > 0) {
    await insertPriceHistory(priceEntries);
    result.priceHistoryEntries += priceEntries.length;
  }

  const historicalPrices = await getPriceHistoryForRoute(origin, destination, 'economy', 'travelpayouts');
  const stats = computePriceStats(historicalPrices);

  for (const ticket of tickets) {
    let dealScore = 70;
    if (stats && stats.count >= 5) {
      dealScore = calculateDealScore(ticket.price, stats);
    }

    if (dealScore < MIN_DEAL_SCORE) {
      continue;
    }

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
        marker: serverEnv.TRAVELPAYOUTS_MARKER,
        tripClass: 0,
      }),
      source: 'travelpayouts',
      expiresAt,
    });

    result.dealsFound++;
  }
}

function buildStatsCacheKey(origin: string, destination: string, cabinClass: CabinClass): string {
  return `${origin}:${destination}:${cabinClass}`;
}

async function getRouteStats(
  cache: Map<string, ReturnType<typeof computePriceStats>>,
  origin: string,
  destination: string,
  cabinClass: CabinClass,
): Promise<ReturnType<typeof computePriceStats>> {
  const cacheKey = buildStatsCacheKey(origin, destination, cabinClass);

  if (!cache.has(cacheKey)) {
    const historicalPrices = await getPriceHistoryForRoute(origin, destination, cabinClass, 'travelpayouts');
    cache.set(cacheKey, computePriceStats(historicalPrices));
  }

  return cache.get(cacheKey) ?? null;
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

  const priceEntries: PriceHistoryEntry[] = response.data.map((price) => ({
    origin: price.origin,
    destination: price.destination,
    price: price.value,
    currency: 'EUR',
    cabinClass: price.trip_class === 0 ? 'economy' : 'business',
    source: 'travelpayouts',
  }));

  if (priceEntries.length > 0) {
    await insertPriceHistory(priceEntries);
    result.priceHistoryEntries += priceEntries.length;
  }

  const statsCache = new Map<string, ReturnType<typeof computePriceStats>>();

  for (const price of response.data) {
    const cabinClass = (price.trip_class === 0 ? 'economy' : 'business') as 'economy' | 'business';
    const stats = await getRouteStats(statsCache, price.origin, price.destination, cabinClass);

    let dealScore = 70;
    if (stats && stats.count >= 5) {
      dealScore = calculateDealScore(price.value, stats);
    }

    if (dealScore < MIN_DEAL_SCORE) {
      continue;
    }

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
      cabinClass,
      tripType: price.return_date ? 'roundtrip' : 'oneway',
      affiliateLink: generateAffiliateLink({
        origin: price.origin,
        destination: price.destination,
        departDate: price.depart_date,
        returnDate: price.return_date || undefined,
        marker: serverEnv.TRAVELPAYOUTS_MARKER,
        tripClass: cabinClass === 'business' ? 1 : 0,
      }),
      source: 'travelpayouts',
      expiresAt,
    });

    result.dealsFound++;
  }
}
