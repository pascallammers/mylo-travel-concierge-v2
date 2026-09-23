import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTravelVerdict } from './travel-verdict';

test('classifies below, equal, above and exactly 1.5 times the travel anchor', () => {
  for (const [achieved, expected] of [
    [-0.2, 'below_travel'], [0, 'below_travel'], [1.69, 'below_travel'],
    [1.7, 'above_travel'], [2.54, 'above_travel'],
    [2.55, 'far_above_travel'], [4, 'far_above_travel'],
  ] as const) {
    assert.equal(classifyTravelVerdict(achieved, 1.7), expected);
  }
});

test('uses integer thousandths at floating-point-sensitive thresholds', () => {
  assert.equal(classifyTravelVerdict(3.15, 2.1), 'far_above_travel');
  assert.equal(classifyTravelVerdict(3.149, 2.1), 'above_travel');
  assert.equal(classifyTravelVerdict(3.1496, 2.1), 'far_above_travel');
});
