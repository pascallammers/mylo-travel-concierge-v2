import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTransferRatio, getTransferSourcesForAwardProgram } from '@/lib/config/transfer-engine';
import { collectDachTransferHints } from './dach-transfer-sources';
const deps = { formatTransferRatio, getTransferSourcesForAwardProgram };

test('DACH hints deduplicate visible programs and exclude US-only currencies', () => {
  const hints = collectDachTransferHints(['lufthansa', 'united', 'flyingblue', 'lufthansa'], 'de', deps);
  assert.deepEqual(hints.map((h) => h.programSlug), ['lufthansa', 'flyingblue']);
  assert.match(hints[0].sources.join(', '), /PAYBACK/);
  assert.doesNotMatch(JSON.stringify(hints), /Chase|Citi|Capital One/);
});
test('indirect transfer wording is localized and ratio formatting is shared', () => {
  const de = collectDachTransferHints(['lufthansa'], 'de', deps);
  const en = collectDachTransferHints(['lufthansa'], 'en', deps);
  assert.match(de[0].sources.join(', '), /über PAYBACK/);
  assert.match(en[0].sources.join(', '), /via PAYBACK/);
  assert.deepEqual(collectDachTransferHints([], 'de', deps), []);
});
