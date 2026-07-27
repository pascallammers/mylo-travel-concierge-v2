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
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de');
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
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de');
      const cashSection = out.split('## ').find((s) => /Cash|Barzahlung/i.test(s)) ?? '';
      const headerLine = cashSection.split('\n').find((l) => l.includes('Airline')) ?? '';
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'cash table must not expose a source column');
      assert.doesNotMatch(cashSection, /Duffel/i);
    });
  });

  describe('null Duffel booking URL hint', () => {
    it('emits an explicit "Direct booking unavailable" / "keine Direktbuchung" hint when no booking session', async () => {
      const out = await formatFlightResults(makeCashResult(), baseParams, 'en');
      // Direct-booking hint must appear somewhere in the rendered output so the
      // LLM has no gap to pad with a fabricated link.
      assert.match(out, /direct booking unavailable|keine direktbuchung/i);
    });

    it('does NOT contain the corporate https://duffel.com URL (only real booking-session URLs)', async () => {
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de');
      assert.doesNotMatch(out, /https:\/\/duffel\.com(?:[\s)]|$)/, 'corporate duffel.com link must never appear');
      assert.doesNotMatch(out, /\[Duffel API\]/, 'fabricated [Duffel API] label must never appear');
    });

    it('falls back to the unavailable hint when the injected creator throws', async () => {
      const failingCreator = async () => {
        throw new Error('Duffel Payments not enabled');
      };
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', failingCreator);
      assert.match(out, /keine direktbuchung/i);
      assert.doesNotMatch(out, /\[Buchen\]/);
    });
  });

  describe('roundtrip award one-way notice (MYLO-21)', () => {
    it('flags award prices as per-direction/outbound-only when a returnDate is set (de)', async () => {
      const params = { ...baseParams, returnDate: '2026-06-22' };
      const out = await formatFlightResults(makeAwardResult(), params, 'de');
      // Award results silently show only the outbound leg for roundtrip
      // searches — the user must be told the miles price is not the round-trip
      // total.
      assert.match(out, /pro Strecke/i, 'must flag miles price as per-direction');
      assert.match(out, /Hinflug/i, 'must name the outbound leg');
    });

    it('flags award prices as per-direction/outbound-only when a returnDate is set (en)', async () => {
      const params = { ...baseParams, returnDate: '2026-06-22' };
      const out = await formatFlightResults(makeAwardResult(), params, 'en');
      assert.match(out, /per direction|outbound/i, 'must flag miles price as per-direction');
    });

    it('does NOT show the one-way notice for a one-way search (no returnDate)', async () => {
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de');
      assert.doesNotMatch(out, /pro Strecke/i, 'one-way search must not show the roundtrip notice');
    });

    it('does NOT show the notice when a returnDate is set but there are no award results', async () => {
      const params = { ...baseParams, returnDate: '2026-06-22' };
      const out = await formatFlightResults(makeCashResult(), params, 'de');
      assert.doesNotMatch(out, /pro Strecke/i, 'notice belongs to the award table only');
    });
  });

  describe('roundtrip return award table (MYLO-21 Ausbau)', () => {
    const rtParams = { ...baseParams, returnDate: '2026-06-22' };

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
                departure: { airport: 'JFK', time: '2026-06-22T18:00:00.000Z' },
                arrival: { airport: 'FRA', time: '2026-06-23T07:30:00.000Z' },
                duration: '7h 30m',
                stops: 'Nonstop',
                flightNumbers: 'UA960',
              },
            },
          ],
        },
      };
    }

    it('renders return awards as their own table with a Programm column (de)', async () => {
      const out = await formatFlightResults(makeRoundtripAwardResult(), rtParams, 'de');
      assert.match(out, /### Hinflug \(1 Ergebnisse\)/, 'outbound leg gets its own heading');
      assert.match(out, /### Rückflug \(1 Ergebnisse\)/, 'return leg gets its own heading');
      // Both leg tables carry the Programm column (acceptance criterion).
      const programHeaders = out.split('\n').filter((l) => l.includes('| Programm |'));
      assert.strictEqual(programHeaders.length, 2, 'both leg tables need a Programm column');
      // The return row resolves its own program and route.
      assert.match(out, /United MileagePlus/, 'return program renders as display name');
      assert.match(out, /UA960/, 'return flight number appears');
    });

    it('swaps the one-way notice for a per-leg notice when return awards exist', async () => {
      const out = await formatFlightResults(makeRoundtripAwardResult(), rtParams, 'de');
      assert.match(out, /jeweils pro Strecke/i, 'per-leg pricing must still be flagged');
      assert.doesNotMatch(out, /nicht enthalten/i, 'outbound-only wording would be wrong here');
    });

    it('keeps the outbound-only notice when the return search found nothing', async () => {
      const result = {
        ...makeAwardResult(),
        seatsReturn: { count: 0, error: false, flights: [] },
      };
      const out = await formatFlightResults(result, rtParams, 'de');
      assert.match(out, /pro Strecke \(nur Hinflug\)/i, 'must keep the outbound-only notice');
      assert.doesNotMatch(out, /### Rückflug/, 'no empty return table');
    });

    it('renders the return table even when the outbound leg has no award availability', async () => {
      const result = {
        ...makeRoundtripAwardResult(),
        seats: { count: 0, flights: [], error: false },
        cash: { count: 0, flights: [] },
      };
      const out = await formatFlightResults(result, rtParams, 'de');
      assert.match(out, /### Rückflug \(1 Ergebnisse\)/);
      assert.match(out, /Hinflug.*keine Award-Verfügbarkeit/i, 'outbound leg absence is stated, not silent');
      assert.doesNotMatch(out, /keine Flüge für Ihre Suche gefunden/i, 'no-results fallback must not fire');
    });

    it('surfaces an outbound provider error instead of claiming no award availability', async () => {
      const result = {
        ...makeRoundtripAwardResult(),
        seats: { count: 0, flights: [], error: true },
        cash: { count: 0, flights: [] },
      };
      const out = await formatFlightResults(result, rtParams, 'de');
      assert.match(out, /Award-Verfügbarkeit.*Hinflug.*konnte.*nicht geladen/i);
      assert.doesNotMatch(out, /Hinflug.*keine Award-Verfügbarkeit/i);

      const enOut = await formatFlightResults(result, rtParams, 'en');
      assert.match(enOut, /outbound.*could not be loaded/i);
      assert.doesNotMatch(enOut, /No award availability.*outbound/i);
    });

    it('localizes the leg headings (en)', async () => {
      const out = await formatFlightResults(makeRoundtripAwardResult(), rtParams, 'en');
      assert.match(out, /### Outbound \(1 results\)/);
      assert.match(out, /### Return \(1 results\)/);
    });
  });

  describe('happy-path with injected booking-session creator', () => {
    it('renders the [Buchen] link when the creator returns a real booking URL', async () => {
      const creator = async () => ({ url: 'https://booking.example.com/abc123' });
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', creator);
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/abc123\)/);
      assert.doesNotMatch(out, /keine direktbuchung/i);
    });
  });
});
