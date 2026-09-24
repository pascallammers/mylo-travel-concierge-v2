import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasFlightSearchAccess } from './flight-search-access';

test('guests do not invoke access infrastructure; paid access is required for authenticated users', async () => {
  const calls: string[] = [];
  const check = async (id: string) => { calls.push(id); return { hasAccess: id === 'subscriber' }; };
  for (const guest of [null, undefined, '']) assert.equal(await hasFlightSearchAccess(guest, check), false);
  assert.deepEqual(calls, []);
  assert.equal(await hasFlightSearchAccess('subscriber', check), true);
  assert.equal(await hasFlightSearchAccess('expired', check), false);
  assert.deepEqual(calls, ['subscriber', 'expired']);
});
