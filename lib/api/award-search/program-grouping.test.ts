/**
 * Unit tests for program-grouping.
 *
 * Second half of the "nur Lufthansa" fix: a take=100 call returns ~30 entries
 * PER program. Naive sort-by-miles + slice(0,5) returned only the single
 * cheapest program. groupByProgram instead keeps every distinct program, but
 * caps each to its N cheapest options so the table stays scannable.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { groupByProgram } from './program-grouping';
import type { AwardFlight } from './parser';

function flight(program: string, miles: number): AwardFlight {
  return {
    id: `${program}-${miles}`,
    program,
    operatingCarriers: 'XX',
    miles,
    taxes: { amount: 0, currency: 'EUR' },
    stops: 1,
    departsAt: '2026-09-01T10:00:00Z',
    arrivesAt: '2026-09-01T20:00:00Z',
    flightNumbers: 'XX1',
    availabilityId: `${program}-${miles}`,
    cabin: 'business',
    remainingSeats: 2,
  };
}

describe('groupByProgram', () => {
  it('keeps every distinct program (never collapses to the single cheapest)', () => {
    const input = [
      flight('aeroplan', 70000),
      flight('lufthansa', 73152),
      flight('united', 88000),
      flight('aeroplan', 72000),
      flight('lufthansa', 90000),
    ];

    const programs = new Set(groupByProgram(input).map((f) => f.program));

    assert.deepStrictEqual([...programs].sort(), ['aeroplan', 'lufthansa', 'united']);
  });

  it('caps each program to its 3 cheapest options, sorted by miles', () => {
    const input = [
      flight('aeroplan', 90000),
      flight('aeroplan', 70000),
      flight('aeroplan', 110000),
      flight('aeroplan', 80000),
      flight('aeroplan', 100000),
    ];

    const aeroplan = groupByProgram(input).filter((f) => f.program === 'aeroplan');

    assert.deepStrictEqual(
      aeroplan.map((f) => f.miles),
      [70000, 80000, 90000],
      'keeps only the 3 cheapest, ascending',
    );
  });

  it('respects a custom per-program cap', () => {
    const input = [flight('united', 88000), flight('united', 90000), flight('united', 95000)];

    assert.strictEqual(groupByProgram(input, 2).length, 2);
  });

  it('orders programs by their cheapest option (best program first)', () => {
    const input = [
      flight('united', 88000),
      flight('lufthansa', 73152),
      flight('aeroplan', 70000),
    ];

    const order = groupByProgram(input).map((f) => f.program);

    assert.deepStrictEqual(order, ['aeroplan', 'lufthansa', 'united']);
  });
});
