import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessRedemption, CppCalculatorError } from './cpp-calculator';
import { buildValuationTable } from '../valuation/table';
import { seedRows } from '../valuation/seeds';

const now = new Date('2026-09-22');
const table = buildValuationTable(seedRows(), now);
const input = { programId: 'lufthansa', pointsRequired: 100_000, cashEur: 2400 };

test('CPP uses EUR directly, rounds to two decimals, and includes the documented quality seal', () => {
  const result = assessRedemption({ ...input, cabin: 'business' }, table);
  assert.equal(result.centsPerPoint, 2.4);
  assert.equal(result.programName, 'Miles & More');
  assert.equal(result.travel.centsPerUnit, 1.7);
  assert.equal(result.noPlan?.centsPerUnit, 0.3);
  assert.equal(result.verdict, 'above_travel');
  assert.equal(
    result.summary,
    'über dem üblichen Reisewert · 2,4 ct pro Punkt · üblich 1,7 ct (Reisewert Miles & More, Business Class; reisetopia, Stand 09/2026)',
  );
  assert.equal(assessRedemption({ ...input, pointsRequired: 33_333, cashEur: 1234 }, table).centsPerPoint, 3.7);
  assert.equal(assessRedemption({ ...input, pointsRequired: 60_000, cashEur: 1000 }, table).centsPerPoint, 1.67);
});

test('verdict boundaries use no-plan, travel and exactly 1.5 times travel', () => {
  for (const [cashEur, verdict] of [
    [290, 'below_no_plan'],
    [300, 'below_travel'],
    [1690, 'below_travel'],
    [1700, 'above_travel'],
    [2540, 'above_travel'],
    [2550, 'far_above_travel'],
    [4000, 'far_above_travel'],
  ] as const) {
    assert.equal(assessRedemption({ ...input, cashEur }, table).verdict, verdict, String(cashEur));
  }
  assert.match(
    assessRedemption({ ...input, cashEur: 200 }, table).summary,
    /^sogar unter dem Wert ohne Plan \(0,3 ct\)/,
  );
  assert.match(assessRedemption({ ...input, cashEur: 1000 }, table).summary, /^unter dem üblichen Reisewert/);
  assert.match(assessRedemption({ ...input, cashEur: 3000 }, table).summary, /^deutlich über dem üblichen Reisewert/);
  const rows = seedRows();
  rows[0].centsPerUnit = 2.1;
  assert.equal(
    assessRedemption({ ...input, cashEur: 3150 }, buildValuationTable(rows, now)).verdict,
    'far_above_travel',
  );
});

test('cabin changes the anchor and verdict; missing cabin rows fall back to all', () => {
  assert.equal(assessRedemption({ ...input, cashEur: 1000, cabin: 'economy' }, table).verdict, 'above_travel');
  assert.equal(assessRedemption({ ...input, cashEur: 1000, cabin: 'business' }, table).verdict, 'below_travel');
  assert.equal(assessRedemption({ ...input, cabin: 'first' }, table).travel.centsPerUnit, 2.3);
  const amex = assessRedemption({ ...input, programId: 'amex-mr', cabin: 'first' }, table);
  assert.equal(amex.travel.cabin, 'all');
  assert.match(amex.summary, /Alle Klassen/);
  assert.ok(!amex.summary.includes('First Class'));
});

test('absent no-plan remains null and never invents a lower anchor', () => {
  const result = assessRedemption({ ...input, programId: 'hilton', cashEur: 100 }, table);
  assert.equal(result.noPlan, null);
  assert.equal(result.verdict, 'below_travel');
  assert.ok(!result.summary.includes('ohne Plan'));
});

test('every allowlisted programme resolves through registry IDs', () => {
  for (const programId of table.programIds()) {
    const result = assessRedemption({ ...input, programId }, table);
    assert.ok(result.travel.sourceUrl?.startsWith('https://reisetopia.de/'));
    assert.equal(result.travel.source, 'reisetopia');
  }
  assert.equal(assessRedemption({ ...input, programId: 'amex-mr' }, table).programName, 'Amex Membership Rewards');
  assert.equal(assessRedemption({ ...input, programId: 'payback' }, table).programName, 'PAYBACK');
  assert.equal(assessRedemption({ ...input, programId: 'marriott' }, table).programName, 'Marriott Bonvoy');
});

test('overdue travel anchors append a German freshness warning, using the resolved cabin row', () => {
  const rows = seedRows();
  rows[0].reviewDue = new Date('2026-01-01');
  const mixed = buildValuationTable(rows, now);
  assert.match(assessRedemption(input, mixed).summary, / · Bewertungssatz überfällig$/);
  assert.ok(!assessRedemption({ ...input, cabin: 'business' }, mixed).summary.includes('überfällig'));
  const expired = buildValuationTable(rows, new Date('2028-01-01'));
  assert.match(assessRedemption({ ...input, cabin: 'business' }, expired).summary, /überfällig$/);
});

test('unknown, unsupported and cabin-only programmes report the current allowlist in German', () => {
  for (const programId of ['unknown', 'chase-ur', 'amex_membership_rewards']) {
    assert.throws(
      () => assessRedemption({ ...input, programId }, table),
      (error: unknown) => {
        assert.ok(error instanceof CppCalculatorError);
        assert.match(error.message, /ist nicht bewertbar; bewertbare Programme:/);
        assert.match(error.message, /Miles & More \(lufthansa\)/);
        return true;
      },
    );
  }
  const cabinOnly = buildValuationTable(
    seedRows().filter((row) => row.cabin === 'business'),
    now,
  );
  assert.throws(() => assessRedemption({ ...input, cabin: 'business' }, cabinOnly), /bewertbare Programme: keine/);
});

test('invalid amounts including NaN, infinities and overflow throw German errors', () => {
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => assessRedemption({ ...input, pointsRequired: invalid }, table), /Punktezahl.*größer als null/);
    assert.throws(
      () => assessRedemption({ ...input, cashEur: invalid }, table),
      /Vergleichspreis in EUR.*größer als null/,
    );
  }
  assert.throws(
    () => assessRedemption({ ...input, cashEur: Number.MAX_VALUE, pointsRequired: Number.MIN_VALUE }, table),
    /nicht berechnet/,
  );
});
