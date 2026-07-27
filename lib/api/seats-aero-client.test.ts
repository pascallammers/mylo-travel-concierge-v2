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

import { clearSeatsAeroSearchCache, searchSeatsAero } from './seats-aero-client';
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
    clearSeatsAeroSearchCache();
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

  it('forwards the abort signal to the provider fetch', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | null | undefined;
    global.fetch = mock.fn(async (_input, init) => {
      receivedSignal = init?.signal;
      return {
        ok: true,
        json: async () => mucMiaThreePrograms(),
      } as Response;
    }) as typeof fetch;

    await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    }, controller.signal);

    assert.strictEqual(receivedSignal, controller.signal);
  });

  it('stops retry backoff immediately when the request is cancelled', async () => {
    const controller = new AbortController();
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })) as unknown as typeof fetch;

    const startedAt = Date.now();
    const search = searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
    }, controller.signal);
    setTimeout(() => controller.abort(new DOMException('Request cancelled', 'AbortError')), 20);

    await assert.rejects(search, { name: 'AbortError' });
    assert.ok(
      Date.now() - startedAt < 500,
      'cancellation should not wait for the one-second retry delay',
    );
  });
});

describe('searchSeatsAero (API efficiency, MYLO-23)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    clearSeatsAeroSearchCache();
  });

  const mucMiaParams = {
    origin: 'MUC',
    destination: 'MIA',
    departureDate: '2026-09-01',
    travelClass: 'BUSINESS',
    maxResults: 100,
  } as const;

  it('serves a repeated identical search from cache without a second API call', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    const first = await searchSeatsAero(mucMiaParams);
    const second = await searchSeatsAero(mucMiaParams);

    assert.strictEqual(fetchMock.mock.callCount(), 1, 'second search must not hit the API');
    assert.deepStrictEqual(second, first, 'cached result matches the live result');
  });

  it('does not expose cached results to mutations by callers', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    const first = await searchSeatsAero(mucMiaParams);
    first[0]!.airline = 'MUTATED';

    const second = await searchSeatsAero(mucMiaParams);
    assert.strictEqual(fetchMock.mock.callCount(), 1, 'second search must still use the cache');
    assert.notStrictEqual(second[0]!.airline, 'MUTATED', 'caller mutation must not leak into the cache');

    second[0]!.outbound.departure.airport = 'XXX';
    const third = await searchSeatsAero(mucMiaParams);
    assert.notStrictEqual(
      third[0]!.outbound.departure.airport,
      'XXX',
      'nested caller mutation must not leak into later cache hits',
    );
  });

  it('coalesces concurrent identical searches into one API request', async () => {
    let resolveFetch!: (response: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = mock.fn((_url: string | URL) => responsePromise);
    global.fetch = fetchMock as unknown as typeof fetch;

    const firstPromise = searchSeatsAero(mucMiaParams);
    const secondPromise = searchSeatsAero(mucMiaParams);

    assert.strictEqual(fetchMock.mock.callCount(), 1, 'identical in-flight searches must share one API request');

    resolveFetch(
      new Response(JSON.stringify(mucMiaThreePrograms()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    assert.deepStrictEqual(second, first);
    assert.notStrictEqual(second, first, 'concurrent callers must receive independent result arrays');
  });

  it('does not let one abortable caller cancel another identical search', async () => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    let invocation = 0;
    const fetchMock = mock.fn((_url: string | URL, init?: RequestInit) => {
      invocation += 1;
      if (invocation === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify(mucMiaThreePrograms()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = searchSeatsAero(mucMiaParams, firstController.signal);
    const second = searchSeatsAero(mucMiaParams, secondController.signal);
    firstController.abort(new DOMException('First caller cancelled', 'AbortError'));

    await assert.rejects(first, { name: 'AbortError' });
    const secondResult = await second;

    assert.strictEqual(fetchMock.mock.callCount(), 2);
    assert.ok(secondResult.length > 0, 'the independent caller must still succeed');
  });

  it('does not share cache entries across different search parameters', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    await searchSeatsAero(mucMiaParams);
    await searchSeatsAero({ ...mucMiaParams, travelClass: 'ECONOMY' });
    await searchSeatsAero({ ...mucMiaParams, departureDate: '2026-09-02' });
    await searchSeatsAero({ ...mucMiaParams, flexibility: 2 });
    await searchSeatsAero({ ...mucMiaParams, onlyDirectFlights: true });

    assert.strictEqual(fetchMock.mock.callCount(), 5, 'each distinct search hits the API once');
  });

  it('refreshes from the API once the cache TTL has expired', async (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    await searchSeatsAero(mucMiaParams);
    t.mock.timers.tick(11 * 60 * 1000);
    await searchSeatsAero(mucMiaParams);

    assert.strictEqual(fetchMock.mock.callCount(), 2, 'expired entry must trigger a fresh API call');
  });

  it('logs a truncation hint when the response reports hasMore', async (t) => {
    const warnMock = t.mock.method(console, 'warn');
    mockFetchReturning({ ...mucMiaThreePrograms(), hasMore: true });

    await searchSeatsAero(mucMiaParams);

    const truncationWarnings = warnMock.mock.calls.filter((call) =>
      call.arguments.join(' ').includes('hasMore')
    );
    assert.strictEqual(truncationWarnings.length, 1, 'expected one hasMore truncation warning');
  });

  it('stays silent about truncation when the response is complete', async (t) => {
    const warnMock = t.mock.method(console, 'warn');
    mockFetchReturning({ ...mucMiaThreePrograms(), hasMore: false });

    await searchSeatsAero(mucMiaParams);

    assert.strictEqual(warnMock.mock.callCount(), 0);
  });

  it('does not cache failures — the next identical search retries the API', async () => {
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })) as unknown as typeof fetch;

    await assert.rejects(() => searchSeatsAero(mucMiaParams), /401/);

    const fetchMock = mockFetchReturning(mucMiaThreePrograms());
    const flights = await searchSeatsAero(mucMiaParams);

    assert.strictEqual(fetchMock.mock.callCount(), 1, 'search after a failure must hit the API');
    assert.ok(flights.length > 0);
  });

  it('requests results ordered by lowest mileage so take-truncation keeps the cheapest options', async () => {
    const fetchMock = mockFetchReturning(mucMiaThreePrograms());

    await searchSeatsAero({
      origin: 'MUC',
      destination: 'MIA',
      departureDate: '2026-09-01',
      travelClass: 'BUSINESS',
      maxResults: 100,
    });

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0].arguments[0]));
    assert.strictEqual(requestedUrl.searchParams.get('order_by'), 'lowest_mileage');
  });
});
