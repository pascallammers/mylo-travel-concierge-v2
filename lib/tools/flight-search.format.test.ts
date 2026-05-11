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
    it('award table does not expose Seats.aero to end users', async () => {
      const out = await formatFlightResults(makeAwardResult(), baseParams, 'de');
      const headerLine = out.split('\n').find((l) => l.includes('Airline')) ?? '';
      assert.doesNotMatch(headerLine, /Quelle|Source/i, 'award table must not expose a source column');
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

  describe('happy-path with injected booking-session creator', () => {
    it('renders the [Buchen] link when the creator returns a real booking URL', async () => {
      const creator = async () => ({ url: 'https://booking.example.com/abc123' });
      const out = await formatFlightResults(makeCashResult(), baseParams, 'de', creator);
      assert.match(out, /\[Buchen\]\(https:\/\/booking\.example\.com\/abc123\)/);
      assert.doesNotMatch(out, /keine direktbuchung/i);
    });
  });
});
