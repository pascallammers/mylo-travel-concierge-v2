import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';

const require = createRequire(import.meta.url);
let chat: { userId: string } | undefined = { userId: 'victim' };
const reads: unknown[] = [];
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => ({ id: 'owner' }) } });
mock.module('@/lib/db/queries', {
  namedExports: {
    getChatById: async () => chat,
    getChatsByUserId: async (input: unknown) => {
      reads.push(input);
      return { chats: [], hasMore: false };
    },
    deleteChatById: async () => {
      throw new Error('database unavailable');
    },
    updateChatTitleById: async () => {
      throw new Error('database unavailable');
    },
    updateChatVisibilityById: async () => ({}),
    getMessageById: async () => [],
    deleteMessagesByChatIdAfterTimestamp: async () => undefined,
  },
});
const actions: typeof import('./chat-actions') = require('./chat-actions.ts');
test('foreign and missing cursors cannot be used to paginate another account', async () => {
  for (chat of [{ userId: 'victim' }, undefined]) {
    assert.deepEqual(await actions.loadMoreChats('cursor'), { chats: [], hasMore: false });
    assert.deepEqual(await actions.getUserChats(20, undefined, 'cursor'), { chats: [], hasMore: false });
  }
  assert.deepEqual(reads, []);
});
test('invalid page limits are rejected before database access', async () => {
  for (const limit of [0, -1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(await actions.getUserChats(limit), { chats: [], hasMore: false });
    assert.deepEqual(await actions.loadMoreChats('cursor', limit), { chats: [], hasMore: false });
  }
  assert.deepEqual(reads, []);
});
test('null failure contracts survive database errors', async () => {
  chat = { userId: 'owner' };
  assert.equal(await actions.deleteChat('chat'), null);
  assert.equal(await actions.updateChatTitle('chat', 'Title'), null);
});
