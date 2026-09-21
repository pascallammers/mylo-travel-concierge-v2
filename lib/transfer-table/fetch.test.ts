import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFetchHtml, TRANSFER_FETCH_TIMEOUT_MS, TRANSFER_USER_AGENT } from './fetch';

test('source fetch uses desktop user agent, no cache and a 20-second deadline', async () => {
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
  assert.equal(TRANSFER_FETCH_TIMEOUT_MS, 20_000);
});

test('status, content type and network failures reject rather than parse an error page', async () => {
  await assert.rejects(
    createFetchHtml(async () => new Response('', { status: 403 }))('https://source.example'),
    /HTTP 403/,
  );
  await assert.rejects(
    createFetchHtml(async () => new Response('{}', { headers: { 'content-type': 'application/json' } }))(
      'https://source.example',
    ),
    /keine HTML/,
  );
  await assert.rejects(
    createFetchHtml(async () => {
      throw new Error('timeout');
    })('https://source.example'),
    /Verbindungsfehler oder Zeitüberschreitung/,
  );
  const failedBody = new ReadableStream({ start: (controller) => controller.error(new Error('stream aborted')) });
  await assert.rejects(
    createFetchHtml(async () => new Response(failedBody, { headers: { 'content-type': 'text/html' } }))(
      'https://source.example',
    ),
    /nicht vollständig gelesen/,
  );
});
