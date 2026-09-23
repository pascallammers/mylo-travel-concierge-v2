import assert from 'node:assert';
import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import { describe, it, mock } from 'node:test';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
import type { CashReference } from '@/lib/deals/award-valuation';
import type { ResolvedRate, ValuationTable } from '@/lib/valuation/types';
import {
  buildPointsScanDepartureDates,
  calculatePointsDealScore,
  pickBestFlight,
  scanPointsDealsForRoute,
  shouldScanSeatsAero,
  type ScanPointsDependencies,
} from './deal-scanner-points';

const RATE_VALID_FROM = new Date('2026-01-01T00:00:00.000Z');

function createRate(centsPerUnit: number): ResolvedRate {
  return {
    centsPerUnit,
    cabin: 'business',
    source: 'test',
    sourceUrl: null,
    sourceAsOf: new Date('2026-01-01T00:00:00.000Z'),
    reviewDue: new Date('2026-12-01T00:00:00.000Z'),
    stale: false,
    validFrom: RATE_VALID_FROM,
  };
}

function createValuationTable(rates: Record<string, number> = { lufthansa: 1.7 }): ValuationTable {
  return {
    rateFor: (programId) => {
      const centsPerUnit = rates[programId];
      return centsPerUnit === undefined ? undefined : createRate(centsPerUnit);
    },
    isRatable: (programId) => programId in rates,
    programIds: () => Object.keys(rates).sort(),
    staleRates: () => [],
    tableAsOf: '2026-01',
  };
}

const REACHABLE = new Set(['lufthansa']);

function createScanDeps(
  overrides: Partial<ScanPointsDependencies> = {},
): Pick<ScanPointsDependencies, 'valuation' | 'isReachableDach' | 'eurRates' | 'getCashReference' | 'resolveDestinationName'> {
  return {
    valuation: createValuationTable(),
    isReachableDach: (slug) => REACHABLE.has(slug),
    eurRates: { toEur: (amount, currency) => (currency === 'EUR' ? amount : null) },
    getCashReference: async (): Promise<CashReference | null> => null,
    resolveDestinationName: async (code) => `City-${code}`,
    ...overrides,
  };
}

function createSeatsFlight(overrides: Partial<SeatsAeroFlight> = {}): SeatsAeroFlight {
  return {
    id: 'award-1',
    price: '48,000 miles + EUR 87.40',
    pricePerPerson: '48,000 miles + EUR 87.40',
    program: 'lufthansa',
    airline: 'Lufthansa',
    cabin: 'Business',
    tags: [],
    totalStops: 0,
    miles: 48000,
    taxes: {
      amount: 87.4,
      currency: 'EUR',
    },
    seatsLeft: 2,
    bookingLinks: {
      lufthansa: 'https://example.com/book-award',
    },
    outbound: {
      departure: {
        airport: 'FRA',
        time: '2026-06-01T10:00:00.000Z',
      },
      arrival: {
        airport: 'JFK',
        time: '2026-06-01T18:15:00.000Z',
      },
      duration: '8h 15m',
      stops: 'Nonstop',
      flightNumbers: 'LH400',
    },
    ...overrides,
  };
}

describe('shouldScanSeatsAero', () => {
  it('aktiviert den Punkte-Scan nur im 6-Stunden-Takt', () => {
    assert.strictEqual(shouldScanSeatsAero(new Date('2026-04-09T12:15:00.000Z')), true);
    assert.strictEqual(shouldScanSeatsAero(new Date('2026-04-09T13:15:00.000Z')), false);
  });
});

describe('buildPointsScanDepartureDates', () => {
  it('erstellt monatliche Scan-Ziele fuer die naechsten drei Monate', () => {
    const dates = buildPointsScanDepartureDates(new Date('2026-04-09T12:15:00.000Z'));

    assert.deepStrictEqual(dates, ['2026-05-01', '2026-06-01', '2026-07-01']);
  });
});

describe('calculatePointsDealScore', () => {
  it('bewertet hochwertige Award-Deals hoeher', () => {
    const strongScore = calculatePointsDealScore({
      miles: 48000,
      cabinClass: 'business',
      stops: 0,
      taxesAmount: 87.4,
      seatsLeft: 2,
    });
    const weakScore = calculatePointsDealScore({
      miles: 92000,
      cabinClass: 'economy',
      stops: 2,
      taxesAmount: 340,
      seatsLeft: 1,
    });

    assert.ok(strongScore > weakScore);
    assert.ok(strongScore >= 85);
    assert.ok(weakScore >= 60);
  });
});

describe('scanPointsDealsForRoute', () => {
  it('mapped den besten Award-Deal je Scan-Datum in Price-History und Flight-Deals', async () => {
    const searchSeatsAero = mock.fn(async ({ departureDate }: { departureDate: string }) => {
      if (departureDate === '2026-05-01') {
        return [
          createSeatsFlight({
            id: 'award-may-low',
            miles: 48000,
            outbound: {
              departure: { airport: 'FRA', time: '2026-05-01T10:00:00.000Z' },
              arrival: { airport: 'JFK', time: '2026-05-01T18:15:00.000Z' },
              duration: '8h 15m',
              stops: 'Nonstop',
              flightNumbers: 'LH400',
            },
          }),
          createSeatsFlight({
            id: 'award-may-high',
            miles: 62000,
            outbound: {
              departure: { airport: 'FRA', time: '2026-05-01T11:00:00.000Z' },
              arrival: { airport: 'JFK', time: '2026-05-01T20:15:00.000Z' },
              duration: '9h 15m',
              stops: '1 stop',
              flightNumbers: 'LH402',
            },
          }),
        ];
      }

      return [];
    });
    const upsertDeal = mock.fn(async () => undefined);
    const insertPriceHistory = mock.fn(async () => undefined);
    let generatedIds = 0;

    const result = await scanPointsDealsForRoute(
      {
        origin: 'FRA',
        destination: 'JFK',
      },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory,
        generateId: () => `award-id-${++generatedIds}`,
        ...createScanDeps(),
      },
    );

    assert.strictEqual(result.dealsFound, 1);
    assert.strictEqual(result.priceHistoryEntries, 1);
    assert.strictEqual(searchSeatsAero.mock.calls.length, 1);
    assert.strictEqual(insertPriceHistory.mock.calls.length, 1);
    assert.strictEqual(upsertDeal.mock.calls.length, 1);

    const insertedEntry = insertPriceHistory.mock.calls[0].arguments[0][0];
    assert.strictEqual(insertedEntry.origin, 'FRA');
    assert.strictEqual(insertedEntry.destination, 'JFK');
    assert.strictEqual(insertedEntry.price, 48000);
    assert.strictEqual(insertedEntry.currency, 'PTS');
    assert.strictEqual(insertedEntry.source, 'seats_aero');

    const upsertedDeal = upsertDeal.mock.calls[0].arguments[0];
    assert.strictEqual(upsertedDeal.id, 'award-id-1');
    assert.strictEqual(upsertedDeal.price, 48000);
    assert.strictEqual(upsertedDeal.currency, 'PTS');
    assert.strictEqual(upsertedDeal.source, 'seats_aero');
    assert.strictEqual(upsertedDeal.tripType, 'oneway');
    assert.strictEqual(upsertedDeal.cabinClass, 'business');
    assert.strictEqual(upsertedDeal.affiliateLink, 'https://example.com/book-award');
    assert.ok(upsertedDeal.dealScore >= 85);
  });

  it('faellt bei API-Fehlern graceful zurueck und bricht den Cash-Scan nicht ab', async () => {
    const searchSeatsAero = mock.fn(async () => {
      throw new Error('429 rate limited');
    });
    const upsertDeal = mock.fn(async () => undefined);
    const insertPriceHistory = mock.fn(async () => undefined);

    const result = await scanPointsDealsForRoute(
      {
        origin: 'FRA',
        destination: 'JFK',
      },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory,
        generateId: () => 'unused',
        ...createScanDeps(),
      },
    );

    assert.strictEqual(result.dealsFound, 0);
    assert.strictEqual(result.priceHistoryEntries, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /FRA->JFK/i);
    assert.strictEqual(upsertDeal.mock.calls.length, 0);
    assert.strictEqual(insertPriceHistory.mock.calls.length, 0);
  });

  it('waehlt den Award mit den geringsten Einloesekosten statt den wenigsten Meilen', async () => {
    const searchSeatsAero = mock.fn(async () => [
      createSeatsFlight({ id: 'cheap-miles', miles: 12500, taxes: { amount: 800, currency: 'EUR' } }),
      createSeatsFlight({ id: 'cheap-cost', miles: 45000, taxes: { amount: 50, currency: 'EUR' } }),
    ]);
    const upsertDeal = mock.fn(async () => undefined);

    await scanPointsDealsForRoute(
      { origin: 'FRA', destination: 'JFK' },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory: mock.fn(async () => undefined),
        generateId: () => 'id-1',
        ...createScanDeps(),
      },
    );

    const deal = upsertDeal.mock.calls[0].arguments[0];
    assert.strictEqual(deal.price, 45000);
    assert.strictEqual(deal.taxesEur, 50);
  });

  it('bevorzugt ein DACH-erreichbares Programm vor einem guenstigeren unerreichbaren', async () => {
    const lufthansa = createSeatsFlight({ id: 'reachable', program: 'lufthansa', miles: 60000, taxes: { amount: 100, currency: 'EUR' } });
    const united = createSeatsFlight({ id: 'unreachable', program: 'united', miles: 40000, taxes: { amount: 50, currency: 'EUR' } });

    const best = pickBestFlight(
      [
        { flight: united, valuation: { taxesEur: 50, redemptionCostEur: 450, savingsPercent: null, rate: createRate(1.0) } },
        { flight: lufthansa, valuation: { taxesEur: 100, redemptionCostEur: 1120, savingsPercent: null, rate: createRate(1.7) } },
      ],
      (slug) => REACHABLE.has(slug),
    );

    assert.strictEqual(best?.flight.id, 'reachable');
  });

  it('materialisiert Programm, Zuschlaege, Ø Barpreis, Rate und Ersparnis im Upsert', async () => {
    const searchSeatsAero = mock.fn(async () => [
      createSeatsFlight({ miles: 60000, taxes: { amount: 480, currency: 'EUR' }, seatsLeft: 3 }),
    ]);
    const upsertDeal = mock.fn(async () => undefined);

    await scanPointsDealsForRoute(
      { origin: 'FRA', destination: 'JFK' },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory: mock.fn(async () => undefined),
        generateId: () => 'id-1',
        ...createScanDeps({
          getCashReference: async () => ({ meanEur: 2900, samples: 5 }),
        }),
      },
    );

    const deal = upsertDeal.mock.calls[0].arguments[0];
    assert.strictEqual(deal.programId, 'lufthansa');
    assert.strictEqual(deal.programReachableDach, true);
    assert.strictEqual(deal.taxesAmount, 480);
    assert.strictEqual(deal.taxesCurrency, 'EUR');
    assert.strictEqual(deal.taxesEur, 480);
    assert.strictEqual(deal.seatsLeft, 3);
    assert.strictEqual(deal.cashReferencePrice, 2900);
    assert.strictEqual(deal.cashReferenceSamples, 5);
    assert.strictEqual(deal.valuationRateCt, 1.7);
    assert.deepStrictEqual(deal.valuationRateValidFrom, RATE_VALID_FROM);
    // (2900 - 480 - 60000*1.7/100) / 2900 * 100 = 48.2758...
    assert.ok(Math.abs(deal.savingsPercent - 48.2758) < 0.001);
    assert.strictEqual(deal.destinationName, 'City-JFK');
  });

  it('speichert Programm, Zuschlaege und Sitze auch ohne Ø Barpreis', async () => {
    const searchSeatsAero = mock.fn(async () => [createSeatsFlight()]);
    const upsertDeal = mock.fn(async () => undefined);

    await scanPointsDealsForRoute(
      { origin: 'FRA', destination: 'JFK' },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory: mock.fn(async () => undefined),
        generateId: () => 'id-1',
        ...createScanDeps({ getCashReference: async () => null }),
      },
    );

    const deal = upsertDeal.mock.calls[0].arguments[0];
    assert.strictEqual(deal.savingsPercent, null);
    assert.strictEqual(deal.cashReferencePrice, null);
    assert.strictEqual(deal.cashReferenceSamples, null);
    assert.strictEqual(deal.programId, 'lufthansa');
    assert.strictEqual(deal.taxesEur, 87.4);
    assert.strictEqual(deal.seatsLeft, 2);
  });

  it('speichert unbekannte Programme ohne Rate und faellt auf Meilen-Ranking zurueck', async () => {
    const searchSeatsAero = mock.fn(async () => [
      createSeatsFlight({ id: 'azul-high', program: 'azul', miles: 90000 }),
      createSeatsFlight({ id: 'azul-low', program: 'azul', miles: 55000 }),
    ]);
    const upsertDeal = mock.fn(async () => undefined);

    await scanPointsDealsForRoute(
      { origin: 'FRA', destination: 'JFK' },
      {
        now: new Date('2026-04-09T12:15:00.000Z'),
        monthsAhead: 1,
        searchSeatsAero,
        upsertDeal,
        insertPriceHistory: mock.fn(async () => undefined),
        generateId: () => 'id-1',
        ...createScanDeps(),
      },
    );

    const deal = upsertDeal.mock.calls[0].arguments[0];
    assert.strictEqual(deal.programId, 'azul');
    assert.strictEqual(deal.programReachableDach, false);
    assert.strictEqual(deal.price, 55000);
    assert.strictEqual(deal.valuationRateCt, null);
    assert.strictEqual(deal.savingsPercent, null);
  });
});


it('keeps completed months and stops remaining months on a daily quota error', async () => {
  let calls = 0;
  const upsertDeal = mock.fn(async () => {});
  const insertPriceHistory = mock.fn(async () => {});
  const result = await scanPointsDealsForRoute({ origin: 'FRA', destination: 'JFK' }, {
    ...createScanDeps(), now: new Date('2026-04-09T12:00:00Z'),
    searchSeatsAero: async () => {
      if (++calls === 2) throw new SeatsAeroQuotaExhaustedError(new Date('2026-04-10T00:00:00Z'));
      return [createSeatsFlight()];
    },
    generateId: () => 'deal-id', upsertDeal, insertPriceHistory,
  });
  assert.equal(calls, 2);
  assert.equal(result.errorType, 'rate_limited');
  assert.equal(result.errors.length, 1);
  assert.equal(result.dealsFound, 1);
  assert.equal(upsertDeal.mock.callCount(), 1);
  assert.equal(insertPriceHistory.mock.callCount(), 1);
});
