import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkTravelDates, resolveFlightSearch, searchWindowBounds, todayIso } from './search-input';
const input = { origin: 'fra', destination: 'BKK', cabin: 'BUSINESS', outbound: { kind: 'day', date: '2026-11-15', flexDays: 2 } };

test('composes tool validators and normalizes route and flex', () => {
  const result = resolveFlightSearch(input, '2026-09-24');
  assert.ok(result.ok);
  assert.equal(result.search.origin, 'FRA');
  assert.deepEqual(result.search.outbound, { kind: 'day', date: '2026-11-15', flexDays: 3 });
  assert.equal(result.search.passengers, 1);
  assert.deepEqual(searchWindowBounds(result.search.outbound, result.search.today), { start: '2026-11-12', end: '2026-11-18' });
});
test('invalid route, calendar date, month, cabin, passengers and taxes yield issues', () => {
  for (const change of [
    { origin: 'Frankfurt' }, { destination: 'FRA' }, { passengers: 0 }, { passengers: 10 }, { passengers: 1.5 },
    { cabin: 'suite' }, { maxTaxes: -1 }, { outbound: { kind: 'day', date: '2026-02-30' } },
    { outbound: { kind: 'month', month: '2026-13' } },
  ]) assert.equal(resolveFlightSearch({ ...input, ...change }, '2026-09-24').ok, false);
});
test('month windows clip past days, support leap years and reject entirely past months', () => {
  for (const [month, today, expected] of [
    ['2026-09', '2026-09-24', { start: '2026-09-24', end: '2026-09-30' }],
    ['2028-02', '2026-09-24', { start: '2028-02-01', end: '2028-02-29' }],
  ] as const) {
    const result = resolveFlightSearch({ ...input, outbound: { kind: 'month', month } }, today);
    assert.ok(result.ok);
    assert.deepEqual(searchWindowBounds(result.search.outbound, today), expected);
  }
  const past = resolveFlightSearch({ ...input, outbound: { kind: 'month', month: '2026-08' } }, '2026-09-24');
  assert.deepEqual(past, { ok: false, issues: [{ field: 'outbound', code: 'month_in_past' }] });
});
test('return validation rejects impossible windows but allows independent options in the same month', () => {
  const outbound = { kind: 'month', month: '2026-11' };
  assert.equal(resolveFlightSearch({ ...input, outbound, inbound: outbound }, '2026-09-24').ok, true);
  const ret = resolveFlightSearch({ ...input, outbound, inbound: { kind: 'month', month: '2026-10' } }, '2026-09-24');
  assert.deepEqual(ret, { ok: false, issues: [{ field: 'inbound', code: 'return_before_depart' }] });
  assert.equal(resolveFlightSearch({ ...input, inbound: { kind: 'day', date: '2026-11-14', flexDays: 3 } }, '2026-09-24').ok, false);
});
test('date checks retain chat fail-fast ordering and local day formatting', () => {
  assert.equal(checkTravelDates({ departDate: '2026-01-01', returnDate: '2025-01-01' }, '2026-09-24'), 'depart_in_past');
  assert.equal(checkTravelDates({ departDate: '2026-11-01', returnDate: '2026-01-01' }, '2026-09-24'), 'return_in_past');
  assert.equal(checkTravelDates({ departDate: '2026-11-02', returnDate: '2026-11-01' }, '2026-09-24'), 'return_before_depart');
  assert.equal(checkTravelDates({ departDate: '2026-11-02' }, '2026-09-24'), null);
  assert.equal(todayIso(new Date(2026, 8, 24)), '2026-09-24');
});
