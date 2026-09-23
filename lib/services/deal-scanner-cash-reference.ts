import type { DuffelFlight, DuffelSearchParams } from '@/lib/api/duffel-client';
import type { EurRates } from '@/lib/deals/award-valuation';
import { SEATS_AERO_SCAN_INTERVAL_HOURS } from './deal-scanner-points';

const CASH_REFERENCE_SOURCE = 'duffel';
const CASH_REFERENCE_CABIN = 'business';
const SCAN_WINDOWS_PER_DAY = 24 / SEATS_AERO_SCAN_INTERVAL_HOURS;

export interface CashReferenceRoute {
  origin: string;
  destination: string;
}

export interface CashReferenceHistoryEntry {
  origin: string;
  destination: string;
  price: number;
  currency: 'EUR';
  cabinClass: 'business';
  source: typeof CASH_REFERENCE_SOURCE;
  scannedAt: Date;
}

export interface CashReferenceScanDependencies {
  searchDuffel: (params: DuffelSearchParams) => Promise<DuffelFlight[]>;
  insertPriceHistory: (entries: CashReferenceHistoryEntry[]) => Promise<void>;
  eurRates: EurRates;
}

/**
 * Partition routes across the daily seats.aero scan windows so each route gets
 * one Duffel cash-reference call per day. `routeIndex % windows` selects the
 * window `floor(utcHour / interval)`; every route lands in exactly one window.
 *
 * @param routes - Routes with a concrete destination, in stable order.
 * @param now - Current scan timestamp.
 * @returns The subset due in this window.
 */
export function selectCashReferenceRoutes<T>(routes: T[], now: Date): T[] {
  const windowIndex = Math.floor(now.getUTCHours() / SEATS_AERO_SCAN_INTERVAL_HOURS) % SCAN_WINDOWS_PER_DAY;
  return routes.filter((_, index) => index % SCAN_WINDOWS_PER_DAY === windowIndex);
}

/**
 * Measure one business-class cash sample for the Ø Barpreis: the cheapest
 * Duffel offer of the route on the probe date, converted to EUR.
 *
 * @param route - Origin/destination pair to measure.
 * @param departureDate - ISO departure date for the one-way probe.
 * @param deps - Injected Duffel search, persistence, and FX conversion.
 * @returns 1 when a sample was inserted, otherwise 0.
 */
export async function scanBusinessCashReference(
  route: CashReferenceRoute,
  departureDate: string,
  deps: CashReferenceScanDependencies,
): Promise<number> {
  const offers = await deps.searchDuffel({
    origin: route.origin,
    destination: route.destination,
    departureDate,
    cabinClass: CASH_REFERENCE_CABIN,
    passengers: 1,
    maxConnections: 1,
    maxResults: 10,
  });

  const pricesEur = offers
    .map((offer) =>
      deps.eurRates.toEur(Number(offer.price.total), offer.price.currency),
    )
    .filter((price): price is number => price !== null && Number.isFinite(price));

  if (pricesEur.length === 0) {
    return 0;
  }

  await deps.insertPriceHistory([
    {
      origin: route.origin,
      destination: route.destination,
      price: Math.min(...pricesEur),
      currency: 'EUR',
      cabinClass: CASH_REFERENCE_CABIN,
      source: CASH_REFERENCE_SOURCE,
      scannedAt: new Date(),
    },
  ]);
  return 1;
}
