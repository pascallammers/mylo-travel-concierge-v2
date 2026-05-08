import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  runFailoverAlertCheck,
  type FailoverAlertPayload,
  type FailoverAlertDependencies,
} from './failover-alert';
import type { RecordedFailoverEvent } from './failover-aggregator';

describe('runFailoverAlertCheck', () => {
  it('rejects invalid cron auth', async () => {
    const result = await runFailoverAlertCheck(deps({ authHeader: 'Bearer wrong' }));

    assert.equal(result.status, 401);
  });

  it('sends a webhook when failover rate exceeds the threshold', async () => {
    const calls: Array<{ url: string; payload: FailoverAlertPayload }> = [];
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false, false, false, true, true, true]),
        postWebhook: async (url, payload) => {
          calls.push({ url, payload });
        },
      }),
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.alerted, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.com/webhook');
    assert.equal(calls[0].payload.totalRequests, 6);
  });

  it('does not send a webhook below the threshold', async () => {
    let callCount = 0;
    const result = await runFailoverAlertCheck(
      deps({
        threshold: '0.75',
        events: makeEvents([false, true, true, true, true, true]),
        postWebhook: async () => {
          callCount += 1;
        },
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_threshold');
    assert.equal(callCount, 0);
  });

  it('returns 502 + success:false when webhook delivery fails', async () => {
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false, false, false, true, true, true]),
        postWebhook: async () => {
          throw new Error('timeout');
        },
      }),
    );

    assert.equal(result.status, 502);
    assert.equal(result.body.success, false);
    assert.equal(result.body.alerted, false);
    assert.equal(result.body.reason, 'webhook_failed');
  });

  it('skips alerting when total requests are below the minimum threshold', async () => {
    let callCount = 0;
    const result = await runFailoverAlertCheck(
      deps({
        // 1 of 1 = 100% failover rate, but only 1 request — below default min of 5
        events: makeEvents([false]),
        postWebhook: async () => {
          callCount += 1;
        },
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_minimum_requests');
    assert.equal(callCount, 0);
  });

  it('respects FAILOVER_ALERT_MIN_REQUESTS override', async () => {
    const calls: Array<{ url: string }> = [];
    const result = await runFailoverAlertCheck(
      deps({
        // 1 of 1 = 100% failover rate; with minRequests=1 this should alert
        events: makeEvents([false]),
        minimumRequests: '1',
        postWebhook: async (url) => {
          calls.push({ url });
        },
      }),
    );

    assert.equal(result.body.alerted, true);
    assert.equal(calls.length, 1);
  });

  it('rejects non-https webhook urls', async () => {
    let callCount = 0;
    const result = await runFailoverAlertCheck(
      deps({
        webhookUrl: 'http://example.com/webhook',
        events: makeEvents([false, false, false, true, true, true]),
        postWebhook: async () => {
          callCount += 1;
        },
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'missing_webhook_url');
    assert.equal(callCount, 0);
  });
});

function deps(
  overrides: Partial<FailoverAlertDependencies> & {
    threshold?: unknown;
    minimumRequests?: unknown;
    webhookUrl?: unknown;
    events?: RecordedFailoverEvent[];
  } = {},
): FailoverAlertDependencies {
  const now = new Date('2026-05-08T12:00:00.000Z');
  const threshold = overrides.threshold ?? '0.05';
  const minimumRequests = overrides.minimumRequests ?? '5';
  const webhookUrl = overrides.webhookUrl ?? 'https://example.com/webhook';
  const events = overrides.events ?? [];

  return {
    authHeader: overrides.authHeader ?? 'Bearer secret',
    cronSecret: overrides.cronSecret ?? 'secret',
    now: overrides.now ?? (() => now),
    getConfig:
      overrides.getConfig ??
      (async (key) => {
        if (key === 'FAILOVER_ALERT_THRESHOLD') return threshold;
        if (key === 'FAILOVER_ALERT_MIN_REQUESTS') return minimumRequests;
        if (key === 'FAILOVER_ALERT_WEBHOOK_URL') return webhookUrl;
        return undefined;
      }),
    loadEvents: overrides.loadEvents ?? (async () => events),
    postWebhook: overrides.postWebhook ?? (async () => undefined),
  };
}

function makeEvents(primarySucceededFlags: boolean[]): RecordedFailoverEvent[] {
  return primarySucceededFlags.map((primarySucceeded) =>
    event({
      primarySucceeded,
      finalProvider: primarySucceeded ? 'xai' : 'anthropic',
    }),
  );
}

function event(overrides: Partial<RecordedFailoverEvent> = {}): RecordedFailoverEvent {
  return {
    createdAt: new Date('2026-05-08T11:30:00.000Z'),
    originalModelId: 'xai/grok-4.3',
    finalProvider: 'xai',
    modelAttemptCount: 1,
    primarySucceeded: true,
    totalProviderAttemptCount: 1,
    fallbackChain: ['xai/grok-4.3'],
    ...overrides,
  };
}
