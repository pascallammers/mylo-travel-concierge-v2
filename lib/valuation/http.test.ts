import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleValuationCron } from './http';

test('cron authenticates before running and hides internal failure details', async () => {
  for (const [header, secret] of [
    [null, 'secret'],
    ['Bearer wrong', 'secret'],
    ['Bearer undefined', undefined],
  ] as const) {
    const request = new Request('https://mylo.example', { headers: header ? { authorization: header } : {} });
    assert.equal(
      (await handleValuationCron(request, secret, async () => assert.fail('unauthorized work'))).status,
      401,
    );
  }
  const request = new Request('https://mylo.example', { headers: { authorization: 'Bearer secret' } });
  const result = { stale: 3, tableAsOf: '2026-09' };
  const response = await handleValuationCron(request, 'secret', async () => result);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  const failure = await handleValuationCron(request, 'secret', async () => {
    throw new Error('secret connection string');
  });
  assert.equal(failure.status, 500);
  assert.ok(!(await failure.text()).includes('secret'));
});
