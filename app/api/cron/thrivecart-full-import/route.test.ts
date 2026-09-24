import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

process.env.SKIP_ENV_VALIDATION = '1';
const require = createRequire(import.meta.url);
let importRuns = 0;
mock.module('@/env/server', { namedExports: { serverEnv: { CRON_SECRET: 'cron-secret' } } });
mock.module('@/lib/thrivecart/transaction-import', {
  namedExports: {
    runFullTransactionImport: async () => {
      importRuns += 1;
      return { totalFetched: 0, totalInserted: 0, totalSkipped: 0, errors: [] };
    },
  },
});
const { POST } = require('./route.ts') as typeof import('./route');

function request(headers: Record<string, string>) {
  return new NextRequest('https://example.test/api/cron/thrivecart-full-import', { method: 'POST', headers });
}

beforeEach(() => {
  importRuns = 0;
});

test('rejects requests without credentials or with only an upstash-signature header', async () => {
  for (const headers of [{}, { 'upstash-signature': 'made-up' }, { authorization: 'Bearer wrong' }]) {
    const response = await POST(request(headers));
    assert.equal(response.status, 401);
  }
  assert.equal(importRuns, 0);
});

test('runs the import for the forwarded CRON_SECRET bearer token', async () => {
  const response = await POST(request({ authorization: 'Bearer cron-secret' }));
  assert.equal(response.status, 200);
  assert.equal(importRuns, 1);
});
