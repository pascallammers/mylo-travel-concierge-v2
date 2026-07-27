import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { DuffelFlight } from '@/lib/api/duffel-client';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
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
    searchSeatsAero: async () => [awardFlight],
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
      searchSeatsAero: async () => {
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
      searchSeatsAero: async () => {
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
      searchSeatsAero: async () => {
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
      searchSeatsAero: async () => awards,
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
});
