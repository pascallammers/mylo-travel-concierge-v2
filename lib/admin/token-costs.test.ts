import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateGrokTokenCost, calculateRevenueBaseline, getGrokPricing } from './token-costs';

describe('getGrokPricing', () => {
  it('prices grok-4.5 rows at 4.5 rates', () => {
    assert.deepEqual(getGrokPricing('grok-4.5'), { input: 2.0, cachedInput: 0.3, output: 6.0 });
  });

  it('prices grok-4.3, legacy, and unknown rows at 4.3 rates', () => {
    const expected = { input: 1.25, cachedInput: 0.2, output: 2.5 };
    assert.deepEqual(getGrokPricing('grok-4.3'), expected);
    assert.deepEqual(getGrokPricing(null), expected);
    assert.deepEqual(getGrokPricing(undefined), expected);
  });
});

describe('calculateGrokTokenCost', () => {
  it('charges regular input, cached input, and output tokens separately', () => {
    const cost = calculateGrokTokenCost(
      {
        inputTokens: 1_000_000,
        cachedInputTokens: 250_000,
        outputTokens: 100_000,
        totalTokens: 1_100_000,
      },
      'grok-4.3',
    );

    assert.equal(cost.billableInputTokens, 750_000);
    assert.equal(cost.cachedInputTokens, 250_000);
    assert.equal(cost.totalCostUsd, 1.2375);
  });

  it('bills grok-4.5 usage at the 4.5 price table', () => {
    const cost = calculateGrokTokenCost(
      {
        inputTokens: 1_000_000,
        cachedInputTokens: 250_000,
        outputTokens: 100_000,
        totalTokens: 1_100_000,
      },
      'grok-4.5',
    );

    // 750k * $2 + 250k * $0.30 + 100k * $6 per million
    assert.equal(cost.totalCostUsd, 2.175);
  });

  it('does not allow cached input to exceed total input tokens', () => {
    const cost = calculateGrokTokenCost({
      inputTokens: 100,
      cachedInputTokens: 200,
      outputTokens: 0,
      totalTokens: 100,
    });

    assert.equal(cost.cachedInputTokens, 100);
    assert.equal(cost.billableInputTokens, 0);
  });

  it('treats unclassified total-token overhead as output-priced tokens', () => {
    const cost = calculateGrokTokenCost({
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
