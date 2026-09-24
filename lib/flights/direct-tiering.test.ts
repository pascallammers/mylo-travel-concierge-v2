import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupByProgram } from '@/lib/api/award-search/program-grouping';
import { describeDirectTiering, tierAwardTrips } from './direct-tiering';

const trip = (totalStops: number, miles = 45000, program = 'aeroplan') => ({ totalStops, miles, program });

test('direct awards lead and survive cheaper connections in the same program', () => {
  const direct = trip(0, 90000);
  const connections = [trip(1, 40000), trip(1, 41000), trip(1, 42000), trip(1, 43000)];
  const result = tierAwardTrips([...connections, direct], 'direct');
  assert.deepEqual(result.options, [direct, ...connections.slice(0, 3)]);
  assert.deepEqual(result.tiering, { kind: 'direct_first' });
});
test('one-stop fallback preserves programs and drops higher stop counts', () => {
  const one = trip(1);
  const other = trip(1, 50000, 'united');
  assert.deepEqual(tierAwardTrips([trip(2, 10000), one, other], 'direct'), {
    options: [one, other], tiering: { kind: 'no_direct', fallbackStops: 1 },
  });
});
test('mixed direct, one-stop and two-stop options retain only the first two tiers', () => {
  assert.deepEqual(tierAwardTrips([trip(2), trip(1), trip(0)], 'direct').options, [trip(0), trip(1)]);
});
test('two-stop-only routes report their actual fallback count', () => {
  const result = tierAwardTrips([trip(2), trip(3)], 'direct');
  assert.deepEqual(result.tiering, { kind: 'no_direct', fallbackStops: 2 });
  assert.match(describeDirectTiering(result.tiering, { cabin: 'BUSINESS', leg: 'inbound', locale: 'de' })!, /^Rückflug: .*2 Zwischenstopps\.$/);
  assert.match(describeDirectTiering(result.tiering, { cabin: 'FIRST', leg: 'outbound', locale: 'en' })!, /^Outbound: .*First.*2 stops\.$/);
});
test('any preference equals historical grouping without mutating input', () => {
  const trips = [trip(1), trip(0, 90000), trip(2, 10000, 'united')];
  const before = structuredClone(trips);
  assert.deepEqual(tierAwardTrips(trips, 'any'), { options: groupByProgram(trips), tiering: null });
  assert.deepEqual(trips, before);
});
test('empty and direct-only results have no fallback notice; null miles sort last', () => {
  assert.deepEqual(tierAwardTrips([], 'direct'), { options: [], tiering: null });
  assert.equal(describeDirectTiering(null, { cabin: 'ECONOMY', leg: null, locale: 'de' }), null);
  assert.equal(describeDirectTiering(tierAwardTrips([trip(0)], 'direct').tiering, { cabin: 'BUSINESS', leg: null, locale: 'en' }), null);
  assert.deepEqual(tierAwardTrips([{ ...trip(0), miles: null }, trip(0)], 'any').options.map((t) => t.miles), [45000, null]);
});
