/**
 * MYLO-25: Locale-Auflösung und Flex-Trigger des flight-search-Tools.
 *
 * Das Tool bezog seine Locale bisher aus einer hart kodierten Konstante
 * ('de'), obwohl flightI18n Englisch vollständig unterstützt. Zusätzlich
 * existierte ein toter String-Match (`fullQuery.includes('flexiblen Daten')`)
 * als scheinbarer Flex-Trigger. Diese Tests pinnen den Vertrag am
 * öffentlichen Seam flightSearchTool.execute():
 * - experimental_context.locale = 'en' → englische Ausgaben
 * - kein locale im Kontext → 'de' (Rückwärtskompatibilität)
 * - Flex-Suche triggert ausschließlich über params.flexibility > 0
 *
 * Der Test verwendet den dependency-injizierten Tool-Factory-Seam und lädt
 * deshalb weder Provider-SDKs noch den Server-Env-Graphen.
 */

import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import type {
  SeatsAeroFlight,
  SeatsAeroSearchParams,
} from '@/lib/api/seats-aero-client';
import type { DuffelSearchParams } from '@/lib/api/duffel-client';
import {
  createFlightSearchTool,
  type FlightSearchToolDependencies,
} from './flight-search-tool';

interface DuffelFlexibleCall {
  params: DuffelSearchParams;
  days: number;
}

const calls = {
  seatsAero: [] as SeatsAeroSearchParams[],
  duffel: [] as DuffelSearchParams[],
  duffelFlexible: [] as DuffelFlexibleCall[],
};

let seatsAeroResult: SeatsAeroFlight[] = [];

const dependencies: FlightSearchToolDependencies = {
  searchSeatsAero: async (params) => {
    calls.seatsAero.push(params);
    return seatsAeroResult;
  },
  searchDuffel: async (params) => {
    calls.duffel.push(params);
    return [];
  },
  searchDuffelFlexibleDates: async (params, days = 3) => {
    calls.duffelFlexible.push({ params, days });
    return [];
  },
  mapCabinClass: (cabin) => {
    switch (cabin) {
      case 'PREMIUM_ECONOMY':
        return 'premium_economy';
      case 'BUSINESS':
        return 'business';
      case 'FIRST':
        return 'first';
      default:
        return 'economy';
    }
  },
  getNearbyAirports: async () => [],
  mergeSessionState: async () => {},
  resolveIATACode: async (input) => input.toUpperCase(),
  resolveAirportCodesWithLLM: async () => ({
    origin: { code: 'FRA', name: 'Frankfurt Airport' },
    destination: { code: 'JFK', name: 'John F. Kennedy International' },
  }),
  createDuffelBookingSession: async () => ({
    url: 'https://links.duffel.com/test',
  }),
  logFailedSearch: async () => {},
};

const flightSearchTool = createFlightSearchTool(dependencies);

const futureDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
})();

const baseParams = {
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

const pastParams = { ...baseParams, departDate: '2020-01-01' };

function makeAwardFlight() {
  return {
    id: 'award-1',
    program: 'aeroplan',
    airline: 'KLM',
    cabin: 'Business',
    price: '70,000 miles + USD 328.33',
    pricePerPerson: '70,000 miles + USD 328.33',
    tags: [],
    totalStops: 0,
    miles: 70_000,
    taxes: { amount: 328.33, currency: 'USD' },
    seatsLeft: 4,
    outbound: {
      departure: { airport: 'FRA', time: `${futureDate}T12:15:00.000Z` },
      arrival: { airport: 'JFK', time: `${futureDate}T16:35:00.000Z` },
      duration: '8h 20m',
      stops: 'Nonstop',
      flightNumbers: 'KL1816',
    },
  } satisfies SeatsAeroFlight;
}

type ExecuteCallOptions = Parameters<
  NonNullable<typeof flightSearchTool.execute>
>[1];

function callOptions(locale?: string) {
  return {
    toolCallId: 'test-call',
    messages: [],
    experimental_context: {
      chatId: 'chat-1',
      userId: 'user-1',
      ...(locale ? { locale } : {}),
    },
  } as ExecuteCallOptions;
}

beforeEach(() => {
  calls.seatsAero.length = 0;
  calls.duffel.length = 0;
  calls.duffelFlexible.length = 0;
  seatsAeroResult = [];
});

describe('flight-search locale resolution', () => {
  it('returns English validation errors when experimental_context.locale is "en"', async () => {
    await assert.rejects(
      () => flightSearchTool.execute!(pastParams, callOptions('en')) as Promise<unknown>,
      (error: Error) => {
        assert.match(error.message, /is in the past/);
        assert.doesNotMatch(error.message, /Vergangenheit/);
        return true;
      },
    );
  });

  it('keeps German validation errors when experimental_context.locale is "de"', async () => {
    await assert.rejects(
      () => flightSearchTool.execute!(pastParams, callOptions('de')) as Promise<unknown>,
      (error: Error) => {
        assert.match(error.message, /liegt in der Vergangenheit/);
        return true;
      },
    );
  });

  it('defaults to German when the context carries no locale (backward compatibility)', async () => {
    await assert.rejects(
      () => flightSearchTool.execute!(pastParams, callOptions()) as Promise<unknown>,
      (error: Error) => {
        assert.match(error.message, /liegt in der Vergangenheit/);
        return true;
      },
    );
  });

  it('falls back to German when the context carries an unknown locale', async () => {
    await assert.rejects(
      () => flightSearchTool.execute!(pastParams, callOptions('fr')) as Promise<unknown>,
      (error: Error) => {
        assert.match(error.message, /liegt in der Vergangenheit/);
        assert.doesNotMatch(error.message, /is in the past/);
        return true;
      },
    );
  });

  it('renders English result tables when locale is "en"', async () => {
    seatsAeroResult = [makeAwardFlight()];

    const result = await flightSearchTool.execute!(baseParams, callOptions('en'));

    assert.ok(typeof result === 'string');
    assert.match(result, /Flights with Miles\/Points/);
    assert.doesNotMatch(result, /Flüge mit Meilen\/Punkten/);
  });

  it('renders German result tables without a locale in the context', async () => {
    seatsAeroResult = [makeAwardFlight()];

    const result = await flightSearchTool.execute!(baseParams, callOptions());

    assert.ok(typeof result === 'string');
    assert.match(result, /Flüge mit Meilen\/Punkten/);
  });
});

describe('flight-search flexible-date trigger', () => {
  it('triggers the flexible search path solely via params.flexibility > 0', async () => {
    const result = await flightSearchTool.execute!(
      { ...baseParams, flexibility: 2 },
      callOptions(),
    );

    assert.strictEqual(calls.seatsAero.length, 1);
    assert.strictEqual(calls.seatsAero[0].flexibility, 3, 'flexible search widens Seats.aero to 3 days');
    assert.strictEqual(calls.duffelFlexible.length, 1, 'flexible search uses searchDuffelFlexibleDates');
    assert.strictEqual(calls.duffel.length, 0);
    assert.ok(typeof result === 'string');
    assert.doesNotMatch(
      result,
      /"type":"no_results_offer_flexible"/,
      'a completed flexible search must not offer the same fallback again',
    );
  });

  it('runs a normal search when flexibility is 0', async () => {
    const result = await flightSearchTool.execute!(baseParams, callOptions());

    assert.strictEqual(calls.seatsAero.length, 1);
    assert.strictEqual(calls.seatsAero[0].flexibility, 0);
    assert.strictEqual(calls.duffel.length, 1, 'non-flexible search uses searchDuffel');
    assert.strictEqual(calls.duffelFlexible.length, 0);
    assert.ok(typeof result === 'string');
    assert.match(
      result,
      /"type":"no_results_offer_flexible"/,
      'a normal no-results search must offer the flexible-date retry',
    );
  });
});
