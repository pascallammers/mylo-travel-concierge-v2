/**
 * Unit tests for formatFlightResults — the LLM-facing markdown renderer.
 *
 * These tests pin down the contract that prevents the Test 1 hallucination class
 * (LLM relabeling [Google] -> [Google Flights] and inventing
 * [Duffel API](https://duffel.com) per row when duffelBookingUrl is null).
 *
 * The contract:
 * 1. Both award and cash tables avoid internal provider names in customer-facing
 *    markdown.
 * 2. When duffelBookingUrl is null, the cash table emits an explicit
 *    "Direct booking unavailable" hint instead of leaving silent space the
 *    LLM will pad.
 * 3. The output never contains the corporate https://duffel.com fallback,
 *    so a hallucinated copy of it stands out trivially in QA.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  getProgramBookingUrl,
  getProgramCaveat,
  getProgramDisplayName,
} from '@/lib/api/award-search/program-registry';
import {
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
} from '@/lib/config/transfer-engine';
import { formatFlightResults } from './flight-search-format';

const awardProgramDeps = {
  getProgramDisplayName,
  getProgramBookingUrl,
  getProgramCaveat,
};

const awardProgramDepsWithTransfers = {
  ...awardProgramDeps,
  transferHints: {
    formatTransferRatio,
    getTransferSourcesForAwardProgram,
  },
};

const baseParams = {
  origin: 'FRA',
  destination: 'JFK',
  departDate: '2026-06-15',
  returnDate: undefined,
  cabin: 'ECONOMY' as const,
  passengers: 1,
};

function makeAwardResult() {
  return {
    seats: {
      count: 1,
      flights: [
        {
          program: 'aeroplan',
          airline: 'KLM',
          cabin: 'Economy',
          price: '18,750 miles + USD 328.33',
          seatsLeft: 9,
          outbound: {
            departure: { airport: 'FRA', time: '2026-06-15T12:15:00.000Z' },
            arrival: { airport: 'JFK', time: '2026-06-15T16:35:00.000Z' },
            duration: '10h 20m',
            stops: '1 stop',
            flightNumbers: 'KL1816, KL641',
          },
        },
      ],
    },
    cash: { count: 0, flights: [] },
  };
}

function makeCashResult() {
  return {
    seats: { count: 0, flights: [] },
    cash: {
      count: 1,
      flights: [
        {
          airline: 'Singapore Airlines',
          price: { total: '414.76', currency: 'USD' },
          departure: { airport: 'FRA', time: '2026-06-15T08:35:00.000Z' },
          arrival: { airport: 'JFK', time: '2026-06-15T11:10:00.000Z' },
          duration: '8h 35m',
          stops: 0,
        },
      ],
    },
  };
}

describe('formatFlightResults', () => {
  describe('internal provider names', () => {
    it('award table exposes a mileage-program column, never the Seats.aero vendor', async () => {
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de', awardProgramDeps);
      const headerLine = out.split('\n').find((l) => l.includes('Airline')) ?? '';
      // The program (Source) is the bookable currency and MUST be shown...
      assert.match(headerLine, /Programm/, 'award header must include a Programm column');
      // ...resolved to the customer-facing brand name, not the raw slug.
      assert.match(out, /Air Canada Aeroplan/, 'program slug must render as a display name');
      // The raw slug must not leak as visible text. Link TARGETS are exempt:
      // Air Canada's own booking URL legitimately contains /aeroplan/.
      const visibleText = out.replace(/\]\([^)]*\)/g, ']');
      assert.doesNotMatch(visibleText, /aeroplan/, 'raw program slug must not leak as visible text');
      // The data vendor itself stays hidden.
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'award table must not expose a vendor source column');
      assert.doesNotMatch(out, /Seats\.aero/i);
    });

    it('cash table does not expose Duffel to end users', async () => {
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', awardProgramDeps);
      const cashSection = out.split('## ').find((s) => /Cash|Barzahlung/i.test(s)) ?? '';
      const headerLine = cashSection.split('\n').find((l) => l.includes('Airline')) ?? '';
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'cash table must not expose a source column');
      assert.doesNotMatch(cashSection, /Duffel/i);
    });
  });

  describe('null Duffel booking URL hint', () => {
    it('emits an explicit "Direct booking unavailable" / "keine Direktbuchung" hint when no booking session', async () => {
      const out = await formatFlightResults(makeCashResult(), baseParams, 'en', awardProgramDeps);
      // Direct-booking hint must appear somewhere in the rendered output so the
      // LLM has no gap to pad with a fabricated link.
      assert.match(out, /direct booking unavailable|keine direktbuchung/i);
    });

    it('does NOT contain the corporate https://duffel.com URL (only real booking-session URLs)', async () => {
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', awardProgramDeps);
      assert.doesNotMatch(out, /https:\/\/duffel\.com(?:[\s)]|$)/, 'corporate duffel.com link must never appear');
      assert.doesNotMatch(out, /\[Duffel API\]/, 'fabricated [Duffel API] label must never appear');
    });

    it('falls back to the unavailable hint when the injected creator throws', async () => {
      const failingCreator = async () => {
        throw new Error('Duffel Payments not enabled');
      };
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', {
        ...awardProgramDeps,
        createBookingSession: failingCreator,
      });
      assert.match(out, /keine direktbuchung/i);
      assert.doesNotMatch(out, /\[Buchen\]/);
    });
  });

  describe('award booking links (MYLO-16)', () => {
    it('award table header ends with a Buchen column and a matching separator', async () => {
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de', awardProgramDeps);
      const lines = out.split('\n');
      const headerIdx = lines.findIndex((l) => l.includes('Programm'));
      const headerLine = lines[headerIdx] ?? '';
      const separatorLine = lines[headerIdx + 1] ?? '';
      assert.match(headerLine, /\| Buchen \|$/, 'award header must end with a Buchen column');
      assert.strictEqual(
        separatorLine.split('|').length,
        headerLine.split('|').length,
        'separator row must have as many cells as the header',
      );
    });

    it('each award row links to the mileage program booking page for the searched route/date', async () => {
      const params = { ...baseParams, departDate: '2026-06-10' };
      const out = await formatFlightResults(makeAwardResult(), params, 'de', awardProgramDeps);
      // aeroplan supports a prefilled deeplink: route + flight date must be in it.
      // params.departDate differs from the flight date so a fallback would fail.
      assert.match(
        out,
        /\[Buchen\]\(https:\/\/www\.aircanada\.com\/aeroplan\/redeem\/availability\/outbound\?org0=FRA&dest0=JFK&departureDate0=2026-06-15[^)]*\)/,
        'award row must carry the aeroplan deeplink with route and date prefilled',
      );
      assert.doesNotMatch(out, /departureDate0=2026-06-10/, 'deeplink must use the flight date, not params.departDate');
      assert.doesNotMatch(out, /seats\.aero/i, 'no booking link may point at seats.aero');
    });

    it('passes the award flight cabin to the booking URL resolver', async () => {
      let receivedCabin: string | undefined;
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de', {
        getProgramDisplayName,
        getProgramCaveat,
        getProgramBookingUrl: (_slug, ctx) => {
          receivedCabin = ctx.cabin;
          return 'https://booking.example.com/award';
        },
      });

      assert.strictEqual(receivedCabin, 'Economy');
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/award\)/);
    });

    it('renders the en locale with a Book column and label', async () => {
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'en', awardProgramDeps);
      const headerLine = out.split('\n').find((l) => l.includes('Program')) ?? '';
      assert.match(headerLine, /\| Book \|$/);
      assert.match(out, /\[Book\]\(https:\/\/www\.aircanada\.com\//);
    });

    it('renders a dash instead of a fabricated link for an unknown program', async () => {
      const result = makeAwardResult();
      result.seats.flights[0].program = 'madeupprogram';
      const out = await formatFlightResults(result, baseParams, 'de', awardProgramDeps);
      assert.doesNotMatch(out, /\[Buchen\]/, 'unknown program must not get a booking link');
      assert.match(out, /\| - \|$/m, 'unknown program row must end with a dash cell');
    });
  });

  describe('program caveat footnotes (MYLO-17)', () => {
    function makeAwardResultWithPrograms(programs: string[]) {
      const base = makeAwardResult();
      const template = base.seats.flights[0];
      return {
        ...base,
        seats: {
          count: programs.length,
          flights: programs.map((program) => ({ ...template, program })),
        },
      };
    }

    it('renders the KrisFlyer search-lock footnote when a singapore row is present', async () => {
      const out = await formatFlightResults(
        makeAwardResultWithPrograms(['singapore', 'aeroplan']),
        baseParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /Singapore Airlines KrisFlyer.*1\.000 Meilen/s);
      assert.match(out, /Marriott Bonvoy/);
      // Footnote must come AFTER the award table rows, not inside them.
      const lastRowIdx = out.lastIndexOf('| KL1816');
      assert.ok(out.indexOf('Marriott Bonvoy') > lastRowIdx, 'caveat must render below the table');
    });

    it('renders the Emirates login/checkbox footnote when an emirates row is present', async () => {
      const out = await formatFlightResults(
        makeAwardResultWithPrograms(['emirates']),
        baseParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /Classic Rewards/);
      assert.match(out, /Search partner flights only/);
    });

    it('renders each program caveat only once even with multiple rows of that program', async () => {
      const out = await formatFlightResults(
        makeAwardResultWithPrograms(['singapore', 'singapore', 'singapore']),
        baseParams,
        'de',
        awardProgramDeps,
      );
      assert.strictEqual(out.match(/Marriott Bonvoy/g)?.length, 1, 'caveat must render exactly once');
    });

    it('leaves results without caveat programs unchanged (no footnote block)', async () => {
      const out = await formatFlightResults(
        makeAwardResultWithPrograms(['aeroplan', 'lufthansa']),
        baseParams,
        'de',
        awardProgramDeps,
      );
      assert.doesNotMatch(out, /KrisFlyer-Website|Classic Rewards|Marriott Bonvoy/);
    });

    it('localizes the footnote in the en locale', async () => {
      const out = await formatFlightResults(
        makeAwardResultWithPrograms(['singapore']),
        baseParams,
        'en',
        awardProgramDeps,
      );
      assert.match(out, /1,000 miles/);
      assert.doesNotMatch(out, /1\.000 Meilen/);
    });
  });

  describe('transfer hint under the award table (MYLO-22)', () => {
    it('explains that miles can be transferred at booking time', async () => {
      const deOut = await formatFlightResults(
        makeAwardResult(),
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.match(deOut, /noch nicht haben/i);
      assert.match(deOut, /Transfer.*Buchung/i);

      const enOut = await formatFlightResults(
        makeAwardResult(),
        baseParams,
        'en',
        awardProgramDepsWithTransfers,
      );
      assert.match(enOut, /don't need to have these miles yet/i);
      assert.match(enOut, /only necessary when you book/i);
    });

    it('does not show the hint for cash-only results', async () => {
      const out = await formatFlightResults(
        makeCashResult(),
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.doesNotMatch(out, /noch nicht haben/i);
    });

    it('pins DACH first and caps each program at three sources', async () => {
      const result = makeAwardResult();
      result.seats.count = 2;
      result.seats.flights.push({
        ...result.seats.flights[0],
        program: 'flyingblue',
      });
      const out = await formatFlightResults(
        result,
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      const line =
        out.split('\n').find((entry) => entry.startsWith('- **Flying Blue')) ??
        '';
      assert.match(line, /Amex Membership Rewards \(DACH\) 5:4/);
      assert.match(line, /Amex Membership Rewards \(US\) 1:1/);
      assert.ok(
        line.indexOf('Amex Membership Rewards (DACH)') <
          line.indexOf('Amex Membership Rewards (US)'),
      );
      assert.doesNotMatch(line, /Bilt|Capital One|Citi/);
    });

    it('deduplicates programs and omits unknown transfer routes', async () => {
      const duplicateResult = makeAwardResult();
      duplicateResult.seats.count = 2;
      duplicateResult.seats.flights.push({
        ...duplicateResult.seats.flights[0],
      });
      const duplicateOut = await formatFlightResults(
        duplicateResult,
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.strictEqual(
        duplicateOut
          .split('\n')
          .filter((line) => line.startsWith('- **Air Canada Aeroplan')).length,
        1,
      );

      const unsupportedResult = makeAwardResult();
      unsupportedResult.seats.flights[0].program = 'smiles';
      const unsupportedOut = await formatFlightResults(
        unsupportedResult,
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.match(unsupportedOut, /noch nicht haben/i);
      assert.doesNotMatch(unsupportedOut, /^- \*\*GOL Smiles/m);
    });

    it('marks the indirect Miles & More route via PAYBACK in both locales', async () => {
      const result = makeAwardResult();
      result.seats.flights[0].program = 'lufthansa';
      const deOut = await formatFlightResults(
        result,
        baseParams,
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.match(deOut, /Lufthansa Miles & More.*über PAYBACK/);

      const enOut = await formatFlightResults(
        result,
        baseParams,
        'en',
        awardProgramDepsWithTransfers,
      );
      assert.match(enOut, /Lufthansa Miles & More.*via PAYBACK/);
    });

    it('includes return-leg programs in the transfer sources', async () => {
      const result = {
        ...makeAwardResult(),
        seatsReturn: {
          count: 1,
          error: false,
          flights: [
            {
              ...makeAwardResult().seats.flights[0],
              program: 'flyingblue',
              outbound: {
                ...makeAwardResult().seats.flights[0].outbound,
                departure: {
                  airport: 'JFK',
                  time: '2026-06-22T18:00:00.000Z',
                },
                arrival: {
                  airport: 'FRA',
                  time: '2026-06-23T07:30:00.000Z',
                },
              },
            },
          ],
        },
      };
      const out = await formatFlightResults(
        result,
        { ...baseParams, returnDate: '2026-06-22' },
        'de',
        awardProgramDepsWithTransfers,
      );
      assert.match(out, /^- \*\*Air Canada Aeroplan\*\*:/m);
      assert.match(out, /^- \*\*Flying Blue \(Air France\/KLM\)\*\*:/m);
    });
  });

  describe('roundtrip award rendering (MYLO-21)', () => {
    const roundtripParams = {
      ...baseParams,
      returnDate: '2026-06-22',
    };

    function makeRoundtripAwardResult() {
      return {
        ...makeAwardResult(),
        seatsReturn: {
          count: 1,
          error: false,
          flights: [
            {
              program: 'united',
              airline: 'UA',
              cabin: 'Economy',
              price: '30,000 miles + USD 5.60',
              seatsLeft: 4,
              outbound: {
                departure: {
                  airport: 'JFK',
                  time: '2026-06-22T18:00:00.000Z',
                },
                arrival: {
                  airport: 'FRA',
                  time: '2026-06-23T07:30:00.000Z',
                },
                duration: '7h 30m',
                stops: 'Nonstop',
                flightNumbers: 'UA960',
              },
            },
          ],
        },
      };
    }

    it('flags outbound-only mileage prices for roundtrips without return awards', async () => {
      const out = await formatFlightResults(
        makeAwardResult(),
        roundtripParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /pro Strecke \(nur Hinflug\)/i);
      assert.match(out, /Rückflug.*nicht enthalten/i);
    });

    it('does not show the outbound-only notice for a one-way search', async () => {
      const out = await formatFlightResults(
        makeAwardResult(),
        baseParams,
        'de',
        awardProgramDeps,
      );
      assert.doesNotMatch(out, /pro Strecke \(nur Hinflug\)/i);
    });

    it('renders both award legs with booking links and localized headings', async () => {
      const result = makeRoundtripAwardResult();
      const out = await formatFlightResults(
        result,
        roundtripParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /### Hinflug \(1 Ergebnisse\)/);
      assert.match(out, /### Rückflug \(1 Ergebnisse\)/);
      assert.match(out, /United MileagePlus/);
      assert.match(out, /UA960/);
      assert.match(out, /\[Buchen\]\(https:\/\/www\.united\.com\//);
      assert.strictEqual(
        out.split('\n').filter((line) => line.includes('| Programm |')).length,
        2,
      );

      const enOut = await formatFlightResults(
        result,
        roundtripParams,
        'en',
        awardProgramDeps,
      );
      assert.match(enOut, /### Outbound \(1 results\)/);
      assert.match(enOut, /### Return \(1 results\)/);
    });

    it('uses per-leg wording once return awards are available', async () => {
      const out = await formatFlightResults(
        makeRoundtripAwardResult(),
        roundtripParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /jeweils pro Strecke/i);
      assert.doesNotMatch(out, /nicht enthalten/i);
    });

    it('keeps the return table when outbound awards are unavailable', async () => {
      const result = {
        ...makeRoundtripAwardResult(),
        seats: { count: 0, flights: [], error: false },
        cash: { count: 0, flights: [] },
      };
      const out = await formatFlightResults(
        result,
        roundtripParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /Hinflug.*keine Award-Verfügbarkeit/i);
      assert.match(out, /### Rückflug \(1 Ergebnisse\)/);
      assert.doesNotMatch(out, /keine Flüge für Ihre Suche gefunden/i);
    });

    it('distinguishes an outbound provider error from no availability', async () => {
      const result = {
        ...makeRoundtripAwardResult(),
        seats: { count: 0, flights: [], error: true },
        cash: { count: 0, flights: [] },
        searchLinkParams: {
          origin: 'FRA',
          destination: 'JFK',
          departDate: '2026-06-15',
          returnDate: '2026-06-22',
          cabin: 'ECONOMY',
          passengers: 1,
        },
      };
      const out = await formatFlightResults(
        result,
        roundtripParams,
        'de',
        awardProgramDeps,
      );
      assert.match(out, /Award-Verfügbarkeit.*Hinflug.*nicht geladen/i);
      assert.doesNotMatch(out, /Hinflug.*keine Award-Verfügbarkeit/i);
      assert.match(out, /Meilen\/Punkte-Flüge konnten nicht geladen werden/i);
    });
  });

  describe('happy-path with injected booking-session creator', () => {
    it('renders the [Buchen] link when the creator returns a real booking URL', async () => {
      const creator = async () => ({ url: 'https://booking.example.com/abc123' });
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', {
        ...awardProgramDeps,
        createBookingSession: creator,
      });
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/abc123\)/);
      assert.doesNotMatch(out, /keine direktbuchung/i);
    });
  });
});
