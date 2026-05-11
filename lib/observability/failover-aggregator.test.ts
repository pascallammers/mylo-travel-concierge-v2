import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregateFailoverStats, type RecordedFailoverEvent } from './failover-aggregator';

const period = {
  start: new Date('2026-05-08T00:00:00.000Z'),
  end: new Date('2026-05-09T00:00:00.000Z'),
};

describe('aggregateFailoverStats', () => {
  it('returns zero values for an empty event list', () => {
    assert.deepEqual(aggregateFailoverStats([], period), {
      failoverRate: 0,
      totalRequests: 0,
      recoveryCount: 0,
      recoveryRate: 0,
      providerBreakdown: {},
      attemptDepthHistogram: {},
    });
  });

  it('returns zero failover rate when all primary attempts succeeded', () => {
    const stats = aggregateFailoverStats(
      [event({ finalProvider: 'xai', primarySucceeded: true })],
      period,
    );

    assert.equal(stats.failoverRate, 0);
    assert.equal(stats.totalRequests, 1);
  });

  it('calculates a mixed 50 percent failover rate', () => {
    const stats = aggregateFailoverStats(
      [
        event({ primarySucceeded: true, finalProvider: 'xai' }),
        event({ primarySucceeded: false, finalProvider: 'anthropic', modelAttemptCount: 2 }),
      ],
      period,
    );

    assert.equal(stats.failoverRate, 0.5);
  });

  it('filters events outside the requested period', () => {
    const stats = aggregateFailoverStats(
      [
        event({ createdAt: new Date('2026-05-07T23:59:59.000Z'), primarySucceeded: false }),
        event({ createdAt: new Date('2026-05-08T12:00:00.000Z'), primarySucceeded: true }),
      ],
      period,
    );

    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.failoverRate, 0);
  });

  it('counts provider breakdown by final provider', () => {
    const stats = aggregateFailoverStats(
      [
        event({ finalProvider: 'xai' }),
        event({ finalProvider: 'anthropic', primarySucceeded: false }),
        event({ finalProvider: 'anthropic', primarySucceeded: false }),
      ],
      period,
    );

    assert.deepEqual(stats.providerBreakdown, {
      xai: 1,
      anthropic: 2,
    });
  });

  it('builds an attempt-depth histogram', () => {
    const stats = aggregateFailoverStats(
      [
        event({ modelAttemptCount: 1 }),
        event({ modelAttemptCount: 2, primarySucceeded: false }),
        event({ modelAttemptCount: 3, primarySucceeded: false }),
        event({ modelAttemptCount: 3, primarySucceeded: false }),
      ],
      period,
    );

    assert.deepEqual(stats.attemptDepthHistogram, {
      1: 1,
      2: 1,
      3: 2,
    });
  });

  it('counts recovery usage separately from provider failover', () => {
    const stats = aggregateFailoverStats(
      [
        event({ primarySucceeded: false, recoveryUsed: true }),
        event({ primarySucceeded: false, recoveryUsed: false }),
        event({ primarySucceeded: true, recoveryUsed: false }),
      ],
      period,
    );

    assert.equal(stats.recoveryCount, 1);
    assert.equal(stats.recoveryRate, 1 / 3);
    assert.equal(stats.failoverRate, 2 / 3);
  });
});

function event(overrides: Partial<RecordedFailoverEvent> = {}): RecordedFailoverEvent {
  return {
    createdAt: new Date('2026-05-08T12:00:00.000Z'),
    originalModelId: 'xai/grok-4.3',
    finalProvider: 'xai',
    modelAttemptCount: 1,
    primarySucceeded: true,
    totalProviderAttemptCount: 1,
    fallbackChain: ['xai/grok-4.3'],
    ...overrides,
  };
}
