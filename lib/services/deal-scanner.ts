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

  const routes = await getActiveRoutes();
  console.log(`[DealScanner] Scanning ${routes.length} routes`);

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

    const historicalPrices = await getPriceHistoryForRoute(origin, destination);
    const stats = computePriceStats(historicalPrices);

    let dealScore = 70;
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
    await insertPriceHistory([{
      origin: price.origin,
      destination: price.destination,
      price: price.value,
      currency: 'EUR',
      cabinClass: price.trip_class === 0 ? 'economy' : 'business',
      source: 'travelpayouts',
    }]);
    result.priceHistoryEntries++;

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
