import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildValuationTable } from './table';
import { seedRows } from './seeds';
import type { RateVersion } from './types';

const today = new Date('2026-09-22T12:00:00Z');

test('cabin rows win and missing cabin rates fall back to all', () => {
  const table = buildValuationTable(seedRows(), today);
  for (const [cabin, value] of [
    ['economy', 0.7],
    ['premium_economy', 1.1],
    ['business', 1.7],
    ['first', 2.3],
  ] as const) {
    assert.equal(table.rateFor('lufthansa', 'travel', cabin)?.centsPerUnit, value);
    assert.equal(table.rateFor('lufthansa', 'travel', cabin)?.cabin, cabin);
  }
  assert.equal(table.rateFor('lufthansa', 'travel')?.centsPerUnit, 1.7);
  assert.equal(table.rateFor('amex-mr', 'travel', 'first')?.cabin, 'all');
  assert.equal(table.rateFor('lufthansa', 'no_plan', 'business')?.centsPerUnit, 0.3);
  assert.equal(table.rateFor('hilton', 'no_plan'), undefined);
  assert.equal(table.rateFor('unknown', 'travel'), undefined);
});

test('only current travel/all rows define the allowlist and oldest month', () => {
  const rows = seedRows().map(
    (row, index): RateVersion => ({ ...row, id: String(index), origin: 'seed', validFrom: today, validTo: null }),
  );
  rows[0].validTo = today;
  rows[1].sourceAsOf = new Date('2026-08-01');
  rows[22].sourceAsOf = new Date('2020-01-01');
  const table = buildValuationTable(rows, today);
  assert.equal(table.isRatable('lufthansa'), false);
  assert.equal(table.isRatable('amex-mr'), true);
  assert.equal(table.isRatable('chase-ur'), false);
  assert.equal(table.programIds().length, 17);
  assert.equal(table.tableAsOf, '2026-08');
  assert.equal(buildValuationTable([], today).tableAsOf, '');
  assert.deepEqual(buildValuationTable([], today).staleRates(), []);
});

test('review is not stale at its exact boundary and is stale immediately afterwards', () => {
  const rows = seedRows();
  const due = rows[0].reviewDue;
  const atBoundary = buildValuationTable(rows, due);
  assert.equal(atBoundary.rateFor('lufthansa', 'travel')?.stale, false);
  assert.deepEqual(atBoundary.staleRates(), []);
  const after = buildValuationTable(rows, new Date(due.getTime() + 1));
  assert.equal(after.staleRates().length, 25);
  assert.equal(after.rateFor('lufthansa', 'travel')?.stale, true);
  assert.ok(
    after
      .staleRates()
      .some((row) => row.programId === 'lufthansa' && row.anchor === 'travel' && row.cabin === 'business'),
  );
});

test('snapshot is isolated from source rows, clock and returned dates', () => {
  const rows = seedRows();
  const clock = new Date(today);
  const table = buildValuationTable(rows, clock);
  rows[0].centsPerUnit = 9;
  clock.setUTCFullYear(2030);
  table.programIds().pop();
  table.rateFor('lufthansa', 'travel')!.sourceAsOf.setUTCFullYear(2000);
  assert.equal(table.rateFor('lufthansa', 'travel')?.centsPerUnit, 1.7);
  assert.equal(table.rateFor('lufthansa', 'travel')?.sourceAsOf.getUTCFullYear(), 2026);
  assert.equal(table.rateFor('lufthansa', 'travel')?.stale, false);
  assert.equal(table.programIds().length, 18);
});
