import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';

const require = createRequire(import.meta.url);
mock.module('server-only', { namedExports: {} });
mock.module('@/lib/auth-utils', {
  namedExports: {
    getUser: async () => {
      assert.fail('background titles must not look up a request session');
    },
  },
});
mock.module('@/ai/providers', { namedExports: { scira: { languageModel: (name: string) => name } } });
mock.module('ai', {
  namedExports: {
    generateText: async (input: { model: string; prompt: string }) => {
      assert.equal(input.model, 'scira-name');
      assert.equal(JSON.parse(input.prompt).id, 'message');
      return { text: 'Trip to Tokyo' };
    },
  },
});
const { generateChatTitle }: typeof import('./chat-title') = require('./chat-title.ts');
test('trusted background title generation works without request session APIs', async () => {
  assert.equal(
    await generateChatTitle({ message: { id: 'message', role: 'user', parts: [{ type: 'text', text: 'Tokyo' }] } }),
    'Trip to Tokyo',
  );
});
