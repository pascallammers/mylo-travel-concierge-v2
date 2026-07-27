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

import { formatFlightResults } from './flight-search-format';
import {
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
} from '@/lib/config/transfer-engine';

const transferHintDependencies = {
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
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

type TestFlightResult =
  | ReturnType<typeof makeAwardResult>
  | ReturnType<typeof makeCashResult>;

function formatTestResult(
  result: TestFlightResult,
  locale: 'de' | 'en',
  createBookingSession?: Parameters<typeof formatFlightResults>[3],
) {
  return formatFlightResults(
    result,
    baseParams,
    locale,
    createBookingSession,
    transferHintDependencies,
  );
}

describe('formatFlightResults', () => {
  describe('internal provider names', () => {
    it('award table exposes a mileage-program column, never the Seats.aero vendor', async () => {
      const out = await formatTestResult(makeAwardResult(), 'de');
      const headerLine = out.split('\n').find((l) => l.includes('Airline')) ?? '';
      // The program (Source) is the bookable currency and MUST be shown...
      assert.match(headerLine, /Programm/, 'award header must include a Programm column');
      // ...resolved to the customer-facing brand name, not the raw slug.
      assert.match(out, /Air Canada Aeroplan/, 'program slug must render as a display name');
      assert.doesNotMatch(out, /aeroplan/, 'raw program slug must not leak');
      // The data vendor itself stays hidden.
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'award table must not expose a vendor source column');
      assert.doesNotMatch(out, /Seats\.aero/i);
    });

    it('cash table does not expose Duffel to end users', async () => {
      const out = await formatTestResult(makeCashResult(), 'de');
      const cashSection = out.split('## ').find((s) => /Cash|Barzahlung/i.test(s)) ?? '';
      const headerLine = cashSection.split('\n').find((l) => l.includes('Airline')) ?? '';
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'cash table must not expose a source column');
      assert.doesNotMatch(cashSection, /Duffel/i);
    });
  });

  describe('null Duffel booking URL hint', () => {
    it('emits an explicit "Direct booking unavailable" / "keine Direktbuchung" hint when no booking session', async () => {
      const out = await formatTestResult(makeCashResult(), 'en');
      // Direct-booking hint must appear somewhere in the rendered output so the
      // LLM has no gap to pad with a fabricated link.
      assert.match(out, /direct booking unavailable|keine direktbuchung/i);
    });

    it('does NOT contain the corporate https://duffel.com URL (only real booking-session URLs)', async () => {
      const out = await formatTestResult(makeCashResult(), 'de');
      assert.doesNotMatch(out, /https:\/\/duffel\.com(?:[\s)]|$)/, 'corporate duffel.com link must never appear');
      assert.doesNotMatch(out, /\[Duffel API\]/, 'fabricated [Duffel API] label must never appear');
    });

    it('falls back to the unavailable hint when the injected creator throws', async () => {
      const failingCreator = async () => {
        throw new Error('Duffel Payments not enabled');
      };
      const out = await formatTestResult(makeCashResult(), 'de', failingCreator);
      assert.match(out, /keine direktbuchung/i);
      assert.doesNotMatch(out, /\[Buchen\]/);
    });
  });

  describe('transfer hint under the award table (MYLO-22)', () => {
    it('shows the "miles not needed yet — transfer at booking" principle when award results exist (de)', async () => {
      const out = await formatTestResult(makeAwardResult(), 'de');
      // The community "Jonas" case was caused by users assuming they must
      // already own the miles. The hint must state the opposite up front.
      assert.match(out, /noch nicht (haben|besitzen)/i, 'must state the miles are not needed yet');
      assert.match(out, /Transfer.*(Buchung|buchst)/i, 'must explain transfer happens at booking');
    });

    it('does NOT show the transfer hint when there are no award results (cash only)', async () => {
      const out = await formatTestResult(makeCashResult(), 'de');
      assert.doesNotMatch(out, /noch nicht (haben|besitzen)/i, 'hint belongs to the award table only');
    });

    it('lists per-program transfer sources with the config ratios, DACH pinned first, capped at 3', async () => {
      const result = makeAwardResult();
      result.seats.count = 2;
      result.seats.flights.push({
        ...result.seats.flights[0],
        program: 'flyingblue',
        airline: 'KLM',
      });
      const out = await formatTestResult(result, 'de');

      const flyingBlueLine = out.split('\n').find((l) => l.startsWith('- **Flying Blue')) ?? '';
      // 5:4 is the published Amex DACH ratio (americanexpress.com/de-de) — the
      // DACH source is pinned first even though US programs transfer 1:1.
      assert.match(flyingBlueLine, /Amex Membership Rewards \(DACH\) 5:4/);
      assert.match(flyingBlueLine, /Amex Membership Rewards \(US\) 1:1/);
      assert.ok(
        flyingBlueLine.indexOf('Amex Membership Rewards (DACH)') <
          flyingBlueLine.indexOf('Amex Membership Rewards (US)'),
        'DACH source must be pinned before the US source',
      );
      // "Most important" means top 3 — Flying Blue has 6 sources; the tail
      // (Bilt, Capital One, Citi) must be cut on this line.
      assert.doesNotMatch(flyingBlueLine, /Bilt|Capital One|Citi/);

      const aeroplanLine = out.split('\n').find((l) => l.startsWith('- **Air Canada Aeroplan')) ?? '';
      assert.match(aeroplanLine, /Amex Membership Rewards \(US\) 1:1/);
    });

    it('renders one source line per program even when several rows share the program', async () => {
      const result = makeAwardResult();
      result.seats.count = 2;
      result.seats.flights.push({ ...result.seats.flights[0] });
      const out = await formatTestResult(result, 'de');
      const aeroplanLines = out.split('\n').filter((l) => l.startsWith('- **Air Canada Aeroplan'));
      assert.equal(aeroplanLines.length, 1, 'duplicate programs must be deduped in the hint');
    });

    it('omits the source line for programs no card transfers to, but keeps the principle hint', async () => {
      const result = makeAwardResult();
      result.seats.flights[0].program = 'smiles';
      const out = await formatTestResult(result, 'de');
      assert.match(out, /noch nicht (haben|besitzen)/i);
      assert.doesNotMatch(out, /^- \*\*GOL Smiles/m, 'no fabricated transfer route for GOL Smiles');
    });

    it('marks the indirect Miles & More route via PAYBACK for lufthansa awards', async () => {
      const result = makeAwardResult();
      result.seats.flights[0].program = 'lufthansa';
      const out = await formatTestResult(result, 'de');
      const line = out.split('\n').find((l) => l.startsWith('- **Lufthansa Miles & More')) ?? '';
      assert.match(line, /über PAYBACK/, 'indirect route must be visible, not shown as a direct transfer');
    });

    it('renders the English hint and transfer-source labels', async () => {
      const result = makeAwardResult();
      result.seats.count = 2;
      result.seats.flights.push({
        ...result.seats.flights[0],
        program: 'flyingblue',
        airline: 'KLM',
      });
      const out = await formatTestResult(result, 'en');

      assert.match(out, /don't need to have these miles yet/i);
      assert.match(out, /only necessary when you book/i);
      assert.match(out, /^- \*\*Air Canada Aeroplan\*\*:/m);
      assert.match(out, /Amex Membership Rewards \(US\) 1:1/);

      const flyingBlueLine = out.split('\n').find((l) => l.startsWith('- **Flying Blue')) ?? '';
      assert.match(flyingBlueLine, /Amex Membership Rewards \(DACH\) 5:4/);
      assert.match(flyingBlueLine, /Amex Membership Rewards \(US\) 1:1/);
      assert.ok(
        flyingBlueLine.indexOf('Amex Membership Rewards (DACH)') <
          flyingBlueLine.indexOf('Amex Membership Rewards (US)'),
        'DACH source must be pinned before the US source in English output',
      );
    });

    it('marks the indirect Miles & More route via PAYBACK for lufthansa awards (en)', async () => {
      const result = makeAwardResult();
      result.seats.flights[0].program = 'lufthansa';
      const out = await formatTestResult(result, 'en');
      const line = out.split('\n').find((l) => l.startsWith('- **Lufthansa Miles & More')) ?? '';
      assert.match(line, /via PAYBACK/, 'indirect route must be visible in English output');
    });
  });

  describe('happy-path with injected booking-session creator', () => {
    it('renders the [Buchen] link when the creator returns a real booking URL', async () => {
      const creator = async () => ({ url: 'https://booking.example.com/abc123' });
      const out = await formatTestResult(makeCashResult(), 'de', creator);
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/abc123\)/);
      assert.doesNotMatch(out, /keine direktbuchung/i);
    });
  });
});
