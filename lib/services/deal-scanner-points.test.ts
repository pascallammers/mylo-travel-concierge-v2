import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
import {
  buildPointsScanDepartureDates,
  calculatePointsDealScore,
  scanPointsDealsForRoute,
  shouldScanSeatsAero,
} from './deal-scanner-points';

function createSeatsFlight(overrides: Partial<SeatsAeroFlight> = {}): SeatsAeroFlight {
  return {
    id: 'award-1',
    price: '48,000 miles + EUR 87.40',
    pricePerPerson: '48,000 miles + EUR 87.40',
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
      },
    );

    assert.strictEqual(result.dealsFound, 0);
    assert.strictEqual(result.priceHistoryEntries, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /FRA->JFK/i);
    assert.strictEqual(upsertDeal.mock.calls.length, 0);
    assert.strictEqual(insertPriceHistory.mock.calls.length, 0);
  });
});
