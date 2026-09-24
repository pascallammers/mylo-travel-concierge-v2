import assert from 'node:assert';
import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import { describe, it } from 'node:test';
import type { DuffelFlight } from '@/lib/api/duffel-client';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
import { formatTransferRatio, AMEX_DACH_PARTNERS, PAYBACK_DACH_PARTNERS } from '@/lib/config/transfer-engine';
import { loadAwardProgramSourceResolver } from '@/lib/transfer-table/award-sources';
import {
  createFlightSearchTool,
  type FlightSearchToolDependencies,
} from './flight-search-tool';

const futureDate = (() => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
})();

const params = {
  origin: 'Frankfurt',
  destination: 'New York',
  departDate: futureDate,
  returnDate: null,
  cabin: 'BUSINESS' as const,
  passengers: 1,
  awardOnly: false,
  flexibility: 0,
  nonStop: false,
};

const awardFlight: SeatsAeroFlight = {
  id: 'award-1',
  price: '70,000 miles + USD 120.00',
  pricePerPerson: '70,000 miles + USD 120.00',
  program: 'aeroplan',
  airline: 'LH',
  cabin: 'Business',
  tags: [],
  totalStops: 0,
  miles: 70_000,
  taxes: { amount: 120, currency: 'USD' },
  seatsLeft: 2,
  outbound: {
    departure: { airport: 'FRA', time: `${futureDate}T10:00:00Z` },
    arrival: { airport: 'JFK', time: `${futureDate}T18:00:00Z` },
    duration: '8h',
    stops: 'Nonstop',
    flightNumbers: 'LH400',
  },
};

const cashFlight: DuffelFlight = {
  id: 'cash-1',
  airline: 'Lufthansa',
  price: { total: '850.00', base: '700.00', currency: 'EUR' },
  departure: { airport: 'FRA', time: `${futureDate}T10:00:00Z` },
  arrival: { airport: 'JFK', time: `${futureDate}T18:00:00Z` },
  duration: 'PT8H',
  stops: 0,
  segments: [],
};

function dependencies(
  overrides: Partial<FlightSearchToolDependencies> = {},
): FlightSearchToolDependencies {
  return {
    searchAwardTrips: async () => [awardFlight],
    searchDuffel: async () => [cashFlight],
    searchDuffelFlexibleDates: async () => [],
    mapCabinClass: () => 'business',
    getNearbyAirports: async () => [],
    mergeSessionState: async () => {},
    resolveIATACode: async (input) => input.toUpperCase(),
    resolveAirportCodesWithLLM: async () => ({
      origin: { code: 'FRA', name: 'Frankfurt Airport' },
      destination: {
        code: 'JFK',
        name: 'John F. Kennedy International Airport',
      },
    }),
    createDuffelBookingSession: async () => ({
      url: 'https://links.duffel.com/test',
    }),
    logFailedSearch: async () => {},
    applyAwardFilters: (flights) => ({ flights, notes: [] }),
    getProgramDisplayName: (slug) => slug,
    getProgramBookingUrl: () => null,
    getProgramCaveat: () => null,
    formatTransferRatio: () => '1:1',
    getTransferSourcesForAwardProgram: () => [],
    ...overrides,
  };
}

type ExecuteOptions = Parameters<
  NonNullable<ReturnType<typeof createFlightSearchTool>['execute']>
>[1];

function executeOptions(abortSignal?: AbortSignal): ExecuteOptions {
  return {
    toolCallId: 'integration-test',
    messages: [],
    abortSignal,
    experimental_context: {
      chatId: 'chat-1',
      userId: 'user-1',
      locale: 'en',
    },
  } as ExecuteOptions;
}

describe('flight-search tool factory integration', () => {
  it('loads DACH maps once and renders accepted database values in transfer hints', async () => {
    let loads = 0;
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => [{ ...awardFlight, program: 'flyingblue' }],
      formatTransferRatio,
      loadTransferSourceResolver: () => loadAwardProgramSourceResolver(async () => {
        loads++;
        return {
          amex: { flyingBlue: { ...AMEX_DACH_PARTNERS.flyingBlue, amexPoints: 2, partnerMiles: 1, effectiveRate: 50 } },
          payback: PAYBACK_DACH_PARTNERS, tableAsOf: '2026-10',
        };
      }),
    }));
    const result = await tool.execute!(params, executeOptions());
    assert.equal(loads, 1);
    assert.match(String(result), /Amex Membership Rewards \(DACH\) 2:1 \(50%\)/);
  });

  it('starts award and cash providers in parallel', async () => {
    let seatsStarted = false;
    let duffelStarted = false;
    let releaseBoth: (() => void) | undefined;
    const bothStarted = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    const markStarted = () => {
      if (seatsStarted && duffelStarted) releaseBoth?.();
    };

    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => {
        seatsStarted = true;
        markStarted();
        await bothStarted;
        return [awardFlight];
      },
      searchDuffel: async () => {
        duffelStarted = true;
        markStarted();
        await bothStarted;
        return [cashFlight];
      },
    }));

    const result = await tool.execute!(params, executeOptions());

    assert.strictEqual(seatsStarted, true);
    assert.strictEqual(duffelStarted, true);
    assert.ok(typeof result === 'string');
    assert.match(result, /Flights with Miles\/Points/);
    assert.match(result, /Flights with Cash/);
  });

  it('returns cash results when the award provider fails', async () => {
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => {
        throw new Error('Seats.aero unavailable');
      },
    }));

    const result = await tool.execute!(params, executeOptions());

    assert.ok(typeof result === 'string');
    assert.match(result, /Flights with Cash/);
    assert.match(result, /Lufthansa/);
  });

  it('stores the resolved search contract for follow-up turns', async () => {
    let mergedChatId: string | undefined;
    let mergedState: unknown;
    const tool = createFlightSearchTool(dependencies({
      mergeSessionState: async (chatId, state) => {
        mergedChatId = chatId;
        mergedState = state;
      },
    }));

    await tool.execute!(params, executeOptions());

    assert.strictEqual(mergedChatId, 'chat-1');
    assert.deepStrictEqual(mergedState, {
      last_flight_request: {
        origin: 'FRA',
        destination: 'JFK',
        departDate: futureDate,
        returnDate: null,
        cabin: 'BUSINESS',
        passengers: 1,
        awardOnly: false,
        loyaltyPrograms: undefined,
      },
      pending_flight_request: null,
    });
  });

  it('does not log a cancelled request as a failed product search', async () => {
    const controller = new AbortController();
    const cancellation = new DOMException('Request cancelled', 'AbortError');
    let failedSearchLogs = 0;
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => {
        throw cancellation;
      },
      searchDuffel: async () => {
        throw cancellation;
      },
      logFailedSearch: async () => {
        failedSearchLogs += 1;
      },
    }));

    controller.abort(cancellation);

    await assert.rejects(
      () => tool.execute!(params, executeOptions(controller.signal)) as Promise<unknown>,
      cancellation,
    );
    assert.strictEqual(failedSearchLogs, 0);
  });

  it('keeps award results when cheaper cash fares fill the shared result limit', async () => {
    const awards = [
      { ...awardFlight, id: 'award-15k', price: '15,000 miles' },
      { ...awardFlight, id: 'award-45k', price: '45,000 miles' },
      { ...awardFlight, id: 'award-90k', price: '90,000 miles' },
    ];
    const cash = Array.from({ length: 10 }, (_, index) => ({
      ...cashFlight,
      id: `cash-${index}`,
      price: {
        ...cashFlight.price,
        total: String(350 + index),
      },
      searchedDate: futureDate,
    }));
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => awards,
      searchDuffelFlexibleDates: async () => cash,
    }));

    const rawResult = await tool.execute!(
      { ...params, flexibility: 2 },
      executeOptions(),
    );
    assert.ok(typeof rawResult === 'string');
    const result = JSON.parse(rawResult) as {
      awardFlights?: unknown[];
      flights?: Array<{ source?: string }>;
    };
    const retainedAwards =
      result.awardFlights ??
      result.flights?.filter((flight) => flight.source === 'seats.aero') ??
      [];

    assert.strictEqual(retainedAwards.length, 3);
  });

  it('treats an intentionally skipped cash provider as no results for award-only searches', async () => {
    let cashProviderCalls = 0;
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async () => [],
      searchDuffel: async () => {
        cashProviderCalls += 1;
        return [];
      },
    }));

    const result = await tool.execute!(
      { ...params, awardOnly: true },
      executeOptions(),
    );

    assert.strictEqual(cashProviderCalls, 0);
    assert.ok(typeof result === 'string');
    assert.match(result, /"type":"no_results_offer_flexible"/);
  });
});


describe('daily award quota in flight search', () => {
  const resetsAt = new Date('2026-09-24T00:00:00Z');
  const quotaError = async () => { throw new SeatsAeroQuotaExhaustedError(resetsAt); };
  function options(locale: 'de' | 'en' = 'de'): ExecuteOptions {
    return { ...executeOptions(), experimental_context: { chatId: 'chat-1', userId: 'user-1', locale } } as ExecuteOptions;
  }

  for (const awardOnly of [false, true]) {
    it(`reports the daily limit with Berlin reset time when cash is empty or skipped (${awardOnly})`, async () => {
      let loggedError: string | undefined;
      let cashCalls = 0;
      const tool = createFlightSearchTool(dependencies({
        searchAwardTrips: quotaError,
        searchDuffel: async () => { cashCalls++; return []; },
        logFailedSearch: async (entry) => { loggedError = entry.errorType; },
      }));
      const result = String(await tool.execute!({ ...params, awardOnly }, options()));
      assert.match(result, /## Prämiensuche heute ausgelastet/);
      assert.match(result, /Die Prämiensuche ist für heute ausgelastet. Ab 02:00 Uhr/);
      assert.match(result, /Später erneut suchen/);
      assert.match(result, /Barpreise über die Links unten vergleichen/);
      assert.doesNotMatch(result, /seats\.aero|vorübergehend|Minuten warten/i);
      assert.equal(loggedError, 'rate_limited');
      assert.equal(cashCalls, awardOnly ? 0 : 1);
    });
  }

  it('reports quota exhaustion when the cash provider also fails', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: quotaError, searchDuffel: async () => { throw new Error('offline'); } }));
    const result = String(await tool.execute!(params, options()));
    assert.match(result, /## Prämiensuche heute ausgelastet/);
    assert.match(result, /02:00/);
  });

  it('keeps cash results and explains the exhausted award search', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: quotaError }));
    const result = String(await tool.execute!(params, options()));
    assert.match(result, /Flüge mit Barzahlung/);
    assert.match(result, /ausgelastet/);
    assert.match(result, /02:00 Uhr/);
    assert.doesNotMatch(result, /vorübergehend|seats\.aero/i);
  });

  it('localizes the daily limit in English', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: quotaError, searchDuffel: async () => [] }));
    const result = String(await tool.execute!(params, options('en')));
    assert.match(result, /## Award search at its daily limit/);
    assert.match(result, /daily limit.*02:00/);
    assert.match(result, /Compare cash fares/);
  });

  it('includes the notice in flexible-date cash results', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: quotaError, searchDuffelFlexibleDates: async () => [cashFlight] }));
    const result = String(await tool.execute!({ ...params, flexibility: 3 }, options()));
    const data: { type: string; awardNotice: string; cashFlights: unknown[] } = JSON.parse(result);
    assert.equal(data.type, 'flexible_date_results');
    assert.equal(data.cashFlights.length, 1);
    assert.match(data.awardNotice, /ausgelastet.*02:00 Uhr/);
  });

  for (const failedLeg of ['FRA', 'JFK']) {
    it(`keeps the successful award leg when ${failedLeg} is quota-limited`, async () => {
      const tool = createFlightSearchTool(dependencies({
        searchAwardTrips: async ({ origin }) => origin === failedLeg ? quotaError() : [awardFlight],
        searchDuffel: async () => [],
      }));
      const result = String(await tool.execute!({ ...params, returnDate: futureDate }, options()));
      assert.match(result, /Flüge mit Meilen/);
      assert.match(result, /ausgelastet.*02:00 Uhr/);
      assert.doesNotMatch(result, /vorübergehend/);
      if (failedLeg === 'JFK') {
        assert.match(result, /Rückflug nicht geprüft/);
        assert.ok(
          result.indexOf('Flüge mit Meilen') < result.indexOf('ausgelastet'),
          'return-leg quota notice sits in the award section, not above the outbound table',
        );
      }
    });
  }

  it('keeps no_results when only the return award leg fails generically', async () => {
    let loggedError: string | undefined;
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async ({ origin }) => {
        if (origin === 'JFK') throw new Error('Seats.aero API error: 500');
        return [];
      },
      searchDuffel: async () => [],
      logFailedSearch: async (entry) => { loggedError = entry.errorType; },
    }));
    const result = String(await tool.execute!({ ...params, returnDate: futureDate }, options()));
    assert.equal(loggedError, 'no_results');
    assert.doesNotMatch(result, /vorübergehend eingeschränkt/);
  });

  it('recognizes a quota-limited return leg when outbound and cash have no results', async () => {
    const tool = createFlightSearchTool(dependencies({
      searchAwardTrips: async ({ origin }) => origin === 'JFK' ? quotaError() : [],
      searchDuffel: async () => [],
    }));
    const result = String(await tool.execute!({ ...params, returnDate: futureDate }, options()));
    assert.match(result, /## Prämiensuche heute ausgelastet/);
    assert.match(result, /02:00 Uhr/);
  });
});

describe('MYLO-68 direct priority through chat presentation', () => {
  it('keeps one-stop awards and exposes the no-direct notice in both output paths', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: async () => [
      { ...awardFlight, totalStops: 1, outbound: { ...awardFlight.outbound, stops: '1 stop' } },
    ] }));
    const markdown = String(await tool.execute!({ ...params, nonStop: true, awardOnly: true }, executeOptions()));
    assert.match(markdown, /no direct flights in Business/);
    assert.match(markdown, /1 stop/);
    const flex = JSON.parse(String(await tool.execute!({ ...params, nonStop: true, flexibility: 3 }, executeOptions())));
    assert.match(flex.awardNotice, /best options with 1 stop/);
    assert.equal(flex.awardFlights.length, 1);
  });
  it('keeps an expensive direct flight ahead of five cheaper connections after the flex cap', async () => {
    const tool = createFlightSearchTool(dependencies({ searchAwardTrips: async () => [
      ...Array.from({ length: 6 }, (_, index) => ({ ...awardFlight, id: `connection-${index}`, totalStops: 1,
        program: index < 3 ? 'united' : 'aeroplan', miles: 40000 + index, price: `${40000 + index} miles` })),
      { ...awardFlight, id: 'expensive-direct', miles: 90000, price: '90,000 miles' },
    ] }));
    const flex = JSON.parse(String(await tool.execute!({ ...params, nonStop: true, flexibility: 3 }, executeOptions())));
    assert.equal(flex.awardFlights.length, 5);
    assert.equal(flex.awardFlights[0].id, 'expensive-direct');
    assert.equal(flex.awardFlights[0].totalStops, 0);
  });
  it('preserves the successful-search branch when the tax filter removes all awards', async () => {
    const tool = createFlightSearchTool(dependencies());
    const output = String(await tool.execute!({ ...params, awardOnly: true, maxTaxes: 0 }, executeOptions()));
    assert.doesNotMatch(output, /no_results_offer_flexible/);
    assert.match(output, /limit filtered out every result/);
  });
});

it('keeps the chat flex return decision separate from the Duffel roundtrip request', async () => {
  let awardCalls = 0;
  let cashReturn: string | null | undefined;
  const tool = createFlightSearchTool(dependencies({
    searchAwardTrips: async () => { awardCalls++; return [awardFlight]; },
    searchDuffelFlexibleDates: async (request) => { cashReturn = request.returnDate; return []; },
  }));
  await tool.execute!({ ...params, flexibility: 3, returnDate: futureDate }, executeOptions());
  assert.equal(awardCalls, 1);
  assert.equal(cashReturn, futureDate);
});
