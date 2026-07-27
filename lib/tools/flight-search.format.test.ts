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

  describe('happy-path with injected booking-session creator', () => {
    it('renders the [Buchen] link when the creator returns a real booking URL', async () => {
      const creator = async () => ({ url: 'https://booking.example.com/abc123' });
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', creator);
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/abc123\)/);
      assert.doesNotMatch(out, /keine direktbuchung/i);
    });
  });
});
