import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import type { PreviewAreaSlug } from '@/lib/shell/preview-areas';

let user: { id: string } | null = { id: 'member' };
const register = mock.fn(async (_userId: string, _area: PreviewAreaSlug) => {});
const refresh = mock.fn(() => {});
mock.module('next/cache', { namedExports: { refresh } });
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => user } });
mock.module('@/lib/db/queries/area-interest', { namedExports: { registerAreaInterest: register } });

const { registerAreaInterestAction } = createRequire(import.meta.url)('./area-interest-actions.ts') as typeof import('./area-interest-actions');

beforeEach(() => {
  user = { id: 'member' };
  register.mock.resetCalls();
  refresh.mock.resetCalls();
});

test('registers interest once for the authenticated user', async () => {
  assert.deepEqual(await registerAreaInterestAction('alerts'), { ok: true });
  assert.equal(register.mock.callCount(), 1);
  assert.deepEqual(register.mock.calls[0].arguments, ['member', 'alerts']);
  assert.equal(refresh.mock.callCount(), 1);
});

test('a double click succeeds both times', async () => {
  assert.deepEqual(await registerAreaInterestAction('alerts'), { ok: true });
  assert.deepEqual(await registerAreaInterestAction('alerts'), { ok: true });
  assert.deepEqual(register.mock.calls.map((call) => call.arguments), [
    ['member', 'alerts'], ['member', 'alerts'],
  ]);
});

test('accepts cards as a preview area', async () => {
  assert.deepEqual(await registerAreaInterestAction('cards'), { ok: true });
  assert.deepEqual(register.mock.calls[0].arguments, ['member', 'cards']);
});

test('requires login before validating input or calling the query', async () => {
  user = null;
  for (const area of ['alerts', 'hotels', '../x']) {
    assert.deepEqual(await registerAreaInterestAction(area), { ok: false, reason: 'unauthenticated' });
  }
  assert.equal(register.mock.callCount(), 0);
  assert.equal(refresh.mock.callCount(), 0);
});

test('rejects unknown areas without calling the query', async () => {
  for (const area of ['hotels', '../x']) {
    assert.deepEqual(await registerAreaInterestAction(area), { ok: false, reason: 'unknown_area' });
  }
  assert.equal(register.mock.callCount(), 0);
  assert.equal(refresh.mock.callCount(), 0);
});

test('propagates database errors', async () => {
  const error = new Error('Database unavailable');
  register.mock.mockImplementationOnce(async () => { throw error; });
  await assert.rejects(registerAreaInterestAction('alerts'), (caught) => caught === error);
});
