import type {
  TravelpayoutsLatestPrice,
  TravelpayoutsLatestResponse,
} from '@/lib/api/travelpayouts-client';

const CASH_REFERENCE_SOURCE = 'travelpayouts';
const CASH_REFERENCE_CABIN = 'business';
const BUSINESS_TRIP_CLASS = 1;

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
  getLatestPrices: (params: {
    origin: string;
    destination?: string;
    periodType?: 'year' | 'month' | 'season' | 'day';
    oneWay?: boolean;
    tripClass?: 0 | 1 | 2;
    showToAffiliates?: boolean;
    currency?: string;
    limit?: number;
  }) => Promise<TravelpayoutsLatestResponse>;
  insertPriceHistory: (entries: CashReferenceHistoryEntry[]) => Promise<void>;
  getLatestScan: (
    origin: string,
    destination: string,
    cabinClass: 'economy' | 'premium_economy' | 'business' | 'first',
    source: string,
  ) => Promise<Date | null>;
}

/**
 * Collect one year of business-class cash prices for the Ø Barpreis.
 *
 * Samples are keyed by their `found_at` timestamp: only rows strictly newer
 * than the newest stored sample are inserted, so re-runs never duplicate.
 *
 * @param route - Origin/destination pair to measure.
 * @param deps - Injected API and persistence access.
 * @returns Number of newly inserted price-history samples.
 */
export async function scanBusinessCashReference(
  route: CashReferenceRoute,
  deps: CashReferenceScanDependencies,
): Promise<number> {
  const [response, latestScan] = await Promise.all([
    deps.getLatestPrices({
      origin: route.origin,
      destination: route.destination,
      tripClass: BUSINESS_TRIP_CLASS,
      oneWay: true,
      periodType: 'year',
      showToAffiliates: false,
      currency: 'eur',
      limit: 30,
    }),
    deps.getLatestScan(
      route.origin,
      route.destination,
      CASH_REFERENCE_CABIN,
      CASH_REFERENCE_SOURCE,
    ),
  ]);

  if (!response.success) {
    return 0;
  }

  const entries: CashReferenceHistoryEntry[] = response.data
    .filter((price) => isNewerSample(price, latestScan))
    .map((price) => ({
      origin: route.origin,
      destination: route.destination,
      price: price.value,
      currency: 'EUR' as const,
      cabinClass: CASH_REFERENCE_CABIN,
      source: CASH_REFERENCE_SOURCE,
      scannedAt: new Date(price.found_at),
    }));

  if (entries.length === 0) {
    return 0;
  }

  await deps.insertPriceHistory(entries);
  return entries.length;
}

function isNewerSample(
  price: TravelpayoutsLatestPrice,
  latestScan: Date | null,
): boolean {
  const foundAt = new Date(price.found_at);
  if (Number.isNaN(foundAt.getTime())) {
    return false;
  }
  return latestScan === null || foundAt.getTime() > latestScan.getTime();
}
