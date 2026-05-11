import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFailoverEvent } from './failover-metrics';

describe('extractFailoverEvent', () => {
  it('returns null for undefined input', () => {
    assert.equal(extractFailoverEvent(undefined), null);
  });

  it('extracts a primary-success routing event', () => {
    const event = extractFailoverEvent({
      gateway: {
        routing: {
          originalModelId: 'xai/grok-4.3',
          finalProvider: 'xai',
          modelAttemptCount: 1,
          totalProviderAttemptCount: 1,
          modelAttempts: [
            {
              modelId: 'xai/grok-4.3',
              success: true,
              providerAttempts: [{ provider: 'xai', success: true }],
            },
          ],
        },
      },
    });

    assert.deepEqual(event, {
      originalModelId: 'xai/grok-4.3',
      finalProvider: 'xai',
      modelAttemptCount: 1,
      primarySucceeded: true,
      totalProviderAttemptCount: 1,
      fallbackChain: ['xai/grok-4.3'],
    });
  });

  it('extracts a multi-step model fallback chain', () => {
    const event = extractFailoverEvent({
      gateway: {
        routing: {
          originalModelId: 'xai/grok-4.3',
          finalProvider: 'anthropic',
          modelAttemptCount: 2,
          totalProviderAttemptCount: 2,
          modelAttempts: [
            {
              modelId: 'xai/grok-4.3',
              success: false,
              providerAttempts: [{ provider: 'xai', success: false }],
            },
            {
              modelId: 'anthropic/claude-opus-4.6',
              success: true,
              providerAttempts: [{ provider: 'anthropic', success: true }],
            },
          ],
        },
      },
    });

    assert.equal(event?.primarySucceeded, false);
    assert.deepEqual(event?.fallbackChain, [
      'xai/grok-4.3',
      'anthropic/claude-opus-4.6',
    ]);
  });

  it('handles routing schema drift by using stable top-level fields', () => {
    const event = extractFailoverEvent({
      gateway: {
        routing: {
          originalModelId: 'xai/grok-4.3',
          finalProvider: 'xai',
        },
      },
    });

    assert.deepEqual(event, {
      originalModelId: 'xai/grok-4.3',
      finalProvider: 'xai',
      modelAttemptCount: 1,
      primarySucceeded: true,
      totalProviderAttemptCount: 1,
      fallbackChain: ['xai/grok-4.3'],
    });
  });

  it('marks primary as failed when finalProvider differs from originalModelId provider with no attempt arrays', () => {
    // Schema-drift case: gateway routed away from primary but only top-level
    // fields are present. Must still recognize this as a failover.
    const event = extractFailoverEvent({
      gateway: {
        routing: {
          originalModelId: 'xai/grok-4.3',
          finalProvider: 'anthropic',
        },
      },
    });

    assert.equal(event?.primarySucceeded, false);
    assert.equal(event?.finalProvider, 'anthropic');
    assert.equal(event?.originalModelId, 'xai/grok-4.3');
  });
});
