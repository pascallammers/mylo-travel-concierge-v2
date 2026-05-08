import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_FALLBACK_OUTPUT_TOKENS,
  FALLBACK_SPEND_WARNING_USD,
  estimateFallbackCost,
} from './failover-aggregator';
import type { FailoverEvent } from './failover-metrics';

describe('estimateFallbackCost', () => {
  it('returns zero spend for an empty list', () => {
    assert.deepEqual(estimateFallbackCost([]), {
      estimatedUsd: 0,
      eventCount: 0,
    });
  });

  it('estimates one Anthropic fallback event', () => {
    const estimate = estimateFallbackCost([event()]);

    assert.equal(estimate.eventCount, 1);
    assert.equal(estimate.estimatedUsd, 0.06);
  });

  it('ignores primary-success and non-Anthropic events', () => {
    const estimate = estimateFallbackCost([
      event({ primarySucceeded: true, finalProvider: 'xai' }),
      event({ primarySucceeded: false, finalProvider: 'google' }),
      event(),
    ]);

    assert.equal(estimate.eventCount, 1);
  });

  it('documents the event count needed to reach the default warning threshold', () => {
    const costPerEvent = estimateFallbackCost([event()]).estimatedUsd;
    const thresholdEventCount = Math.ceil(FALLBACK_SPEND_WARNING_USD / costPerEvent);

    assert.equal(DEFAULT_FALLBACK_OUTPUT_TOKENS, 2500);
    assert.equal(thresholdEventCount, 84);
  });
});

function event(overrides: Partial<FailoverEvent> = {}): FailoverEvent {
  return {
    originalModelId: 'xai/grok-4.3',
    finalProvider: 'anthropic',
    modelAttemptCount: 2,
    primarySucceeded: false,
    totalProviderAttemptCount: 2,
    fallbackChain: ['xai/grok-4.3', 'anthropic/claude-opus-4.6'],
    ...overrides,
  };
}
