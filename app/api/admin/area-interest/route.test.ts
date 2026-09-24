import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';

let user: { id: string } | null = { id: 'admin' };
let role = 'admin';
const getUserRole = mock.fn(async (_userId: string) => role);
const count = mock.fn(async () => ({ alerts: 3, cards: 0 }));

mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => user, getUserRole } });
mock.module('@/lib/db/queries/area-interest', { namedExports: { countAreaInterestByArea: count } });
const { GET } = createRequire(import.meta.url)('./route.ts') as typeof import('./route');

beforeEach(() => {
  user = { id: 'admin' };
  role = 'admin';
  getUserRole.mock.resetCalls();
  count.mock.resetCalls();
});

test('admin area interest returns both areas, including zero counts', async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { counts: { alerts: 3, cards: 0 } });
  assert.deepEqual(getUserRole.mock.calls[0].arguments, ['admin']);
  assert.equal(count.mock.callCount(), 1);
});

test('admin area interest rejects logged-out visitors without loading counts or roles', async () => {
  user = null;
  assert.equal((await GET()).status, 401);
  assert.equal(getUserRole.mock.callCount(), 0);
  assert.equal(count.mock.callCount(), 0);
});

test('admin area interest rejects non-admins without loading counts', async () => {
  role = 'user';
  assert.equal((await GET()).status, 403);
  assert.equal(count.mock.callCount(), 0);
});

test('admin area interest propagates query failures instead of returning zero counts', async () => {
  count.mock.mockImplementationOnce(async () => { throw new Error('Database unavailable'); });
  await assert.rejects(GET(), /Database unavailable/);
});
