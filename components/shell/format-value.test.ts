import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatValue } from './format-value';

test('formats nonzero values using the active locale and whole euros', () => {
  assert.equal(formatValue(1234, 'de'), '~1.234\u00a0€');
  assert.equal(formatValue(1234, 'en'), '~€1,234');
  assert.equal(formatValue(12.6, 'de'), '~13\u00a0€');
});

test('keeps a known zero exact in both locales', () => {
  assert.equal(formatValue(0, 'de'), '0\u00a0€');
  assert.equal(formatValue(0, 'en'), '€0');
});
