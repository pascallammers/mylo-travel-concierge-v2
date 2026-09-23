import type { searchSeatsAero } from '@/lib/api/seats-aero-client';
import { hasScannerBudget, type SeatsAeroQuota } from '@/lib/api/seats-aero-quota';
import type { searchDuffel } from '@/lib/api/duffel-client';
import type { getActiveRoutes, deleteStaleDealsForRoute } from '@/lib/db/deal-queries';
import {
  buildPointsScanDepartureDates,
  scanPointsDealsForRoute,
  shouldScanSeatsAero,
  type ScanPointsDependencies,
} from './deal-scanner-points';
import { scanBusinessCashReference, selectCashReferenceRoutes } from './deal-scanner-cash-reference';

export type PointsScanDeps = Pick<
  ScanPointsDependencies,
  'valuation' | 'isReachableDach' | 'eurRates' | 'getCashReference' | 'resolveDestinationName'
>;

export interface DealScanDependencies {
  now: Date;
  pointsEnabled: boolean;
  monthsAhead?: number;
  getActiveRoutes: () => Promise<Pick<Awaited<ReturnType<typeof getActiveRoutes>>[number], 'origin' | 'destination'>[]>;
  loadPointsScanDeps: () => Promise<PointsScanDeps>;
  processCashRoute: (
    origin: string,
    destination: string | null,
    result: ScanResult,
    runStartedAt: Date,
  ) => Promise<void>;
  searchSeatsAero: typeof searchSeatsAero;
  getSeatsAeroQuota: () => SeatsAeroQuota | null;
  searchDuffel: typeof searchDuffel;
  insertPriceHistory: ScanPointsDependencies['insertPriceHistory'];
  upsertDeal: ScanPointsDependencies['upsertDeal'];
  generateId: () => string;
  deleteStaleDealsForRoute: typeof deleteStaleDealsForRoute;
  deleteExpiredDeals: () => Promise<number>;
}

export interface ScanResult {
  routesScanned: number;
  dealsFound: number;
  priceHistoryEntries: number;
  expiredDealsRemoved: number;
  staleDealsRemoved: number;
  cashReferenceSamples: number;
  seatsAeroRemaining: number | null;
  seatsAeroRoutesSkipped: number;
  errors: string[];
}

/**
 * Scan routes in priority order while preserving the award-search user reserve.
 * @param deps - Clock, provider, persistence, and cash-scan dependencies.
 * @returns Counts, errors, and the final known award budget.
 */
export async function runDealScanWithDependencies(deps: DealScanDependencies): Promise<ScanResult> {
  const {
    now,
    getActiveRoutes,
    loadPointsScanDeps,
    processCashRoute,
    searchSeatsAero,
    getSeatsAeroQuota,
    searchDuffel,
    insertPriceHistory,
    upsertDeal,
    generateId,
    deleteStaleDealsForRoute,
    deleteExpiredDeals,
  } = deps;
  const monthsAhead = deps.monthsAhead ?? 3;
  const result: ScanResult = {
    routesScanned: 0,
    dealsFound: 0,
    priceHistoryEntries: 0,
    expiredDealsRemoved: 0,
    staleDealsRemoved: 0,
    cashReferenceSamples: 0,
    seatsAeroRemaining: null,
    seatsAeroRoutesSkipped: 0,
    errors: [],
  };

  const runStartedAt = now;
  let pointsStopped = false;
  const routes = await getActiveRoutes();
  const shouldScanPointsDeals = deps.pointsEnabled && shouldScanSeatsAero(now);
  const pointsDeps = shouldScanPointsDeals ? await loadPointsScanDeps() : null;
  // One Duffel cash-reference probe per route per day, spread across the
  // seats.aero scan windows; the probe reuses the first monthly scan date.
  const cashReferenceRoutes = new Set(
    pointsDeps
      ? selectCashReferenceRoutes(
          routes.filter((route) => route.destination !== null),
          now,
        ).map((route) => `${route.origin}:${route.destination}`)
      : [],
  );
  console.log(`[DealScanner] Scanning ${routes.length} routes`);

  for (const route of routes) {
    try {
      await processCashRoute(route.origin, route.destination, result, runStartedAt);

      if (pointsDeps && route.destination) {
        if (cashReferenceRoutes.has(`${route.origin}:${route.destination}`)) {
          try {
            const samples = await scanBusinessCashReference(
              { origin: route.origin, destination: route.destination },
              buildPointsScanDepartureDates(now, 1)[0],
              {
                searchDuffel,
                insertPriceHistory,
                eurRates: pointsDeps.eurRates,
              },
            );
            result.cashReferenceSamples += samples;
            result.priceHistoryEntries += samples;
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[DealScanner] Cash reference failed ${route.origin}->${route.destination}:`, msg);
            result.errors.push(`${route.origin}->${route.destination} cash-reference: ${msg}`);
          }
        }

        if (!pointsStopped && !hasScannerBudget(getSeatsAeroQuota(), monthsAhead)) {
          pointsStopped = true;
          console.log(
            `[DealScanner] Stopping points scan to preserve the user reserve (${getSeatsAeroQuota()?.remaining} calls remaining)`,
          );
        }
        if (pointsStopped) {
          result.seatsAeroRoutesSkipped++;
          result.routesScanned++;
          continue;
        }

        const pointsResult = await scanPointsDealsForRoute(
          {
            origin: route.origin,
            destination: route.destination,
          },
          {
            now,
            monthsAhead,
            searchSeatsAero,
            upsertDeal,
            insertPriceHistory,
            generateId,
            ...pointsDeps,
          },
        );

        if (pointsResult.errorType === 'rate_limited') pointsStopped = true;
        result.dealsFound += pointsResult.dealsFound;
        result.priceHistoryEntries += pointsResult.priceHistoryEntries;
        result.errors.push(...pointsResult.errors);

        if (pointsResult.errors.length === 0) {
          result.staleDealsRemoved += await deleteStaleDealsForRoute({
            origin: route.origin,
            destination: route.destination,
            source: 'seats_aero',
            notSeenSince: runStartedAt,
          });
        }
      }

      result.routesScanned++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DealScanner] Error scanning ${route.origin}->${route.destination}:`, msg);
      result.errors.push(`${route.origin}->${route.destination}: ${msg}`);
    }
  }

  result.expiredDealsRemoved = await deleteExpiredDeals();

  result.seatsAeroRemaining = getSeatsAeroQuota()?.remaining ?? null;
  console.log(`[DealScanner] Complete:`, result);
  return result;
}
