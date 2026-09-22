import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderValuationStaleEmail } from './email';
import { buildValuationTable } from './table';
import { seedRows } from './seeds';

test('reminder includes German programme, anchor, cabin, value, dates and renewal instruction', () => {
  const rates = buildValuationTable(seedRows(), new Date('2028-01-01')).staleRates();
  const html = renderValuationStaleEmail(rates);
  assert.match(html, /Miles &amp; More · Reisewert · Business Class · 1,7 ct\/Punkt/);
  assert.match(html, /Wert ohne Plan/);
  assert.match(html, /Stand: 09\/2026 · fällig seit: 01\.03\.2027/);
  assert.match(html, /Admin-Dashboard.*erneuern/);
  assert.equal((html.match(/<li>/g) ?? []).length, 25);
  const unsafe = renderValuationStaleEmail([{ ...rates[0], programId: '<script>"&\'' }]);
  assert.ok(!unsafe.includes('<script>'));
  assert.match(unsafe, /&lt;script&gt;&quot;&amp;&#039;/);
});
