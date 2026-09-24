import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';

const require = createRequire(import.meta.url);
const calls: { userId: string; months?: number }[] = [];
const cache = new Map<string, number>();
let fail = false;
mock.module('server-only', { namedExports: {} });
mock.module('@/lib/auth-utils', {
  namedExports: {
    getUser: async () => {
      assert.fail('internal reads must not resolve a request session');
    },
  },
});
function query(result: unknown) {
  return async (input: { userId: string; months?: number }) => {
    calls.push(input);
    if (fail) throw new Error('database unavailable');
    return result;
  };
}
mock.module('@/lib/db/queries', {
  namedExports: {
    getMessageCount: query(7),
    getExtremeSearchCount: query(2),
    getHistoricalUsageData: query([{ date: new Date(), messageCount: 13 }]),
    getCustomInstructionsByUserId: query({ content: 'instructions' }),
  },
});
mock.module('@/lib/performance-cache', {
  namedExports: {
    usageCountCache: {
      get: (key: string) => cache.get(key) ?? null,
      set: (key: string, value: number) => cache.set(key, value),
    },
    createMessageCountKey: (id: string) => `messages:${id}`,
    createExtremeCountKey: (id: string) => `extreme:${id}`,
  },
});
const records: typeof import('./user-records') = require('./user-records.ts');
beforeEach(() => {
  calls.length = 0;
  cache.clear();
  fail = false;
});
for (const name of [
  'getUserMessageCountForUser',
  'getExtremeSearchUsageCountForUser',
  'getHistoricalUsageForUser',
  'getCustomInstructionsForUser',
] as const) {
  test(name + ': uses the trusted server ID without a second session lookup', async () => {
    assert.ok(await records[name]('trusted-user'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].userId, 'trusted-user');
  });
  test(name + ': preserves its database failure contract', async () => {
    fail = true;
    const result = await records[name]('trusted-user');
    if (name === 'getHistoricalUsageForUser') assert.deepEqual(result, []);
    else if (name === 'getCustomInstructionsForUser') assert.equal(result, null);
    else {
      assert.equal((result as { count: number }).count, 0);
      assert.ok((result as { error: string }).error);
    }
  });
}
test('usage caches are separated by account and query type', async () => {
  await records.getUserMessageCountForUser('one');
  await records.getUserMessageCountForUser('one');
  await records.getExtremeSearchUsageCountForUser('one');
  await records.getUserMessageCountForUser('two');
  assert.equal(calls.length, 3);
  assert.equal(cache.get('messages:one'), 7);
  assert.equal(cache.get('extreme:one'), 2);
  assert.equal(cache.get('messages:two'), 7);
});
test('historical usage preserves daily points and activity levels', async () => {
  const result = await records.getHistoricalUsageForUser('trusted-user', 1);
  assert.equal(calls[0].months, 1);
  assert.equal(result.length, 30);
  assert.ok(result.some((day) => day.count === 13 && day.level === 4));
  assert.ok(result.some((day) => day.count === 0 && day.level === 0));
});
