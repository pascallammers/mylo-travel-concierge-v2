/**
 * Integration regression test for searchSeatsAero — the "MYLO zeigt nur
 * Lufthansa" guard.
 *
 * The fixture mirrors the REAL seats.aero /partnerapi/search shape (verified
 * live against the production key, MUC->MIA Sept 2026): entry-level Source +
 * AvailabilityTrips[] carrying trip-level Source, Carriers, MileageCost,
 * TotalTaxes (cents), Stops, DepartsAt/ArrivesAt, FlightNumbers, Cabin
 * (lowercase). Three programs at ~30 entries each in production; the fixture
 * keeps a representative slice (aeroplan 70k / lufthansa 73k / united 88k).
 *
 * This replaces the earlier fixture which used a fabricated shape
 * (business.miles, segments[].airline) the real client never reads.
 */

import assert from 'node:assert';
import { afterEach, describe, it, mock } from 'node:test';

import { searchSeatsAero } from './seats-aero-client';
import { KNOWN_PROGRAM_SLUGS } from './award-search/program-registry';

const originalFetch = global.fetch;

function businessTrip(overrides: Record<string, unknown>) {
  return {
    ID: `trip-${overrides.Source}-${overrides.MileageCost}`,
    AvailabilityID: `entry-${overrides.Source}`,
    Carriers: 'XX',
    TaxesCurrency: 'EUR',
    Stops: 2,
    RemainingSeats: 2,
    DepartsAt: '2026-09-01T10:00:00Z',
    ArrivesAt: '2026-09-01T20:00:00Z',
    FlightNumbers: 'XX1, XX2',
    Cabin: 'business',
    ...overrides,
  };
}

/** MUC->MIA with three mileage programs — the live-verified diversity. */
function mucMiaThreePrograms() {
  return {
    data: [
      {
        ID: 'entry-aeroplan',
        Source: 'aeroplan',
        AvailabilityTrips: [
          businessTrip({ Source: 'aeroplan', Carriers: 'LH, AC', MileageCost: 70000, TotalTaxes: 21000, Stops: 1 }),
          businessTrip({ Source: 'aeroplan', Carriers: 'LH, AC', MileageCost: 78000, TotalTaxes: 21000, Stops: 1 }),
        ],
      },
      {
        ID: 'entry-lufthansa',
        Source: 'lufthansa',
        AvailabilityTrips: [
          businessTrip({ Source: 'lufthansa', Carriers: 'LH, LX', MileageCost: 73152, TotalTaxes: 85100, Stops: 2 }),
        ],
      },
      {
        ID: 'entry-united',
        Source: 'united',
        AvailabilityTrips: [
          businessTrip({ Source: 'united', Carriers: 'UA', MileageCost: 88000, TotalTaxes: 18600, TaxesCurrency: 'USD', Stops: 2 }),
        ],
      },
    ],
  };
}

function mockFetchReturning(payload: unknown) {
  const fetchMock = mock.fn(async (_url: string | URL) => ({
    ok: true,
    json: async () => payload,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function firstRequestedUrl(fetchMock: ReturnType<typeof mockFetchReturning>): URL {
  const firstCall = fetchMock.mock.calls[0];
  assert.ok(firstCall, 'expected fetch to be called');
  return new URL(String(firstCall.arguments[0]));
}

describe('searchSeatsAero (MUC->MIA regression)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('surfaces every distinct mileage program, not just the operating carrier', async () => {
    mockFetchReturning(mucMiaThreePrograms());

    const flights = await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    });

    const programs = new Set(flights.map((f) => f.program));
    assert.ok(programs.size >= 3, `expected >=3 programs, got ${[...programs].join(', ')}`);
    assert.deepStrictEqual([...programs].sort(), ['aeroplan', 'lufthansa', 'united']);
  });

  it('keeps the cheaper Aeroplan 70k option the old slice-by-miles dropped', async () => {
    mockFetchReturning(mucMiaThreePrograms());

    const flights = await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    });

    const aeroplan = flights.find((f) => f.program === 'aeroplan');
    assert.ok(aeroplan, 'aeroplan option must be present');
    assert.strictEqual(aeroplan!.miles, 70000);
  });

  it('every returned program is a known seats.aero source (no invented programs)', async () => {
    mockFetchReturning(mucMiaThreePrograms());

    const flights = await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    });

    for (const f of flights) {
      assert.ok(
        KNOWN_PROGRAM_SLUGS.includes(f.program),
        `program "${f.program}" is not a known seats.aero source`,
      );
    }
  });

  it('passes only_direct_flights to the API when onlyDirectFlights is set', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      onlyDirectFlights: true,
    });

    const calledUrl = firstRequestedUrl(fetchMock);
    assert.strictEqual(calledUrl.searchParams.get('only_direct_flights'), 'true');
  });

  it('omits only_direct_flights by default (API default = all connections)', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
    });

    const calledUrl = firstRequestedUrl(fetchMock);
    assert.strictEqual(calledUrl.searchParams.get('only_direct_flights'), null);
  });

  it('keeps operating carriers separate from the program', async () => {
    mockFetchReturning(mucMiaThreePrograms());

    const flights = await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    });

    const lufthansa = flights.find((f) => f.program === 'lufthansa');
    assert.strictEqual(lufthansa!.airline, 'LH, LX', 'airline column shows operating metal');
    assert.strictEqual(lufthansa!.program, 'lufthansa', 'program column shows the mileage program');
  });
});
