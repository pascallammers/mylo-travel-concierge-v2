import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFlightsHref, EMPTY_FLIGHTS_DRAFT, flightsDraftFromDeal, flightsQueryString, parseFlightsQuery } from './flights-query';
const today = '2026-09-24';
const ready = { from: 'FRA', to: 'BKK', date: '2026-11-15' };

test('canonical links roundtrip and normalize repeated keys, defaults and flex', () => {
  const query = parseFlightsQuery({ ...ready, from: ['fra', 'MUC'], pax: '2', flex: '2', direct: '1', cabin: 'first', ignored: 'x' }, today);
  assert.equal(query.status, 'ready');
  assert.equal(query.draft.origin, 'FRA');
  const serialized = flightsQueryString(query.draft);
  assert.equal(serialized, 'from=FRA&to=BKK&date=2026-11-15&flex=3&cabin=first&pax=2&direct=1');
  assert.deepEqual(parseFlightsQuery(Object.fromEntries(new URLSearchParams(serialized)), today).draft, query.draft);
  assert.equal(buildFlightsHref('en', EMPTY_FLIGHTS_DRAFT), '/en/flights');
});
test('deals open a ready query carrying their date, cabin and program', () => {
  const draft = flightsDraftFromDeal({ origin: 'fra', destination: 'BKK', departureDate: new Date('2026-11-12T11:00:00Z'), cabinClass: 'premium_economy', programId: 'lufthansa' });
  const parsed = parseFlightsQuery(Object.fromEntries(new URL(buildFlightsHref('de', draft), 'https://mylo.test').searchParams), today);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.draft.cabin, 'PREMIUM_ECONOMY');
  assert.equal(parsed.draft.departDate, '2026-11-12');
  assert.deepEqual(parsed.draft.programs, ['lufthansa']);
  assert.equal(parsed.draft.flexible, true);
});
test('empty and incomplete queries stay drafts; invalid values never execute', () => {
  assert.deepEqual(parseFlightsQuery({}, today), { status: 'draft', draft: EMPTY_FLIGHTS_DRAFT, issues: [] });
  assert.equal(parseFlightsQuery({ from: 'FRA' }, today).status, 'draft');
  for (const invalid of [
    { from: 'Frankfurt' }, { to: 'FRA' }, { date: '2026-02-30' }, { date: '2026-01-01' },
    { return: '2026-11-14' }, { cabin: 'suite' }, { pax: '10' }, { flex: '4' }, { direct: 'yes' },
    { month: '2026-11' }, { return: '2026-12-01', returnMonth: '2026-12' },
  ]) {
    const result = parseFlightsQuery({ ...ready, ...invalid }, today);
    assert.equal(result.status, 'draft');
    if (result.status === 'draft') assert.ok(result.issues.length, JSON.stringify(invalid));
  }
});
test('month roundtrips are searchable while ambiguous and past months are issues', () => {
  const query = parseFlightsQuery({ from: 'FRA', to: 'BKK', month: '2026-09', returnMonth: '2026-11' }, today);
  assert.equal(query.status, 'ready');
  assert.deepEqual(parseFlightsQuery(Object.fromEntries(new URLSearchParams(flightsQueryString(query.draft))), today).draft, query.draft);
  for (const month of ['2026-08', '2026-13']) {
    const invalid = parseFlightsQuery({ from: 'FRA', to: 'BKK', month }, today);
    assert.equal(invalid.status, 'draft');
    if (invalid.status === 'draft') assert.ok(invalid.issues.length);
  }
});
test('programs are known, deduplicated and limited to five', () => {
  const result = parseFlightsQuery({ ...ready, program: 'unknown,lufthansa,aeroplan,united,virginatlantic,flyingblue,alaska,lufthansa' }, today);
  assert.equal(result.draft.programs.length, 5);
  assert.ok(!result.draft.programs.includes('unknown'));
  assert.equal(new Set(result.draft.programs).size, 5);
});
