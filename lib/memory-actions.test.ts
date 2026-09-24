import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';

const require = createRequire(import.meta.url);
let session: { id: string } | null = { id: 'owner' };
let tags: string[] | undefined;
let missing = false;
const calls: string[] = [];
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => session } });
mock.module('@/env/server', { namedExports: { serverEnv: { SUPERMEMORY_API_KEY: 'test' } } });
mock.module('supermemory', { namedExports: { Supermemory: class {
  memories = {
    get: async (id: string) => {
      calls.push('get'); assert.equal(id, 'memory');
      if (missing) throw new Error('Not found');
      return { id, containerTags: tags };
    },
    delete: async () => { calls.push('delete'); return { id: 'memory' }; },
    list: async (input: { containerTags: string[] }) => { assert.deepEqual(input.containerTags, ['owner']); return { memories: [], pagination: { totalItems: 0 } }; },
    add: async (input: { containerTag: string }) => { assert.equal(input.containerTag, 'owner'); return { id: 'memory' }; },
  };
  search = { memories: async (input: { containerTag: string }) => { assert.equal(input.containerTag, 'owner'); return { total: 0 }; } };
} } });
const actions: typeof import('./memory-actions') = require('./memory-actions.ts');
beforeEach(() => { session = { id: 'owner' }; tags = ['owner']; missing = false; calls.length = 0; });
for (const state of ['no session', 'foreign owner', 'missing tags', 'empty tags', 'missing memory', 'owner'] as const) {
  test('deleteMemory: ' + state, async () => {
    if (state === 'no session') session = null;
    if (state === 'foreign owner') tags = ['victim'];
    if (state === 'missing tags') tags = undefined;
    if (state === 'empty tags') tags = [];
    if (state === 'missing memory') missing = true;
    if (state === 'owner') assert.deepEqual(await actions.deleteMemory('memory'), { id: 'memory' });
    else await assert.rejects(() => actions.deleteMemory('memory'));
    assert.equal(calls.includes('delete'), state === 'owner');
    if (!session) assert.deepEqual(calls, []);
  });
}
for (const name of ['searchMemories', 'getAllMemories'] as const) {
  test(name + ': anonymous is rejected', async () => {
    session = null;
    await assert.rejects(() => Reflect.apply(actions[name], undefined, name === 'searchMemories' ? ['travel'] : []), /Authentication required/);
  });
  test(name + ': uses the session container', async () => {
    assert.deepEqual(await Reflect.apply(actions[name], undefined, name === 'searchMemories' ? ['travel'] : []), { memories: [], total: 0 });
  });
}
test('saveMemoryFromChat: anonymous is rejected', async () => {
  session = null;
  assert.equal((await actions.saveMemoryFromChat('Travel preference', { messageRole: 'user', timestamp: 'now' })).success, false);
});
test('saveMemoryFromChat: uses the session container', async () => {
  assert.equal((await actions.saveMemoryFromChat('Travel preference', { messageRole: 'user', timestamp: 'now' })).success, true);
});
