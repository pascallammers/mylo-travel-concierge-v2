import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SeatsAeroFlight, SeatsAeroSearchParams } from '@/lib/api/seats-aero-client';
import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import { searchAwards, formatAwardQuotaNotice } from './award-search';
import { resolveFlightSearch } from './search-input';

function search(overrides: Record<string, unknown> = {}) {
  const result = resolveFlightSearch({ origin: 'FRA', destination: 'BKK', cabin: 'BUSINESS',
    outbound: { kind: 'day', date: '2026-11-15' }, ...overrides }, '2026-09-24');
  assert.ok(result.ok);
  return result.search;
}
function flight(miles = 70000, totalStops = 0, program = 'aeroplan', taxes = 200): SeatsAeroFlight {
  return { id: `${program}-${miles}-${totalStops}`, price: `${miles} miles`, pricePerPerson: `${miles} miles`,
    program, airline: 'LH', cabin: 'Business', tags: [], totalStops, miles,
    taxes: { amount: taxes, currency: 'EUR' }, seatsLeft: 1,
    outbound: { departure: { airport: 'FRA', time: '2026-11-15T10:00:00Z' },
      arrival: { airport: 'BKK', time: '2026-11-15T20:00:00Z' }, duration: '10h', stops: 'Nonstop', flightNumbers: 'LH1' } };
}
test('input to grouped awards: one call retains three cheapest options per program', async () => {
  const calls: SeatsAeroSearchParams[] = [];
  const result = await searchAwards(search(), { searchTrips: async (params) => {
    calls.push(params); return [flight(90000), flight(70000), flight(50000), flight(60000), flight(80000, 1, 'united')];
  } }, { locale: 'de' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].maxResults, 60);
  assert.ok(result.outbound.status === 'ok');
  assert.deepEqual(result.outbound.options.map((f) => f.miles), [50000, 60000, 70000, 80000]);
  assert.equal(result.outbound.foundCount, 4);
  assert.deepEqual(result.inbound, { status: 'skipped', reason: 'one_way' });
});
test('fixed, flex and month roundtrips each request two independent legs', async () => {
  for (const window of [
    { kind: 'day', date: '2026-11-15', flexDays: 0 },
    { kind: 'day', date: '2026-11-15', flexDays: 1 },
    { kind: 'month', month: '2026-09' },
  ]) {
    const calls: SeatsAeroSearchParams[] = [];
    await searchAwards(search({ outbound: window, inbound: window }), { searchTrips: async (params) => { calls.push(params); return []; } }, { locale: 'de' });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].origin, 'BKK');
    assert.equal(calls[1].destination, 'FRA');
    assert.equal(calls[0].maxResults, window.flexDays === 0 ? 60 : 100);
    if (window.kind === 'month') {
      assert.equal(calls[0].departureDate, '2026-09-24');
      assert.equal(calls[1].endDate, '2026-09-30');
    } else assert.equal(calls[1].flexibility, window.flexDays ? 3 : 0);
  }
});
test('both legs tier before filtering; filter notes deduplicate and foundCount survives empty filters', async () => {
  const result = await searchAwards(search({ nonStop: true, inbound: { kind: 'day', date: '2026-11-20' },
    loyaltyPrograms: ['Aeroplan'], maxTaxes: 300 }), { searchTrips: async () => [
    flight(90000, 0), flight(40000, 1), flight(41000, 1), flight(42000, 1), flight(50000, 2), flight(30000, 1, 'united'),
  ] }, { locale: 'de' });
  for (const leg of [result.outbound, result.inbound]) {
    assert.ok(leg.status === 'ok');
    assert.equal(leg.options[0].totalStops, 0);
    assert.equal(leg.options.length, 4);
    assert.equal(leg.foundCount, 5);
  }
  const empty = await searchAwards(search({ inbound: { kind: 'day', date: '2026-11-20' }, maxTaxes: 0 }),
    { searchTrips: async () => [flight()] }, { locale: 'de' });
  assert.ok(empty.outbound.status === 'ok');
  assert.equal(empty.outbound.options.length, 0);
  assert.equal(empty.outbound.foundCount, 1);
  assert.equal(empty.filterNotes.length, 1);
});
test('migrated program and tax filter case retains only matching affordable awards', async () => {
  const result = await searchAwards(search({ loyaltyPrograms: ['Aeroplan'], maxTaxes: 300 }), { searchTrips: async () => [
    flight(70000, 0, 'aeroplan', 200), flight(71000, 0, 'aeroplan', 500), flight(70000, 0, 'united', 100),
  ] }, { locale: 'de' });
  assert.ok(result.outbound.status === 'ok');
  assert.deepEqual(result.outbound.options.map((f) => `${f.program}:${f.taxes.amount}`), ['aeroplan:200']);
  assert.deepEqual(result.filterNotes, []);
});
test('empty success, quota and provider failure remain distinct per leg', async () => {
  const resetsAt = new Date('2026-09-25T00:00:00Z');
  const result = await searchAwards(search({ inbound: { kind: 'day', date: '2026-11-20' } }), { searchTrips: async (params) => {
    if (params.origin === 'FRA') throw new SeatsAeroQuotaExhaustedError(resetsAt);
    throw new Error('network');
  } }, { locale: 'en' });
  assert.deepEqual(result.outbound, { status: 'failed', failure: { kind: 'rate_limited', resetsAt } });
  assert.deepEqual(result.inbound, { status: 'failed', failure: { kind: 'provider_unavailable' } });
  const empty = await searchAwards(search(), { searchTrips: async () => [] }, { locale: 'de' });
  assert.deepEqual(empty.outbound, { status: 'ok', options: [], foundCount: 0, tiering: null });
});
test('cancellation is rethrown instead of being shown as provider failure', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(searchAwards(search(), { searchTrips: async () => [] }, { locale: 'de', signal: controller.signal }), { name: 'AbortError' });
});
for (const locale of ['de', 'en'] as const) {
  test(`quota notice has Berlin summer/winter times and unknown-time fallback (${locale})`, () => {
    assert.match(formatAwardQuotaNotice(new Date('2026-09-24T00:00:00Z'), locale), /02:00/);
    assert.match(formatAwardQuotaNotice(new Date('2026-12-01T00:00:00Z'), locale), /01:00/);
    const notice = formatAwardQuotaNotice(null, locale);
    assert.doesNotMatch(notice, /seats\.aero|Invalid Date|\d\d:\d\d/i);
    assert.match(notice, locale === 'de' ? /täglichen Zurücksetzen/ : /daily reset/);
  });
}
