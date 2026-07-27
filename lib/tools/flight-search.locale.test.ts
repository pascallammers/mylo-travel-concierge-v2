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
 * Braucht --experimental-test-module-mocks (im test-Script gesetzt).
 * SKIP_ENV_VALIDATION muss vor dem dynamischen Import gesetzt sein, weil der
 * Tool-Entry-Point den Server-Env-Graphen zieht.
 */

import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

process.env.SKIP_ENV_VALIDATION = '1';

const calls = {
  seatsAero: [] as any[],
  duffel: [] as any[],
  duffelFlexible: [] as any[],
};

let seatsAeroResult: any[] = [];

mock.module('@/lib/api/seats-aero-client', {
  namedExports: {
    searchSeatsAero: async (params: any) => {
      calls.seatsAero.push(params);
      return seatsAeroResult;
    },
  },
});
mock.module('@/lib/api/duffel-client', {
  namedExports: {
    searchDuffel: async (params: any) => {
      calls.duffel.push(params);
      return [];
    },
    searchDuffelFlexibleDates: async (params: any, days: number) => {
      calls.duffelFlexible.push({ params, days });
      return [];
    },
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
    resolveIATACode: async (input: string) => input.toUpperCase(),
    resolveAirportCodesWithLLM: async () => ({
      origin: { code: 'FRA', name: 'Frankfurt Airport' },
      destination: { code: 'JFK', name: 'John F. Kennedy International' },
    }),
  },
});
mock.module('@/lib/utils/duffel-links', {
  namedExports: {
    createDuffelBookingSession: async () => ({ url: 'https://links.duffel.com/test' }),
  },
});

const { flightSearchTool } = await import('./flight-search');

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
    program: 'aeroplan',
    airline: 'KLM',
    cabin: 'Business',
    price: '70,000 miles + USD 328.33',
    seatsLeft: 4,
    outbound: {
      departure: { airport: 'FRA', time: `${futureDate}T12:15:00.000Z` },
      arrival: { airport: 'JFK', time: `${futureDate}T16:35:00.000Z` },
      duration: '8h 20m',
      stops: 'Nonstop',
      flightNumbers: 'KL1816',
    },
  };
}

function callOptions(locale?: string) {
  return {
    toolCallId: 'test-call',
    messages: [],
    experimental_context: {
      chatId: 'chat-1',
      userId: 'user-1',
      ...(locale ? { locale } : {}),
    },
  } as any;
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
    await flightSearchTool.execute!({ ...baseParams, flexibility: 2 }, callOptions());

    assert.strictEqual(calls.seatsAero.length, 1);
    assert.strictEqual(calls.seatsAero[0].flexibility, 3, 'flexible search widens Seats.aero to 3 days');
    assert.strictEqual(calls.duffelFlexible.length, 1, 'flexible search uses searchDuffelFlexibleDates');
    assert.strictEqual(calls.duffel.length, 0);
  });

  it('runs a normal search when flexibility is 0', async () => {
    await flightSearchTool.execute!(baseParams, callOptions());

    assert.strictEqual(calls.seatsAero.length, 1);
    assert.strictEqual(calls.seatsAero[0].flexibility, 0);
    assert.strictEqual(calls.duffel.length, 1, 'non-flexible search uses searchDuffel');
    assert.strictEqual(calls.duffelFlexible.length, 0);
  });
});
