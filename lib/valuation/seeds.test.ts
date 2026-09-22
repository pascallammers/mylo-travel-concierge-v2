import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLoyaltyProgram } from '../loyalty/programs';
import { seedRows, VALUATION_SEEDS } from './seeds';

test('all 25 documented seed values use unique registry keys and dated EUR-cent sources', () => {
  const expected = [
    ['lufthansa', 'travel', 'all', 1.7],
    ['amex-mr', 'travel', 'all', 1.7],
    ['payback', 'travel', 'all', 1.8],
    ['marriott', 'travel', 'all', 0.7],
    ['emirates', 'travel', 'all', 1.1],
    ['hilton', 'travel', 'all', 0.5],
    ['qatar', 'travel', 'all', 1.6],
    ['cathay', 'travel', 'all', 1.5],
    ['british', 'travel', 'all', 1.5],
    ['flyingblue', 'travel', 'all', 1.4],
    ['iberia', 'travel', 'all', 1.5],
    ['singapore', 'travel', 'all', 1.5],
    ['aeroplan', 'travel', 'all', 1.7],
    ['united', 'travel', 'all', 1.3],
    ['delta', 'travel', 'all', 1.1],
    ['turkish', 'travel', 'all', 1.1],
    ['eurobonus', 'travel', 'all', 1.7],
    ['etihad', 'travel', 'all', 1.0],
    ['lufthansa', 'travel', 'economy', 0.7],
    ['lufthansa', 'travel', 'premium_economy', 1.1],
    ['lufthansa', 'travel', 'business', 1.7],
    ['lufthansa', 'travel', 'first', 2.3],
    ['lufthansa', 'no_plan', 'all', 0.3],
    ['amex-mr', 'no_plan', 'all', 0.4],
    ['payback', 'no_plan', 'all', 1.0],
  ];
  assert.deepEqual(
    VALUATION_SEEDS.map((row) => [row.programId, row.anchor, row.cabin, row.centsPerUnit]),
    expected,
  );
  assert.equal(new Set(VALUATION_SEEDS.map((row) => `${row.programId}:${row.anchor}:${row.cabin}`)).size, 25);
  for (const row of seedRows()) {
    assert.ok(getLoyaltyProgram(row.programId));
    assert.equal(row.source, 'reisetopia');
    assert.equal(new URL(row.sourceUrl!).hostname, 'reisetopia.de');
    assert.equal(row.sourceAsOf.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(row.reviewDue.toISOString(), '2027-03-01T00:00:00.000Z');
    assert.equal(row.createdBy, null);
  }
});

test('seed copies cannot mutate the fallback', () => {
  const rows = seedRows();
  rows[0].sourceAsOf.setUTCFullYear(2000);
  rows[0].centsPerUnit = 999;
  assert.equal(seedRows()[0].centsPerUnit, 1.7);
  assert.equal(seedRows()[0].sourceAsOf.getUTCFullYear(), 2026);
});
