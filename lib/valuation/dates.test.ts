import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultReviewDue, parseCalendarDate, parseSourceMonth } from './dates';

test('calendar dates reject rollover and accept real leap days', () => {
  for (const value of [
    '',
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '2026-9-01',
    '2026-09-01T00:00:00Z',
  ]) {
    assert.equal(parseCalendarDate(value), undefined, value);
  }
  assert.equal(parseCalendarDate('2028-02-29')?.toISOString(), '2028-02-29T00:00:00.000Z');
});

test('source dates normalize to the first day and review defaults cross year boundaries', () => {
  for (const value of ['2026-09', '2026-09-01', '2026-09-22']) {
    const source = parseSourceMonth(value)!;
    assert.equal(source.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(defaultReviewDue(source).toISOString(), '2027-03-01T00:00:00.000Z');
    assert.equal(source.getUTCMonth(), 8);
  }
  assert.equal(parseSourceMonth('2026-02-30'), undefined);
});
