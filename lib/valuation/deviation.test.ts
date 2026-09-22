import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRateDeviation, MAX_RELATIVE_RATE_DEVIATION, ValuationDeviationError } from './deviation';

test('deviation gate handles both directions, exact boundary, missing rows and confirmation', () => {
  assert.equal(MAX_RELATIVE_RATE_DEVIATION, 0.25);
  for (const next of [1.275, 2.125, 1.7]) assert.doesNotThrow(() => assertRateDeviation(1.7, next));
  for (const next of [1.274, 2.126]) assert.throws(() => assertRateDeviation(1.7, next), ValuationDeviationError);
  assert.doesNotThrow(() => assertRateDeviation(undefined, 4));
  assert.doesNotThrow(() => assertRateDeviation(1, 4, true));
  assert.match(new ValuationDeviationError(1.7, 2.2).message, /2,2 ct.*25 %.*1,7 ct/);
});
