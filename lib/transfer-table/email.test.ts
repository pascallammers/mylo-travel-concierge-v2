import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTransferTableEmail } from './email';
import { createHarness } from './test-support';
import { runTransferTableCheck } from './check';

test('email escapes source content and explains held changes and missing metadata', async () => {
  const { state, deps } = createHarness();
  state.paybackHtml = state.paybackHtml.replace('1:1', '2:1');
  await runTransferTableCheck(deps);
  const check = state.checks[1];
  check.changes.push({
    type: 'partner_added',
    observation: { sourceName: '<img src=x>', sourceCode: 'NEW', sourcePoints: 1, partnerUnits: 1, minTransfer: 100 },
  });
  check.error = '<script>alert(1)</script>';
  const html = renderTransferTableEmail(check);
  assert.match(html, /Abweichungssperre/);
  assert.match(html, /1:1 → 2:1/);
  assert.match(html, /Metadaten in dach.ts ergänzen/);
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<script>'));
});
