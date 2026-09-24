import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkChatAccess, getAdminAuthError } from './auth-guards';

test('chat guard denies missing session, missing resource and another owner', () => {
  assert.deepEqual(checkChatAccess({ user: null, chat: undefined }), { ok: false, reason: 'unauthenticated' });
  assert.deepEqual(checkChatAccess({ user: { id: 'owner' }, chat: undefined }), { ok: false, reason: 'not_found' });
  assert.deepEqual(checkChatAccess({ user: { id: 'owner' }, chat: { userId: 'victim' } }), {
    ok: false,
    reason: 'forbidden',
  });
  assert.deepEqual(checkChatAccess({ user: { id: 'owner' }, chat: { userId: 'owner' } }), { ok: true });
});
test('admin guard does not read a role without a session', async () => {
  const response = await getAdminAuthError({
    getUser: async () => null,
    getUserRole: async () => {
      assert.fail('must not read role');
    },
  });
  assert.equal(response?.status, 401);
});
test('admin guard only accepts the persisted admin role', async () => {
  for (const role of ['user', 'admin']) {
    const response = await getAdminAuthError({
      getUser: async () => ({ id: 'session-user' }),
      getUserRole: async (id) => {
        assert.equal(id, 'session-user');
        return role;
      },
    });
    assert.equal(response?.status ?? 200, role === 'admin' ? 200 : 403);
  }
});
