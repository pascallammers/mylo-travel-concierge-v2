import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';

const require = createRequire(import.meta.url);
let sessions = 0;
mock.module('@/app/actions', {
  namedExports: {
    getCurrentUser: async () => {
      sessions++;
      return null;
    },
    getGroupConfig: async () => {
      assert.fail('must authenticate before configuring tools');
    },
  },
});
// Isolate the public request boundary from model, database and provider clients.
for (const modulePath of [
  'server-only',
  '@/lib/chat/search-recovery-glue',
  '@/lib/chat/stream-failure-recovery',
  '@/lib/utils/loyalty-prompt-formatter',
  '@/lib/chat/flight-intent-detector',
  '@/lib/chat-title',
  '@/lib/user-records',
  'ai',
  '@/lib/tools/supermemory',
  '@/ai/providers',
  '@/ai/failover',
  '@ai-sdk/gateway',
  '@/lib/db/queries',
  'resumable-stream',
  'next/server',
  '@vercel/functions',
  '@/lib/tools',
  '@/lib/tools/flight-search',
  '@/lib/tools/loyalty-balances',
  '@/lib/parser',
  '@/lib/db/queries/awardwallet',
  '@/lib/observability/failover-recorder',
]) {
  mock.module(modulePath, { namedExports: {} });
}
const { POST }: typeof import('./route') = require('./route.ts');
test('search rejects anonymous requests before parsing input or starting a model', async () => {
  const response = await POST(new Request('http://localhost/api/search', { method: 'POST', body: '{' }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthorized:chat');
  assert.equal(sessions, 1);
});
