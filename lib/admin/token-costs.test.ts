import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateGrok43TokenCost, calculateRevenueBaseline } from './token-costs';

describe('calculateGrok43TokenCost', () => {
  it('charges regular input, cached input, and output tokens separately', () => {
    const cost = calculateGrok43TokenCost({
      inputTokens: 1_000_000,
      cachedInputTokens: 250_000,
      outputTokens: 100_000,
      totalTokens: 1_100_000,
    });

    assert.equal(cost.billableInputTokens, 750_000);
    assert.equal(cost.cachedInputTokens, 250_000);
    assert.equal(cost.totalCostUsd, 1.2375);
  });

  it('does not allow cached input to exceed total input tokens', () => {
    const cost = calculateGrok43TokenCost({
      inputTokens: 100,
      cachedInputTokens: 200,
      outputTokens: 0,
      totalTokens: 100,
    });

    assert.equal(cost.cachedInputTokens, 100);
    assert.equal(cost.billableInputTokens, 0);
  });

  it('treats unclassified total-token overhead as output-priced tokens', () => {
    const cost = calculateGrok43TokenCost({
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 50,
      totalTokens: 175,
    });

    assert.equal(cost.unclassifiedOutputTokens, 25);
  });
});

describe('calculateRevenueBaseline', () => {
  it('prorates the 47 EUR monthly baseline to the selected period', () => {
    const baseline = calculateRevenueBaseline({
      costUsd: 2,
      days: 15,
      monthlyRevenueEur: 47,
      usdToEurRate: 1,
    });

    assert.equal(baseline.revenueEur, 23.5);
    assert.equal(baseline.profitEur, 21.5);
  });
});
