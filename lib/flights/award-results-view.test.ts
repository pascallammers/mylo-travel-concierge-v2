import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProgramDisplayName, getProgramBookingUrl, getProgramCaveat } from '@/lib/api/award-search/program-registry';
import { formatTransferRatio, getTransferSourcesForAwardProgram } from '@/lib/config/transfer-engine';
import { resolveFlightSearch } from './search-input';
import { buildAwardResultsView } from './award-results-view';
import type { AwardOption, AwardSearchResult } from './award-search';
const deps = { getProgramDisplayName, getProgramBookingUrl, getProgramCaveat, formatTransferRatio, getTransferSourcesForAwardProgram };
function search() {
  const resolved = resolveFlightSearch({ origin: 'FRA', destination: 'BKK', cabin: 'BUSINESS', passengers: 2,
    outbound: { kind: 'day', date: '2026-11-15', flexDays: 3 }, inbound: { kind: 'month', month: '2026-12' } }, '2026-09-24');
  assert.ok(resolved.ok); return resolved.search;
}
const flight: AwardOption = { id: 'one', program: 'aeroplan', airline: 'LH', cabin: 'Business', price: '70000 miles', pricePerPerson: '70000 miles',
  miles: 70000, taxes: { amount: 100, currency: 'EUR' }, tags: [], totalStops: 0, seatsLeft: 1,
  outbound: { departure: { airport: 'FRA', time: '2026-11-17T10:00:00Z' }, arrival: { airport: 'BKK', time: '2026-11-17T20:00:00Z' }, duration: '10h', flightNumbers: 'LH1', stops: 'Nonstop' } };

test('booking links use row date and rows flag insufficient seats and actual date offsets', () => {
  const result: AwardSearchResult = { outbound: { status: 'ok', foundCount: 1, options: [flight], tiering: null },
    inbound: { status: 'skipped', reason: 'one_way' }, filterNotes: [] };
  const leg = buildAwardResultsView(result, search(), 'de', deps).legs[0];
  assert.equal(leg.state, 'options');
  if (leg.state !== 'options') return;
  const row = leg.sections[0].programs[0].rows[0];
  assert.match(row.bookingUrl!, /2026-11-17/);
  assert.equal(row.enoughSeats, false);
  assert.equal(row.dayOffset, 2);
  assert.equal(row.flightNumbers, 'LH1');
});
test('tiers contain program groups with one caveat and only their DACH hint', () => {
  const result: AwardSearchResult = { outbound: { status: 'ok', foundCount: 3, tiering: { kind: 'direct_first' },
    options: [flight, { ...flight, id: 'two' }, { ...flight, id: 'three', program: 'lufthansa', totalStops: 1, seatsLeft: null }] },
    inbound: { status: 'skipped', reason: 'one_way' }, filterNotes: [] };
  const leg = buildAwardResultsView(result, search(), 'en', { ...deps, getProgramCaveat: () => 'Booking caveat' }).legs[0];
  assert.equal(leg.state, 'options'); if (leg.state !== 'options') return;
  assert.deepEqual(leg.sections.map((s) => s.stops), [0, 1]);
  assert.equal(leg.sections[0].programs.length, 1);
  assert.equal(leg.sections[0].programs[0].rows.length, 2);
  assert.equal(leg.sections[0].programs[0].caveat, 'Booking caveat');
  assert.equal(leg.sections[0].programs[0].dachTransferLine, null);
  assert.match(leg.sections[1].programs[0].dachTransferLine!, /PAYBACK/);
  assert.equal(leg.sections[1].programs[0].rows[0].enoughSeats, true);
});
test('failure, empty result and fallback notice stay on their own leg', () => {
  const result: AwardSearchResult = { outbound: { status: 'failed', failure: { kind: 'rate_limited', resetsAt: null } },
    inbound: { status: 'ok', foundCount: 1, options: [{ ...flight, totalStops: 2 }], tiering: { kind: 'no_direct', fallbackStops: 2 } }, filterNotes: ['filter'] };
  const view = buildAwardResultsView(result, search(), 'de', deps);
  assert.equal(view.legs[0].state, 'failed');
  assert.match(view.legs[0].notice!, /heute ausgelastet/);
  assert.equal(view.legs[1].origin, 'BKK');
  assert.match(view.legs[1].notice!, /2 Zwischenstopps/);
  assert.deepEqual(view.filterNotes, ['filter']);
  assert.equal(buildAwardResultsView({ ...result, outbound: { status: 'ok', foundCount: 0, options: [], tiering: null } }, search(), 'en', deps).legs[0].state, 'empty');
});
