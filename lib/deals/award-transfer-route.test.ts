import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTransferSourcesForAwardProgram } from '../config/transfer-engine';
import { buildAwardTransferRoute } from './award-transfer-route';

test('uses the best DACH source and keeps its ratio', () => {
  assert.deepEqual(buildAwardTransferRoute(getTransferSourcesForAwardProgram('lufthansa'), 'de'), {
    label: 'PAYBACK 1:1',
  });
});

test('labels indirect transfers with the intermediate partner and localized source', () => {
  const indirect = getTransferSourcesForAwardProgram('lufthansa')
    .filter(({ sourceProgramId }) => sourceProgramId === 'amex_dach');
  for (const [locale, via] of [['de', 'über PAYBACK'], ['en', 'via PAYBACK']]) {
    const result = buildAwardTransferRoute(indirect, locale);
    assert.ok(result?.label.includes(via));
    assert.ok(result?.label.startsWith(indirect[0].sourceProgramLabel[locale === 'de' ? 'de' : 'en']));
    assert.match(result.label, /\d+:\d+$/);
  }
});

test('never displays US-only routes or invents a route', () => {
  assert.equal(buildAwardTransferRoute(getTransferSourcesForAwardProgram('aeroplan'), 'de'), null);
  assert.equal(buildAwardTransferRoute([], 'en'), null);
});
