/**
 * Tool-level tests for the roundtrip award search (MYLO-21 Ausbau).
 *
 * seats.aero has no returnDate concept — a roundtrip needs a second one-way
 * search (destination→origin on the return date). These tests pin the wiring:
 * a returnDate triggers exactly one extra seats.aero call with the swapped
 * route, a one-way search stays at one call (budget guard), and a failing
 * return-leg search degrades to the outbound-only notice instead of killing
 * the whole result.
 *
 * Heavy server deps (DB queries, airport LLM resolver, Duffel links) are
 * module-mocked; needs --experimental-test-module-mocks (set in the test
 * script).
 */

import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

type SeatsAeroCall = {
  origin: string;
  destination: string;
  departureDate: string;
};

const seatsAeroCalls: SeatsAeroCall[] = [];
let failReturnLeg = false;

function awardFlight(origin: string, destination: string, program: string) {
  return {
    id: `${origin}-${destination}-${program}`,
    price: '50,000 miles + EUR 210.00',
    pricePerPerson: '50,000 miles + EUR 210.00',
    program,
    airline: 'LH',
    cabin: 'Business',
    tags: [],
    totalStops: 0,
    miles: 50000,
    taxes: { amount: 210, currency: 'EUR' },
    seatsLeft: 2,
    bookingLinks: {},
    outbound: {
      departure: { airport: origin, time: '2027-06-15T10:00:00.000Z' },
      arrival: { airport: destination, time: '2027-06-15T18:00:00.000Z' },
      duration: '8h 0m',
      stops: 'Nonstop',
      flightNumbers: 'LH400',
    },
  };
}

mock.module('@/lib/api/seats-aero-client', {
  namedExports: {
    searchSeatsAero: async (params: SeatsAeroCall) => {
      seatsAeroCalls.push({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
      });
      const isReturnLeg = seatsAeroCalls.length > 1;
      if (isReturnLeg && failReturnLeg) {
        throw new Error('seats.aero return-leg search failed');
      }
      return [awardFlight(params.origin, params.destination, isReturnLeg ? 'united' : 'aeroplan')];
    },
  },
});

mock.module('@/lib/api/duffel-client', {
  namedExports: {
    searchDuffel: async () => [],
    searchDuffelFlexibleDates: async () => [],
    mapCabinClass: (cabin: string) => cabin.toLowerCase(),
    getNearbyAirports: async () => [],
  },
});

mock.module('@/lib/db/queries', {
  namedExports: {
    mergeSessionState: async () => {},
  },
});

mock.module('@/lib/db/queries/failed-search', {
  namedExports: {
    logFailedSearch: async () => {},
  },
});

mock.module('@/lib/utils/airport-codes', {
  namedExports: {
    resolveIATACode: async (name: string) => name,
    resolveAirportCodesWithLLM: async () => ({
      origin: { code: 'FRA', name: 'Frankfurt' },
      destination: { code: 'JFK', name: 'New York JFK' },
    }),
  },
});

mock.module('@/lib/utils/duffel-links', {
  namedExports: {
    createDuffelBookingSession: async () => ({ url: 'https://booking.example.com/x' }),
  },
});

const { flightSearchTool } = await import('./flight-search');

async function runSearch(overrides: Record<string, unknown> = {}): Promise<string> {
  const result = await flightSearchTool.execute!(
    {
      origin: 'Frankfurt',
      destination: 'New York',
      departDate: '2027-06-15',
      returnDate: null,
      cabin: 'BUSINESS',
      passengers: 1,
      awardOnly: false,
      flexibility: 0,
      nonStop: false,
      ...overrides,
    } as never,
    {} as never,
  );
  return String(result);
}

describe('flightSearchTool roundtrip award search (MYLO-21)', () => {
  beforeEach(() => {
    seatsAeroCalls.length = 0;
    failReturnLeg = false;
  });

  it('a returnDate triggers a second seats.aero search with the swapped route on the return date', async () => {
    const out = await runSearch({ returnDate: '2027-06-22' });

    assert.strictEqual(seatsAeroCalls.length, 2, 'roundtrip must search both legs');
    assert.deepStrictEqual(seatsAeroCalls[0], {
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2027-06-15',
    });
    assert.deepStrictEqual(seatsAeroCalls[1], {
      origin: 'JFK',
      destination: 'FRA',
      departureDate: '2027-06-22',
    });
    assert.match(out, /### Rückflug \(1 Ergebnisse\)/, 'return awards render as their own table');
    assert.match(out, /United MileagePlus/, 'return table shows the return leg program');
  });

  it('a one-way search stays at a single seats.aero call (budget guard)', async () => {
    await runSearch();
    assert.strictEqual(seatsAeroCalls.length, 1, 'no returnDate → no extra API call');
  });

  it('a failing return-leg search degrades to the outbound-only notice', async () => {
    failReturnLeg = true;
    const out = await runSearch({ returnDate: '2027-06-22' });

    assert.match(out, /pro Strecke \(nur Hinflug\)/i, 'outbound-only notice must appear');
    assert.doesNotMatch(out, /### Rückflug/, 'no return table without return data');
    assert.match(out, /Air Canada Aeroplan/, 'outbound awards must survive the return-leg failure');
  });
});
