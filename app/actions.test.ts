import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';

process.env.SKIP_ENV_VALIDATION = '1';
const require = createRequire(import.meta.url);
mock.module('server-only', { namedExports: {} });
const owner = { id: 'owner', isProUser: true };
let session: typeof owner | null = owner;
let chat: { id: string; userId: string } | undefined;
let messages: { id: string; chatId: string; createdAt: Date }[];
let connections: { id: string; metadata?: { userId: string } }[] = [];
const calls: { name: string; args: unknown[] }[] = [];
const cache = new Map<string, number>();
function spy(name: string, result: unknown = null) {
  return async (...args: unknown[]) => {
    calls.push({ name, args });
    return result;
  };
}
const queryNames = [
  'deleteChatById',
  'updateChatTitleById',
  'deleteMessagesByChatIdAfterTimestamp',
  'incrementMessageUsage',
  'createCustomInstructions',
  'updateCustomInstructions',
  'deleteCustomInstructions',
  'getPaymentsByUserId',
];
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => session } });
mock.module('@/lib/user-data-server', {
  namedExports: { getComprehensiveUserData: async () => session, isUserPro: async () => Boolean(session) },
});
mock.module('@/env/server', { namedExports: { serverEnv: {} } });
mock.module('@/lib/db/queries', {
  namedExports: {
    ...Object.fromEntries(queryNames.map((name) => [name, spy(name, { id: 'chat' })])),
    getChatById: async () => {
      calls.push({ name: 'getChatById', args: [] });
      return chat;
    },
    getMessageById: async () => {
      calls.push({ name: 'getMessageById', args: [] });
      return messages;
    },
    getChatsByUserId: spy('getChatsByUserId', { chats: [{ id: 'chat', userId: 'owner' }], hasMore: false }),
    updateChatVisibilityById: spy('updateChatVisibilityById', { rowCount: 1 }),
    getMessageCount: spy('getMessageCount', 7),
    getExtremeSearchCount: spy('getExtremeSearchCount', 2),
    getHistoricalUsageData: spy('getHistoricalUsageData', [{ date: new Date(), messageCount: 3 }]),
    getCustomInstructionsByUserId: spy('getCustomInstructionsByUserId', { content: 'owner instructions' }),
  },
});
mock.module('@/lib/performance-cache', {
  namedExports: {
    usageCountCache: {
      get: (key: string) => cache.get(key) ?? null,
      set: (key: string, value: number) => cache.set(key, value),
      delete: (key: string) => cache.delete(key),
    },
    createMessageCountKey: (id: string) => `messages:${id}`,
    createExtremeCountKey: (id: string) => `extreme:${id}`,
  },
});
mock.module('ai', { namedExports: { generateText: spy('generateText', { text: 'Generated title' }) } });
mock.module('@/ai/providers', { namedExports: { languageModel: {}, scira: { languageModel: () => ({}) } } });
mock.module('@ai-sdk/groq', { namedExports: { groq: () => ({}) } });
mock.module('@/lib/xai/voice', { namedExports: { generateXaiSpeech: spy('generateXaiSpeech', 'audio') } });
mock.module('@/lib/chat/tool-registry', { namedExports: { enabledModuleToolNames: () => [] } });
mock.module('@/lib/chat/mylo-system-prompt', { namedExports: { buildMyloWebSystemPrompt: () => '' } });
mock.module('@/lib/connectors', {
  namedExports: {
    createConnection: spy('createConnection'),
    listUserConnections: async (id: string) => {
      calls.push({ name: 'listUserConnections', args: [id] });
      return connections;
    },
    deleteConnection: spy('deleteConnection', { id: 'connection' }),
    manualSync: spy('manualSync'),
    getSyncStatus: spy('getSyncStatus'),
  },
});
// Synchronous require lets node:test register mocks before loading the action boundary.
const actions: typeof import('./actions') = require('./actions.ts');
const chatActions: typeof import('./chat-actions') = require('./chat-actions.ts');

beforeEach(() => {
  session = owner;
  chat = { id: 'chat', userId: owner.id };
  messages = [{ id: 'message', chatId: 'chat', createdAt: new Date('2026-01-01') }];
  connections = [{ id: 'connection', metadata: { userId: 'owner' } }];
  calls.length = 0;
  cache.clear();
});
const mutations = [
  { name: 'deleteChat', call: () => chatActions.deleteChat('chat'), db: 'deleteChatById', throws: false },
  {
    name: 'updateChatTitle',
    call: () => chatActions.updateChatTitle('chat', ' Updated '),
    db: 'updateChatTitleById',
    throws: false,
  },
  {
    name: 'updateChatVisibility',
    call: () => chatActions.updateChatVisibility('chat', 'public'),
    db: 'updateChatVisibilityById',
    throws: true,
  },
  {
    name: 'deleteTrailingMessages',
    call: () => chatActions.deleteTrailingMessages({ id: 'message' }),
    db: 'deleteMessagesByChatIdAfterTimestamp',
    throws: true,
  },
];
for (const action of mutations) {
  for (const state of ['no session', 'foreign user', 'missing chat'] as const) {
    test(`${action.name}: ${state} is rejected without mutation`, async () => {
      if (state === 'no session') session = null;
      if (state === 'foreign user') chat = { id: 'chat', userId: 'victim' };
      if (state === 'missing chat') chat = undefined;
      if (action.throws) await assert.rejects(action.call, /Unauthorized/);
      else assert.equal(await action.call(), null);
      assert.equal(
        calls.some((call) => call.name === action.db),
        false,
      );
      if (!session) assert.equal(calls.length, 0);
    });
  }
  test(`${action.name}: owner works`, async () => {
    await action.call();
    assert.equal(calls.filter((call) => call.name === action.db).length, 1);
  });
}
test('deleteTrailingMessages: missing message has the same plain failure', async () => {
  messages = [];
  await assert.rejects(() => chatActions.deleteTrailingMessages({ id: 'missing' }), /Unauthorized/);
  assert.equal(
    calls.some((call) => call.name === 'deleteMessagesByChatIdAfterTimestamp'),
    false,
  );
});
for (const name of ['getUserChats', 'loadMoreChats'] as const) {
  const run = () => Reflect.apply(chatActions[name], undefined, name === 'getUserChats' ? [20] : ['chat', 20]);
  test(`${name}: no session returns no chats and does not read the DB`, async () => {
    session = null;
    assert.deepEqual(await run(), { chats: [], hasMore: false });
    assert.equal(calls.length, 0);
  });
  test(`${name}: client user id cannot select a foreign account`, async () => {
    await Reflect.apply(chatActions[name], undefined, name === 'getUserChats' ? ['victim', 20] : ['victim', 'chat', 20]);
    assert.equal(
      calls.some((call) => call.name === 'getChatsByUserId'),
      false,
    );
  });
  test(`${name}: owner works using the session identity`, async () => {
    assert.deepEqual(await run(), { chats: [{ id: 'chat', userId: 'owner' }], hasMore: false });
    const read = calls.find((call) => call.name === 'getChatsByUserId');
    assert.equal((read?.args[0] as { id: string }).id, 'owner');
  });
}
test('getUserChats: a foreign pagination cursor is rejected', async () => {
  chat = { id: 'foreign-cursor', userId: 'victim' };
  assert.deepEqual(await Reflect.apply(chatActions.getUserChats, undefined, [20, 'foreign-cursor']), {
    chats: [],
    hasMore: false,
  });
  assert.equal(
    calls.some((call) => call.name === 'getChatsByUserId'),
    false,
  );
});
test('getChatInfo is no longer exported', () => {
  assert.equal('getChatInfo' in actions, false);
});

const reads = [
  { name: 'getUserMessageCount', db: 'getMessageCount', anonymous: { count: 0, error: 'User not found' } },
  { name: 'getExtremeSearchUsageCount', db: 'getExtremeSearchCount', anonymous: { count: 0, error: 'User not found' } },
  { name: 'getHistoricalUsage', db: 'getHistoricalUsageData', anonymous: [] },
  { name: 'getCustomInstructions', db: 'getCustomInstructionsByUserId', anonymous: null },
] as const;
for (const read of reads) {
  test(`${read.name}: no session rejects even a supplied user, without DB access`, async () => {
    session = null;
    const result = await Reflect.apply(actions[read.name], undefined, [{ id: 'victim' }, 9]);
    assert.deepEqual(result, read.anonymous);
    assert.equal(calls.length, 0);
  });
  test(`${read.name}: foreign user input never reads victim data`, async () => {
    await Reflect.apply(actions[read.name], undefined, [{ id: 'victim' }, 9]);
    assert.equal(
      calls.some((call) => call.name === read.db && (call.args[0] as { userId: string }).userId !== owner.id),
      false,
    );
    assert.equal(
      calls.some((call) => queryNames.includes(call.name)),
      false,
    );
  });
  test(`${read.name}: owner works`, async () => {
    const result = await Reflect.apply(actions[read.name], undefined, read.name === 'getHistoricalUsage' ? [9] : []);
    assert.ok(result);
    const query = calls.find((call) => call.name === read.db);
    assert.equal((query?.args[0] as { userId: string }).userId, owner.id);
    if (read.name === 'getHistoricalUsage') assert.equal((result as unknown[]).length, 270);
  });
}
for (const name of ['getUserMessageCount', 'getExtremeSearchUsageCount'] as const) {
  test(`${name}: cached data remains scoped to the session user`, async () => {
    cache.set('messages:victim', 999);
    cache.set('extreme:victim', 999);
    await Reflect.apply(actions[name], undefined, [{ id: 'victim' }]);
    const result = await Reflect.apply(actions[name], undefined, []);
    assert.equal(result.count, name === 'getUserMessageCount' ? 7 : 2);
    assert.equal(calls.length, 1);
  });
}
const aiActions = [
  {
    name: 'suggestQuestions',
    call: () =>
      actions.suggestQuestions([
        { role: 'user', content: 'Travel?' },
        { role: 'assistant', content: 'Tokyo.' },
      ]),
  },
  { name: 'checkImageModeration', call: () => actions.checkImageModeration(['https://example.com/image.png']) },
  {
    name: 'generateTitleFromUserMessage',
    call: () =>
      actions.generateTitleFromUserMessage({
        message: { id: 'message', role: 'user', parts: [{ type: 'text', text: 'Travel' }] },
      }),
  },
  { name: 'generateSpeech', call: () => actions.generateSpeech('Travel') },
  { name: 'getGroupConfig', call: () => actions.getGroupConfig('web') },
];
for (const action of aiActions) {
  test(`${action.name}: no session rejects before model calls`, async () => {
    session = null;
    await assert.rejects(action.call, /Authentication required/);
    assert.equal(calls.length, 0);
  });
  test(`${action.name}: authenticated user works`, async () => {
    assert.ok(await action.call());
  });
}
test('enhancePrompt: no session rejects before model calls', async () => {
  session = null;
  assert.equal((await actions.enhancePrompt('Travel')).success, false);
  assert.equal(calls.length, 0);
});
test('enhancePrompt: authenticated Pro user works', async () => {
  assert.equal((await actions.enhancePrompt('Travel')).success, true);
  assert.equal(calls.filter((call) => call.name === 'generateText').length, 1);
});
for (const state of ['no session', 'foreign user', 'owner'] as const) {
  test(`deleteConnectorAction: ${state}`, async () => {
    if (state === 'no session') session = null;
    if (state === 'foreign user') connections = [{ id: 'other' }];
    const result = await actions.deleteConnectorAction('connection');
    assert.equal(result.success, state === 'owner');
    assert.equal(
      calls.some((call) => call.name === 'deleteConnection'),
      state === 'owner',
    );
  });
}

for (const metadata of [undefined, { userId: 'victim' }]) {
  test(
    'deleteConnectorAction: rejects a matching ID without verified owner metadata ' + JSON.stringify(metadata),
    async () => {
      connections = [{ id: 'connection', metadata }];
      assert.equal((await actions.deleteConnectorAction('connection')).success, false);
      assert.equal(
        calls.some((call) => call.name === 'deleteConnection'),
        false,
      );
    },
  );
}
