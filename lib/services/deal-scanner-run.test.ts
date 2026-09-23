import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { SeatsAeroQuotaExhaustedError, type SeatsAeroQuota } from '@/lib/api/seats-aero-quota';
import { runDealScanWithDependencies, type DealScanDependencies } from './deal-scanner-run';

const now = new Date('2026-09-23T12:00:00Z');
const resetsAt = new Date('2026-09-24T00:00:00Z');
const routes = ['JFK', 'BKK', 'SIN', 'HKT'].map((destination) => ({ origin: 'FRA', destination }));

function setup(overrides: Partial<DealScanDependencies> = {}) {
  const searchSeatsAero = mock.fn(async () => []);
  const processCashRoute = mock.fn(async () => {});
  const searchDuffel = mock.fn(async () => []);
  const deleteStaleDealsForRoute = mock.fn(async () => 2);
  const deleteExpiredDeals = mock.fn(async () => 1);
  const deps: DealScanDependencies = {
    now,
    pointsEnabled: true,
    getActiveRoutes: async () => routes,
    loadPointsScanDeps: async () => ({
      valuation: {
        rateFor: () => undefined,
        isRatable: () => false,
        programIds: () => [],
        staleRates: () => [],
        tableAsOf: '2026-09',
      },
      eurRates: { toEur: (amount) => amount },
      isReachableDach: () => true,
      getCashReference: async () => null,
      resolveDestinationName: async () => null,
    }),
    processCashRoute,
    searchSeatsAero,
    searchDuffel,
    getSeatsAeroQuota: () => null,
    insertPriceHistory: async () => {},
    upsertDeal: async () => {},
    generateId: () => 'id',
    deleteStaleDealsForRoute,
    deleteExpiredDeals,
    ...overrides,
  };
  return { deps, searchSeatsAero, processCashRoute, searchDuffel, deleteStaleDealsForRoute, deleteExpiredDeals };
}

describe('daily budget in the deal scan run', () => {
  it('skips the points tail below reserve, logs once, and continues cash and cleanup', async (t) => {
    const log = t.mock.method(console, 'log', () => {});
    const test = setup({ getSeatsAeroQuota: () => ({ limit: 1000, remaining: 299, resetsAt }) });
    const result = await runDealScanWithDependencies(test.deps);
    assert.equal(test.searchSeatsAero.mock.callCount(), 0);
    assert.equal(test.processCashRoute.mock.callCount(), 4);
    assert.equal(test.searchDuffel.mock.callCount(), 2, 'cash reference on skipped routes still runs (half of 4 routes per 12-h window)');
    assert.equal(test.deleteStaleDealsForRoute.mock.callCount(), 0);
    assert.equal(test.deleteExpiredDeals.mock.callCount(), 1);
    assert.equal(result.seatsAeroRoutesSkipped, 4);
    assert.equal(result.seatsAeroRemaining, 299);
    assert.equal(result.routesScanned, 4);
    assert.equal(log.mock.calls.filter((call) => String(call.arguments[0]).includes('user reserve')).length, 1);
  });

  it('scans the highest-priority route down to exactly the reserve, then skips the tail', async () => {
    let remaining = 303;
    const search = mock.fn(async () => {
      remaining--;
      return [];
    });
    const test = setup({ searchSeatsAero: search, getSeatsAeroQuota: () => ({ limit: 1000, remaining, resetsAt }) });
    const result = await runDealScanWithDependencies(test.deps);
    assert.equal(search.mock.callCount(), 3);
    assert.equal(result.seatsAeroRoutesSkipped, 3);
    assert.equal(result.seatsAeroRemaining, 300);
    assert.equal(test.deleteStaleDealsForRoute.mock.callCount(), 1);
  });

  it('stops on a mid-route 429 even with unknown quota and keeps all stale award deals', async () => {
    let calls = 0;
    const test = setup({
      searchSeatsAero: async () => {
        if (++calls === 2) throw new SeatsAeroQuotaExhaustedError(resetsAt);
        return [];
      },
    });
    const result = await runDealScanWithDependencies(test.deps);
    assert.equal(calls, 2, 'no third month or later route is searched');
    assert.equal(test.deleteStaleDealsForRoute.mock.callCount(), 0);
    assert.equal(result.seatsAeroRoutesSkipped, 3, 'the partially scanned route is not counted as skipped');
    assert.equal(result.seatsAeroRemaining, null);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /quota exhausted/);
    assert.equal(test.processCashRoute.mock.callCount(), 4);
    assert.equal(test.searchDuffel.mock.callCount(), 2);
  });

  it('returns the last quota observed during the run', async () => {
    let quota: SeatsAeroQuota | null = null;
    const test = setup({
      getSeatsAeroQuota: () => quota,
      searchSeatsAero: async () => {
        quota = { limit: 1000, remaining: 0, resetsAt };
        throw new SeatsAeroQuotaExhaustedError(resetsAt);
      },
    });
    assert.equal((await runDealScanWithDependencies(test.deps)).seatsAeroRemaining, 0);
  });

  it('allows unknown budgets and removes stale deals after successful routes', async () => {
    const test = setup();
    const result = await runDealScanWithDependencies(test.deps);
    assert.equal(test.searchSeatsAero.mock.callCount(), 12);
    assert.equal(test.deleteStaleDealsForRoute.mock.callCount(), 4);
    assert.equal(result.seatsAeroRoutesSkipped, 0);
    assert.equal(result.staleDealsRemoved, 8);
  });

  it('does not count routes outside the scheduled award window as quota skips', async () => {
    const test = setup({
      now: new Date('2026-09-23T13:00:00Z'),
      getSeatsAeroQuota: () => ({ limit: 1000, remaining: 0, resetsAt }),
    });
    const result = await runDealScanWithDependencies(test.deps);
    assert.equal(test.searchSeatsAero.mock.callCount(), 0);
    assert.equal(result.seatsAeroRoutesSkipped, 0);
  });
});
