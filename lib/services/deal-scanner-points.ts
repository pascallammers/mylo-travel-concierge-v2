import type { SeatsAeroFlight, SeatsAeroSearchParams } from '@/lib/api/seats-aero-client';

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

interface PriceHistoryEntry {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  cabinClass: CabinClass;
  source: string;
}

interface PointDealUpsertInput {
  id: string;
  origin: string;
  destination: string;
  destinationName?: string | null;
  departureDate: Date;
  returnDate: Date | null;
  price: number;
  currency: string;
  averagePrice: number | null;
  priceDifference: number | null;
  priceChangePercent: number | null;
  dealScore: number;
  airline: string | null;
  stops: number | null;
  flightDuration?: number | null;
  cabinClass: CabinClass;
  tripType: 'roundtrip' | 'oneway';
  affiliateLink: string | null;
  source: string;
  expiresAt: Date;
}

interface ScanPointsRouteInput {
  origin: string;
  destination: string;
}

interface ScanPointsDependencies {
  searchSeatsAero: (params: SeatsAeroSearchParams) => Promise<SeatsAeroFlight[]>;
  upsertDeal: (deal: PointDealUpsertInput) => Promise<void>;
  insertPriceHistory: (entries: PriceHistoryEntry[]) => Promise<void>;
  generateId: () => string;
  now: Date;
  monthsAhead?: number;
}

export interface PointsScanResult {
  dealsFound: number;
  priceHistoryEntries: number;
  errors: string[];
}

const POINTS_SOURCE = 'seats_aero';

/**
 * Determine if the points scan should run in the current cron window.
 *
 * @param now - Current time used by the scheduler.
 * @returns True when the 6-hour scan window is active.
 */
export function shouldScanSeatsAero(now: Date): boolean {
  return now.getUTCHours() % 6 === 0;
}

/**
 * Build the monthly scan dates for award inventory.
 *
 * @param now - Current timestamp of the scan.
 * @param monthsAhead - Number of future months to probe.
 * @returns ISO dates at the first day of each target month.
 */
export function buildPointsScanDepartureDates(now: Date, monthsAhead = 3): string[] {
  return Array.from({ length: monthsAhead }, (_, index) => {
    const scanDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index + 1, 1));
    return scanDate.toISOString().slice(0, 10);
  });
}

/**
 * Calculate a heuristic score for an award deal.
 *
 * @param input - Award-flight properties relevant for value scoring.
 * @returns Score on the same 0-100 scale used by cash deals.
 */
export function calculatePointsDealScore(input: {
  miles: number | null;
  cabinClass: CabinClass;
  stops: number;
  taxesAmount: number | null;
  seatsLeft: number | null;
}): number {
  let score =
    input.cabinClass === 'first'
      ? 88
      : input.cabinClass === 'business'
        ? 82
        : input.cabinClass === 'premium_economy'
          ? 74
          : 68;

  if (input.miles !== null) {
    if (input.miles <= 50000) score += 8;
    else if (input.miles <= 70000) score += 4;
    else if (input.miles >= 95000) score -= 6;
  }

  if (input.stops === 0) score += 4;
  else if (input.stops >= 2) score -= 4;

  if (input.taxesAmount !== null) {
    if (input.taxesAmount <= 100) score += 4;
    else if (input.taxesAmount <= 200) score += 2;
    else if (input.taxesAmount >= 300) score -= 4;
  }

  if (input.seatsLeft !== null && input.seatsLeft >= 2) {
    score += 2;
  }

  return clampScore(score);
}

/**
 * Scan award availability for a single route and persist the best result per month.
 *
 * @param route - Origin/destination pair from the route table.
 * @param deps - Injected dependencies for search and persistence.
 * @returns Summary with created deal/history counts and recoverable errors.
 */
export async function scanPointsDealsForRoute(
  route: ScanPointsRouteInput,
  deps: ScanPointsDependencies,
): Promise<PointsScanResult> {
  const dates = buildPointsScanDepartureDates(deps.now, deps.monthsAhead ?? 3);
  const dealsToUpsert: PointDealUpsertInput[] = [];
  const historyEntries: PriceHistoryEntry[] = [];
  const errors: string[] = [];

  for (const departureDate of dates) {
    try {
      const results = await deps.searchSeatsAero({
        origin: route.origin,
        destination: route.destination,
        departureDate,
        travelClass: 'BUSINESS',
        flexibility: 3,
        maxResults: 3,
      });
      const bestFlight = pickBestFlight(results);

      if (!bestFlight || bestFlight.miles === null) {
        continue;
      }

      const mapped = mapFlightToPointDeal(route, bestFlight, deps.generateId(), deps.now);
      dealsToUpsert.push(mapped.deal);
      historyEntries.push(mapped.historyEntry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${route.origin}->${route.destination}: ${message}`);
    }
  }

  if (historyEntries.length > 0) {
    await deps.insertPriceHistory(historyEntries);
  }

  for (const deal of dealsToUpsert) {
    await deps.upsertDeal(deal);
  }

  return {
    dealsFound: dealsToUpsert.length,
    priceHistoryEntries: historyEntries.length,
    errors,
  };
}

function pickBestFlight(results: SeatsAeroFlight[]): SeatsAeroFlight | null {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    const leftMiles = left.miles ?? Number.MAX_SAFE_INTEGER;
    const rightMiles = right.miles ?? Number.MAX_SAFE_INTEGER;
    return leftMiles - rightMiles;
  })[0] ?? null;
}

function mapFlightToPointDeal(
  route: ScanPointsRouteInput,
  flight: SeatsAeroFlight,
  id: string,
  now: Date,
): { deal: PointDealUpsertInput; historyEntry: PriceHistoryEntry } {
  const cabinClass = mapSeatsCabinToDealCabin(flight.cabin);
  const departureDate = new Date(flight.outbound.departure.time);
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + 72);

  return {
    deal: {
      id,
      origin: route.origin,
      destination: route.destination,
      destinationName: null,
      departureDate,
      returnDate: null,
      price: flight.miles ?? 0,
      currency: 'PTS',
      averagePrice: null,
      priceDifference: null,
      priceChangePercent: null,
      dealScore: calculatePointsDealScore({
        miles: flight.miles,
        cabinClass,
        stops: flight.totalStops,
        taxesAmount: flight.taxes.amount,
        seatsLeft: flight.seatsLeft,
      }),
      airline: flight.airline,
      stops: flight.totalStops,
      flightDuration: parseDurationMinutes(flight.outbound.duration),
      cabinClass,
      tripType: 'oneway',
      affiliateLink: getFirstBookingLink(flight.bookingLinks),
      source: POINTS_SOURCE,
      expiresAt,
    },
    historyEntry: {
      origin: route.origin,
      destination: route.destination,
      price: flight.miles ?? 0,
      currency: 'PTS',
      cabinClass,
      source: POINTS_SOURCE,
    },
  };
}

function mapSeatsCabinToDealCabin(cabin: string): CabinClass {
  const normalizedCabin = cabin.toLowerCase();

  if (normalizedCabin.includes('first')) {
    return 'first';
  }

  if (normalizedCabin.includes('premium')) {
    return 'premium_economy';
  }

  if (normalizedCabin.includes('business')) {
    return 'business';
  }

  return 'economy';
}

function parseDurationMinutes(duration: string): number | null {
  const match = duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);

  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const totalMinutes = hours * 60 + minutes;

  return totalMinutes > 0 ? totalMinutes : null;
}

function getFirstBookingLink(bookingLinks?: Record<string, string>): string | null {
  if (!bookingLinks) {
    return null;
  }

  const [firstLink] = Object.values(bookingLinks);
  return firstLink ?? null;
}

function clampScore(score: number): number {
  return Math.max(60, Math.min(95, Math.round(score)));
}
