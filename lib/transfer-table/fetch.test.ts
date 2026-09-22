import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFetchHtml, TRANSFER_FETCH_TIMEOUT_MS, TRANSFER_USER_AGENT } from './fetch';

test('source fetch uses desktop user agent, no cache and a 15-second deadline', async () => {
  let options: RequestInit | undefined;
  const loader = createFetchHtml(async (_url, init) => {
    options = init;
    return new Response('<html>source</html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  assert.equal(await loader('https://source.example'), '<html>source</html>');
  assert.equal(new Headers(options?.headers).get('user-agent'), TRANSFER_USER_AGENT);
  assert.match(TRANSFER_USER_AGENT, /Mozilla.*Chrome.*Safari/);
  assert.equal(options?.cache, 'no-store');
  assert.ok(options?.signal instanceof AbortSignal);
  assert.equal(TRANSFER_FETCH_TIMEOUT_MS, 15_000);
});

test('status, content type and network failures reject rather than parse an error page', async () => {
  await assert.rejects(
    createFetchHtml(async () => new Response('', { status: 403 }), 0)('https://source.example'),
    /HTTP 403/,
  );
  await assert.rejects(
    createFetchHtml(
      async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
      0,
    )('https://source.example'),
    /keine HTML/,
  );
  await assert.rejects(
    createFetchHtml(async () => {
      throw new Error('timeout');
    }, 0)('https://source.example'),
    /Verbindungsfehler oder Zeitüberschreitung/,
  );
  // Each attempt needs its own failing stream: a consumed stream cannot be reused.
  const failedBody = () => new ReadableStream({ start: (controller) => controller.error(new Error('stream aborted')) });
  await assert.rejects(
    createFetchHtml(
      async () => new Response(failedBody(), { headers: { 'content-type': 'text/html' } }),
      0,
    )('https://source.example'),
    /nicht vollständig gelesen/,
  );
});

test('a stalled connection is retried before the source counts as failed', async () => {
  let calls = 0;
  const flaky = createFetchHtml(async () => {
    calls += 1;
    if (calls < 3) throw new DOMException('stalled', 'TimeoutError');
    return new Response('<html>ok</html>', { headers: { 'content-type': 'text/html' } });
  }, 0);
  assert.equal(await flaky('https://source.example'), '<html>ok</html>');
  assert.equal(calls, 3);
  calls = 0;
  const dead = createFetchHtml(async () => {
    calls += 1;
    throw new DOMException('stalled', 'TimeoutError');
  }, 0);
  await assert.rejects(dead('https://source.example'), /Zeitüberschreitung: TimeoutError/);
  assert.equal(calls, 3);
});

test('definite status and content-type failures are not retried, 5xx and 429 are', async () => {
  for (const [status, expected] of [
    [403, 1],
    [404, 1],
    [429, 3],
    [503, 3],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      createFetchHtml(async () => {
        calls += 1;
        return new Response('', { status });
      }, 0)('https://source.example'),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(calls, expected, `HTTP ${status}`);
  }
  let calls = 0;
  await assert.rejects(
    createFetchHtml(async () => {
      calls += 1;
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }, 0)('https://source.example'),
    /keine HTML/,
  );
  assert.equal(calls, 1);
});
