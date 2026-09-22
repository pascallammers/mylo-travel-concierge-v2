import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReviewDate, formatSourceMonth, ANCHOR_LABELS, CABIN_LABELS } from './presentation';

test('dates remain German and timezone independent for domain and serialized values', () => {
  for (const date of ['2026-09-01', new Date('2026-09-01')]) {
    assert.equal(formatSourceMonth(date), '09/2026');
    assert.equal(formatReviewDate(date), '01.09.2026');
  }
  assert.equal(formatSourceMonth('2026-09'), '09/2026');
  assert.equal(formatSourceMonth(''), '—');
  assert.equal(ANCHOR_LABELS.no_plan, 'Wert ohne Plan');
  assert.equal(Object.keys(CABIN_LABELS).length, 5);
});
