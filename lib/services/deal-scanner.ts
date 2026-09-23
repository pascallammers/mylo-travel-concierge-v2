import 'server-only';

import { generateId } from 'ai';
import { serverEnv } from '@/env/server';
import { searchSeatsAero, getLastSeatsAeroQuota } from '@/lib/api/seats-aero-client';
import { searchDuffel } from '@/lib/api/duffel-client';
import {
  generateAffiliateLink,
  getCheapTickets,
  getLatestPrices,
  type TravelpayoutsCheapTicket,
} from '@/lib/api/travelpayouts-client';
import { computePriceStats, calculateDealScore } from './deal-score';
import { runDealScanWithDependencies, type PointsScanDeps, type ScanResult } from './deal-scanner-run';
import { fetchEurRates } from './eur-rates';
import { DACH_SOURCE_PROGRAM_IDS } from '@/lib/config/transfer-engine';
import { loadAwardProgramSourceResolver } from '@/lib/transfer-table/award-sources';
import { readDachPartnerMaps } from '@/lib/transfer-table/runtime';
import { readValuationTable } from '@/lib/valuation/runtime';
import { getAirportDetails } from '@/lib/utils/airport-database';
import {
  getActiveRoutes,
  getCashReference,
  getPriceHistoryForRoute,
  insertPriceHistory,
  upsertDeal,
  deleteExpiredDeals,
  deleteStaleDealsForRoute,
} from '@/lib/db/deal-queries';

const MIN_DEAL_SCORE = 60;
const DEAL_EXPIRY_HOURS = 72;

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

/**
 * Load the scan-wide valuation inputs once: FX rates, the valuation table,
 * and the DACH transfer-source resolver.
 *
 * @returns Dependencies shared by every route's points scan.
 */
async function loadPointsScanDeps(): Promise<PointsScanDeps> {
  const [eurRates, valuation, sourceResolver] = await Promise.all([
    fetchEurRates(fetch),
    readValuationTable(),
    loadAwardProgramSourceResolver(readDachPartnerMaps),
  ]);

  return {
    eurRates,
    valuation,
    isReachableDach: (slug) =>
      sourceResolver(slug).some((source) =>
        DACH_SOURCE_PROGRAM_IDS.has(source.sourceProgramId),
      ),
    getCashReference,
    resolveDestinationName: async (code) =>
      (await getAirportDetails(code))?.airport ?? null,
  };
}

interface PriceHistoryEntry {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  cabinClass: CabinClass;
  source: string;
}

export type { ScanResult } from './deal-scanner-run';

/**
 * Run the scheduled cash and award scans with production dependencies.
 * @returns Counts, errors, and the final known award budget.
 */
export async function runDealScan(): Promise<ScanResult> {
  return runDealScanWithDependencies({
    now: new Date(),
    pointsEnabled: Boolean(process.env.SEATSAERO_API_KEY),
    getActiveRoutes,
    loadPointsScanDeps,
    processCashRoute: processRoute,
    searchSeatsAero,
    getSeatsAeroQuota: getLastSeatsAeroQuota,
    searchDuffel,
    insertPriceHistory,
    upsertDeal,
    generateId,
    deleteStaleDealsForRoute,
    deleteExpiredDeals,
  });
}

async function processRoute(
  origin: string,
  destination: string | null,
  result: ScanResult,
  runStartedAt: Date,
): Promise<void> {
  if (destination) {
    await processSpecificRoute(origin, destination, result, runStartedAt);
  } else {
    await processOpenRoute(origin, result);
  }
}

async function processSpecificRoute(
  origin: string,
  destination: string,
  result: ScanResult,
  runStartedAt: Date,
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

  result.staleDealsRemoved += await deleteStaleDealsForRoute({
    origin,
    destination,
    source: 'travelpayouts',
    notSeenSince: runStartedAt,
  });
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
