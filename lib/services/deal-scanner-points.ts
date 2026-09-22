import type { SeatsAeroFlight, SeatsAeroSearchParams } from '@/lib/api/seats-aero-client';
import {
  valueAward,
  type AwardValuation,
  type CashReference,
  type EurRates,
} from '@/lib/deals/award-valuation';
import type { ValuationTable } from '@/lib/valuation/types';

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

const POINTS_CABIN: CabinClass = 'business';

interface PriceHistoryEntry {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  cabinClass: CabinClass;
  source: string;
}

export interface PointDealUpsertInput {
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
  programId: string | null;
  programReachableDach: boolean | null;
  taxesAmount: number | null;
  taxesCurrency: string | null;
  taxesEur: number | null;
  seatsLeft: number | null;
  cashReferencePrice: number | null;
  cashReferenceSamples: number | null;
  valuationRateCt: number | null;
  valuationRateValidFrom: Date | null;
  savingsPercent: number | null;
  expiresAt: Date;
}

/** One award flight together with its computed valuation. */
export interface ValuedFlight {
  flight: SeatsAeroFlight;
  valuation: AwardValuation;
}

interface ScanPointsRouteInput {
  origin: string;
  destination: string;
}

export interface ScanPointsDependencies {
  searchSeatsAero: (params: SeatsAeroSearchParams) => Promise<SeatsAeroFlight[]>;
  upsertDeal: (deal: PointDealUpsertInput) => Promise<void>;
  insertPriceHistory: (entries: PriceHistoryEntry[]) => Promise<void>;
  generateId: () => string;
  now: Date;
  monthsAhead?: number;
  valuation: ValuationTable;
  isReachableDach: (slug: string) => boolean;
  eurRates: EurRates;
  getCashReference: (
    origin: string,
    destination: string,
    cabinClass: CabinClass,
  ) => Promise<CashReference | null>;
  resolveDestinationName: (code: string) => Promise<string | null>;
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
  const cashRef = await deps.getCashReference(route.origin, route.destination, POINTS_CABIN);
  const destinationName = await deps.resolveDestinationName(route.destination);
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
      const valued = results.map((flight) => valueFlight(flight, cashRef, deps));
      const best = pickBestFlight(valued, deps.isReachableDach);

      if (!best || best.flight.miles === null) {
        continue;
      }

      const mapped = mapFlightToPointDeal(route, best, cashRef, destinationName, deps);
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

function valueFlight(
  flight: SeatsAeroFlight,
  cashRef: CashReference | null,
  deps: Pick<ScanPointsDependencies, 'valuation' | 'eurRates'>,
): ValuedFlight {
  const cabin = mapSeatsCabinToDealCabin(flight.cabin);
  const rate = deps.valuation.rateFor(flight.program, 'travel', cabin) ?? null;
  const valuation =
    flight.miles === null
      ? {
          taxesEur:
            flight.taxes.amount === null || !flight.taxes.currency
              ? null
              : deps.eurRates.toEur(flight.taxes.amount, flight.taxes.currency),
          redemptionCostEur: null,
          savingsPercent: null,
          rate,
        }
      : valueAward(
          {
            miles: flight.miles,
            taxesAmount: flight.taxes.amount,
            taxesCurrency: flight.taxes.currency,
          },
          rate,
          cashRef,
          deps.eurRates,
        );

  return { flight, valuation };
}

/**
 * Pick the best award of one month: DACH-reachable programs first, then the
 * cheapest redemption (miles at rate plus taxes); flights without a computed
 * cost rank behind, ties fall back to mileage.
 *
 * @param candidates - Award flights with their valuations.
 * @param isReachableDach - Whether a program is payable from the DACH region.
 * @returns The best candidate, or null for an empty month.
 */
export function pickBestFlight(
  candidates: ValuedFlight[],
  isReachableDach: (slug: string) => boolean,
): ValuedFlight | null {
  if (candidates.length === 0) {
    return null;
  }

  const reachable = candidates.filter((candidate) =>
    isReachableDach(candidate.flight.program),
  );
  const pool = reachable.length > 0 ? reachable : candidates;

  return [...pool].sort((left, right) => {
    const leftCost = left.valuation.redemptionCostEur;
    const rightCost = right.valuation.redemptionCostEur;
    if (leftCost !== null && rightCost !== null && leftCost !== rightCost) {
      return leftCost - rightCost;
    }
    if (leftCost !== null && rightCost === null) return -1;
    if (leftCost === null && rightCost !== null) return 1;
    const leftMiles = left.flight.miles ?? Number.MAX_SAFE_INTEGER;
    const rightMiles = right.flight.miles ?? Number.MAX_SAFE_INTEGER;
    return leftMiles - rightMiles;
  })[0] ?? null;
}

function mapFlightToPointDeal(
  route: ScanPointsRouteInput,
  best: ValuedFlight,
  cashRef: CashReference | null,
  destinationName: string | null,
  deps: Pick<ScanPointsDependencies, 'generateId' | 'now' | 'isReachableDach'>,
): { deal: PointDealUpsertInput; historyEntry: PriceHistoryEntry } {
  const { flight, valuation } = best;
  const cabinClass = mapSeatsCabinToDealCabin(flight.cabin);
  const departureDate = new Date(flight.outbound.departure.time);
  const expiresAt = new Date(deps.now);
  expiresAt.setHours(expiresAt.getHours() + 72);

  return {
    deal: {
      id: deps.generateId(),
      origin: route.origin,
      destination: route.destination,
      destinationName,
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
      programId: flight.program,
      programReachableDach: deps.isReachableDach(flight.program),
      taxesAmount: flight.taxes.amount,
      taxesCurrency: flight.taxes.currency,
      taxesEur: valuation.taxesEur,
      seatsLeft: flight.seatsLeft,
      cashReferencePrice: cashRef?.meanEur ?? null,
      cashReferenceSamples: cashRef?.samples ?? null,
      valuationRateCt: valuation.rate?.centsPerUnit ?? null,
      valuationRateValidFrom: valuation.rate?.validFrom ?? null,
      savingsPercent: valuation.savingsPercent,
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
