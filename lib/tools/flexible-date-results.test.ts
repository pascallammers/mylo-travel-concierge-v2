/**
 * Unit tests for buildFlexibleDateResults — the merge/sort/cap path of the
 * flexible date search (MYLO-20).
 *
 * The contract that fixes the bug: award flights (miles) and cash flights
 * (EUR) are never sorted against each other numerically. Each group is
 * sorted and capped independently, so cheap cash fares can no longer evict
 * award options from the response.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { buildFlexibleDateResults } from './flexible-date-results';

const params = { departDate: '2026-08-15' };

function makeAwardFlight(overrides: Record<string, unknown> = {}) {
  return {
    program: 'aeroplan',
    airline: 'Lufthansa',
    cabin: 'Economy',
    price: '45,000 Miles',
    outbound: {
      departure: { airport: 'FRA', date: '2026-08-15', time: '2026-08-15T10:00:00.000Z' },
      arrival: { airport: 'JFK', time: '2026-08-15T13:00:00.000Z' },
    },
    ...overrides,
  };
}

function makeCashFlight(overrides: Record<string, unknown> = {}) {
  return {
    airline: 'Singapore Airlines',
    price: { total: '414.76', currency: 'EUR' },
    departure: { airport: 'FRA', time: '2026-08-15T08:35:00.000Z' },
    arrival: { airport: 'JFK', time: '2026-08-15T11:10:00.000Z' },
    searchedDate: '2026-08-15',
    ...overrides,
  };
}

describe('buildFlexibleDateResults', () => {
  it('keeps award flights in the response even when every cash fare is numerically cheaper (MYLO-20)', () => {
    // The bug scenario: 15,000 miles used to compete against 400 EUR in one
    // numeric sort, so cash always won the shared top-10 cap.
    const awards = [
      makeAwardFlight({ price: '45,000 Miles' }),
      makeAwardFlight({ price: '15,000 Miles' }),
      makeAwardFlight({ price: '90,000 Miles' }),
    ];
    const cash = Array.from({ length: 10 }, (_, i) =>
      makeCashFlight({ price: { total: (350 + i).toFixed(2), currency: 'EUR' } }),
    );

    const result = buildFlexibleDateResults(awards, cash, params, 'de');

    assert.strictEqual(result.awardFlights.length, 3);
    assert.strictEqual(result.cashFlights.length, 5);
  });

  it('sorts cash flights by EUR ascending and caps the group at 5', () => {
    const cash = [
      makeCashFlight({ price: { total: '414.76', currency: 'EUR' } }),
      makeCashFlight({ price: { total: '389.00', currency: 'EUR' } }),
      makeCashFlight({ price: { total: '1250.50', currency: 'EUR' } }),
      makeCashFlight({ price: { total: '402.10', currency: 'EUR' } }),
      makeCashFlight({ price: { total: '650.00', currency: 'EUR' } }),
      makeCashFlight({ price: { total: '399.99', currency: 'EUR' } }),
    ];

    const result = buildFlexibleDateResults(null, cash, params, 'de');

    assert.strictEqual(result.cashFlights.length, 5);
    assert.deepStrictEqual(
      result.cashFlights.map((f) =>
        typeof f.price === 'object' && f.price !== null ? f.price.total : undefined,
      ),
      ['389.00', '399.99', '402.10', '414.76', '650.00'],
    );
  });

  it('sorts award prices with taxes ("18,750 miles + USD 328.33") by their miles component', () => {
    const awards = [
      makeAwardFlight({ price: '45,000 Miles' }),
      makeAwardFlight({ price: '18,750 miles + USD 328.33' }),
    ];

    const result = buildFlexibleDateResults(awards, null, params, 'de');

    assert.deepStrictEqual(
      result.awardFlights.map((f) => f.price),
      ['18,750 miles + USD 328.33', '45,000 Miles'],
    );
  });

  it('sorts flights without a parseable price to the end of their group', () => {
    const awards = [makeAwardFlight({ price: 'Preis auf Anfrage' }), makeAwardFlight({ price: '45,000 Miles' })];
    const cash = [
      makeCashFlight({ price: undefined }),
      makeCashFlight({ price: { total: '414.76', currency: 'EUR' } }),
    ];

    const result = buildFlexibleDateResults(awards, cash, params, 'de');

    assert.strictEqual(result.awardFlights[0].price, '45,000 Miles');
    assert.deepStrictEqual(result.cashFlights[1].price, undefined);
  });

  it('labels each flight with its date offset and reports the searched date range', () => {
    const awards = [
      makeAwardFlight({
        price: '15,000 Miles',
        outbound: { departure: { airport: 'FRA', date: '2026-08-13' } },
      }),
    ];
    const cash = [makeCashFlight({ searchedDate: '2026-08-16' })];

    const result = buildFlexibleDateResults(awards, cash, params, 'de');

    assert.strictEqual(result.originalDate, '2026-08-15');
    assert.deepStrictEqual(result.dateRange, { start: '2026-08-12', end: '2026-08-18' });

    const [award] = result.awardFlights;
    assert.strictEqual(award.searchedDate, '2026-08-13');
    assert.strictEqual(award.dateOffset, -2);
    assert.strictEqual(award.dateLabel, '2 Tage frueher');

    const [cashFlight] = result.cashFlights;
    assert.strictEqual(cashFlight.searchedDate, '2026-08-16');
    assert.strictEqual(cashFlight.dateOffset, 1);
    assert.strictEqual(cashFlight.dateLabel, '1 Tag spaeter');
  });

  it('falls back to the original departure date when a flight has no date info', () => {
    const awards = [makeAwardFlight({ outbound: { departure: { airport: 'FRA' } } })];

    const result = buildFlexibleDateResults(awards, null, params, 'de');

    assert.strictEqual(result.awardFlights[0].searchedDate, '2026-08-15');
    assert.strictEqual(result.awardFlights[0].dateOffset, 0);
    assert.strictEqual(result.awardFlights[0].dateLabel, 'Originaldatum');
  });

  it('falls back to the original date when searchedDate is invalid', () => {
    const cash = [makeCashFlight({ searchedDate: 'not-a-date' })];

    const result = buildFlexibleDateResults(null, cash, params, 'de');
    const [flight] = result.cashFlights;

    assert.strictEqual(flight.searchedDate, params.departDate);
    assert.strictEqual(flight.dateOffset, 0);
    assert.strictEqual(flight.dateLabel, 'Originaldatum');
    assert.doesNotMatch(flight.dateLabel, /NaN/);
  });

  it('reports truncation explicitly instead of inferring it from exactly five results', () => {
    const exactlyFive = Array.from({ length: 5 }, () => makeAwardFlight());
    const sixCash = Array.from({ length: 6 }, () => makeCashFlight());

    const complete = buildFlexibleDateResults(exactlyFive, null, params, 'de');
    const truncated = buildFlexibleDateResults(null, sixCash, params, 'de');

    assert.strictEqual(complete.awardFlightsTruncated, false);
    assert.strictEqual(complete.cashFlightsTruncated, false);
    assert.strictEqual(truncated.awardFlightsTruncated, false);
    assert.strictEqual(truncated.cashFlightsTruncated, true);
  });

  it('keeps the date range stable across the Europe/Berlin DST transition', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
    try {
      const result = buildFlexibleDateResults(null, null, { departDate: '2024-03-31' }, 'de');
      assert.deepStrictEqual(result.dateRange, {
        start: '2024-03-28',
        end: '2024-04-03',
      });
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });

  it('sorts award flights by miles ascending and caps the group at 5', () => {
    const awards = [
      makeAwardFlight({ price: '45,000 Miles' }),
      makeAwardFlight({ price: '15,000 Miles' }),
      makeAwardFlight({ price: '90,000 Miles' }),
      makeAwardFlight({ price: '30,000 Miles' }),
      makeAwardFlight({ price: '60,000 Miles' }),
      makeAwardFlight({ price: '20,000 Miles' }),
      makeAwardFlight({ price: '75,000 Miles' }),
    ];

    const result = buildFlexibleDateResults(awards, null, params, 'de');

    assert.strictEqual(result.type, 'flexible_date_results');
    assert.strictEqual(result.awardFlights.length, 5);
    assert.deepStrictEqual(
      result.awardFlights.map((f) => f.price),
      ['15,000 Miles', '20,000 Miles', '30,000 Miles', '45,000 Miles', '60,000 Miles'],
    );
  });
});
