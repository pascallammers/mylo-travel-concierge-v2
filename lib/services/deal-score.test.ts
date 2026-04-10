import assert from 'node:assert';
import { describe, it } from 'node:test';
import { calculateDealScore, computePriceStats } from './deal-score-core';

describe('computePriceStats', () => {
  it('computes mean, min, and max without using Math.min/Math.max spread', () => {
    const stats = computePriceStats([199, 149, 299, 179]);

    assert.ok(stats);
    assert.strictEqual(stats?.count, 4);
    assert.strictEqual(stats?.min, 149);
    assert.strictEqual(stats?.max, 299);
    assert.strictEqual(stats?.mean, 206.5);
  });

  it('returns null for fewer than two prices', () => {
    assert.strictEqual(computePriceStats([199]), null);
  });
});

describe('calculateDealScore', () => {
  it('returns a higher score for prices below the mean', () => {
    const stats = computePriceStats([200, 220, 240, 260, 280]);

    assert.ok(stats);
    assert.ok(calculateDealScore(180, stats) > calculateDealScore(300, stats));
  });
});
