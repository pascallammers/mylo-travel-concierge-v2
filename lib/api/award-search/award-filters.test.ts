/**
 * Unit tests for applyAwardFilters — the MYLO-19 fix that makes the
 * `loyaltyPrograms` and `maxTaxes` tool parameters actually filter award
 * results instead of being silently ignored.
 *
 * Contract per parameter: filter applies / filter does not apply / empty
 * result produces a user-facing note instead of a silent empty table.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { applyAwardFilters } from './award-filters';
import type { SeatsAeroFlight } from '../seats-aero-client';

function flight(
  program: string,
  taxes: { amount: number | null; currency: string | null },
): SeatsAeroFlight {
  return {
    id: `${program}-${taxes.amount}`,
    price: '70,000 miles',
    pricePerPerson: '70,000 miles',
    program,
    airline: 'XX',
    cabin: 'Business',
    tags: [],
    totalStops: 1,
    miles: 70000,
    taxes,
    seatsLeft: 2,
    bookingLinks: {},
    outbound: {
      departure: { airport: 'MUC', time: '2026-09-01T10:00:00Z' },
      arrival: { airport: 'MIA', time: '2026-09-01T20:00:00Z' },
      duration: '10h 0m',
      stops: '1 stop',
      flightNumbers: 'XX1',
    },
  };
}

describe('applyAwardFilters: loyaltyPrograms', () => {
  const threePrograms = [
    flight('aeroplan', { amount: 210, currency: 'EUR' }),
    flight('lufthansa', { amount: 851, currency: 'EUR' }),
    flight('united', { amount: 186, currency: 'USD' }),
  ];

  it('keeps only the requested program', () => {
    const { flights, notes } = applyAwardFilters(threePrograms, {
      loyaltyPrograms: ['Aeroplan'],
      locale: 'de',
    });

    assert.deepStrictEqual(flights.map((f) => f.program), ['aeroplan']);
    assert.deepStrictEqual(notes, []);
  });

  it('accepts brand display names as filter input', () => {
    const { flights } = applyAwardFilters(threePrograms, {
      loyaltyPrograms: ['Lufthansa Miles & More'],
      locale: 'de',
    });

    assert.deepStrictEqual(flights.map((f) => f.program), ['lufthansa']);
  });

  it('does not filter when no programs are requested', () => {
    const { flights, notes } = applyAwardFilters(threePrograms, { locale: 'de' });

    assert.strictEqual(flights.length, 3);
    assert.deepStrictEqual(notes, []);
  });

  it('falls back to all programs with a note when the requested program has no availability', () => {
    const { flights, notes } = applyAwardFilters(threePrograms, {
      loyaltyPrograms: ['KrisFlyer'],
      locale: 'de',
    });

    // Alternatives stay visible — an empty table with no explanation is the bug.
    assert.strictEqual(flights.length, 3);
    assert.strictEqual(notes.length, 1);
    assert.ok(
      notes[0].includes('Singapore Airlines KrisFlyer'),
      `note names the requested program: ${notes[0]}`,
    );
    assert.ok(
      notes[0].includes('Air Canada Aeroplan'),
      `note lists available alternatives: ${notes[0]}`,
    );
  });

  it('notes an unrecognized program name instead of silently ignoring it', () => {
    const { flights, notes } = applyAwardFilters(threePrograms, {
      loyaltyPrograms: ['Payback'],
      locale: 'de',
    });

    assert.strictEqual(flights.length, 3, 'unknown program must not filter anything');
    assert.strictEqual(notes.length, 1);
    assert.ok(notes[0].includes('Payback'), `note names the unknown input: ${notes[0]}`);
  });

  it('filters by the recognized program and notes the unrecognized one', () => {
    const { flights, notes } = applyAwardFilters(threePrograms, {
      loyaltyPrograms: ['Aeroplan', 'Payback'],
      locale: 'de',
    });

    assert.deepStrictEqual(flights.map((f) => f.program), ['aeroplan']);
    assert.strictEqual(notes.length, 1);
    assert.ok(notes[0].includes('Payback'));
  });
});

describe('applyAwardFilters: maxTaxes', () => {
  it('drops flights whose USD/EUR taxes exceed the limit', () => {
    const input = [
      flight('aeroplan', { amount: 210, currency: 'EUR' }),
      flight('lufthansa', { amount: 851, currency: 'EUR' }),
      flight('united', { amount: 186, currency: 'USD' }),
    ];

    const { flights, notes } = applyAwardFilters(input, { maxTaxes: 300, locale: 'de' });

    assert.deepStrictEqual(flights.map((f) => f.program), ['aeroplan', 'united']);
    assert.deepStrictEqual(notes, []);
  });

  it('keeps flights within the limit untouched', () => {
    const input = [flight('aeroplan', { amount: 210, currency: 'EUR' })];

    const { flights, notes } = applyAwardFilters(input, { maxTaxes: 300, locale: 'de' });

    assert.strictEqual(flights.length, 1);
    assert.deepStrictEqual(notes, []);
  });

  it('keeps non-USD/EUR flights and notes the currency instead of silently filtering', () => {
    const input = [
      flight('singapore', { amount: 90000, currency: 'JPY' }),
      flight('aeroplan', { amount: 210, currency: 'EUR' }),
    ];

    const { flights, notes } = applyAwardFilters(input, { maxTaxes: 300, locale: 'de' });

    assert.strictEqual(flights.length, 2, 'JPY flight must survive despite exceeding the number');
    assert.strictEqual(notes.length, 1);
    assert.ok(notes[0].includes('JPY'), `note names the incomparable currency: ${notes[0]}`);
  });

  it('keeps flights with unknown tax amounts (null) rather than silently dropping them', () => {
    const input = [flight('aeroplan', { amount: null, currency: null })];

    const { flights } = applyAwardFilters(input, { maxTaxes: 300, locale: 'de' });

    assert.strictEqual(flights.length, 1);
  });

  it('notes when the limit filters out every award flight', () => {
    const input = [
      flight('aeroplan', { amount: 500, currency: 'EUR' }),
      flight('lufthansa', { amount: 851, currency: 'EUR' }),
    ];

    const { flights, notes } = applyAwardFilters(input, { maxTaxes: 100, locale: 'de' });

    assert.strictEqual(flights.length, 0);
    assert.strictEqual(notes.length, 1);
    assert.ok(notes[0].includes('100'), `note mentions the limit: ${notes[0]}`);
  });

  it('does not filter when maxTaxes is not set', () => {
    const input = [flight('lufthansa', { amount: 851, currency: 'EUR' })];

    const { flights, notes } = applyAwardFilters(input, { locale: 'de' });

    assert.strictEqual(flights.length, 1);
    assert.deepStrictEqual(notes, []);
  });
});

describe('applyAwardFilters: combined', () => {
  it('applies the program filter before the tax limit', () => {
    const input = [
      flight('aeroplan', { amount: 210, currency: 'EUR' }),
      flight('aeroplan', { amount: 900, currency: 'EUR' }),
      flight('united', { amount: 50, currency: 'USD' }),
    ];

    const { flights } = applyAwardFilters(input, {
      loyaltyPrograms: ['Aeroplan'],
      maxTaxes: 300,
      locale: 'de',
    });

    assert.strictEqual(flights.length, 1);
    assert.strictEqual(flights[0].program, 'aeroplan');
    assert.strictEqual(flights[0].taxes.amount, 210);
  });

  it('handles empty input without notes', () => {
    assert.deepStrictEqual(applyAwardFilters([], { loyaltyPrograms: ['Aeroplan'], locale: 'de' }), {
      flights: [],
      notes: [],
    });
  });
});
