import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';

process.env.SKIP_ENV_VALIDATION = '1';
const require = createRequire(import.meta.url);
let session: { id: string } | null = { id: 'user' };
const calls: string[] = [];
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => session } });
mock.module('next/server', { namedExports: { NextResponse, after: () => undefined } });
mock.module('@/lib/xai/voice', { namedExports: {
  createXaiRealtimeClientSecret: async () => { calls.push('voice'); return { value: 'secret' }; },
  buildXaiRealtimeSessionConfig: () => ({ model: 'voice' }),
  transcribeAudioWithFallback: async () => { calls.push('transcribe'); return 'transcript'; },
} });
mock.module('@/lib/tools/knowledge-base-query', { namedExports: {
  queryKnowledgeBase: async () => { calls.push('query'); return { status: 'found', answer: 'answer' }; },
} });
const route: typeof import('./route') = require('./route.ts');
beforeEach(() => { session = { id: 'user' }; calls.length = 0; });
function request() {
  return new NextRequest('http://localhost/api/voice/session', { method: 'POST', body: '{}' });
}
test('no session: returns 401 without calling paid services', async () => {
  session = null;
  assert.equal((await route.POST(request())).status, 401);
  assert.deepEqual(calls, []);
});
test('authenticated request works', async () => {
  assert.equal((await route.POST(request())).status, 200);
  assert.deepEqual(calls, ['voice']);
});
test('no session: rejects before parsing malformed input', async () => {
  session = null;
  assert.equal((await route.POST(new NextRequest('http://localhost', { method: 'POST', body: '{' }))).status, 401);
  assert.deepEqual(calls, []);
});
