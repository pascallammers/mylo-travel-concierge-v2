import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_FAILOVER_THRESHOLD,
  runFailoverAlertCheck,
  type FailoverAlertDependencies,
  type FailoverAlertReport,
} from './failover-alert';
import type { RecordedFailoverEvent } from './failover-aggregator';

describe('runFailoverAlertCheck', () => {
  it('rejects invalid cron auth', async () => {
    const result = await runFailoverAlertCheck(deps({ authHeader: 'Bearer wrong' }));

    assert.equal(result.status, 401);
    assert.equal(result.body.reason, 'unauthorized');
  });

  it('sends an alert report when failover rate exceeds the threshold', async () => {
    const reports: FailoverAlertReport[] = [];
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false, false, false, true, true, true]),
        sendAlert: async (report) => {
          reports.push(report);
        },
      }),
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.alerted, true);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].totalRequests, 6);
    assert.equal(reports[0].threshold, DEFAULT_FAILOVER_THRESHOLD);
    assert.equal(reports[0].periodStart, '2026-05-08T11:00:00.000Z');
    assert.equal(reports[0].periodEnd, '2026-05-08T12:00:00.000Z');
  });

  it('does not send an alert below the threshold', async () => {
    let callCount = 0;
    const result = await runFailoverAlertCheck(
      deps({
        threshold: '0.75',
        events: makeEvents([false, true, true, true, true, true]),
        sendAlert: async () => {
          callCount += 1;
        },
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_threshold');
    assert.equal(callCount, 0);
  });

  it('returns 502 when alert delivery fails', async () => {
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false, false, false, true, true, true]),
        sendAlert: async () => {
          throw new Error('timeout');
        },
      }),
    );

    assert.equal(result.status, 502);
    assert.equal(result.body.success, false);
    assert.equal(result.body.alerted, false);
    assert.equal(result.body.reason, 'alert_failed');
  });

  it('skips alerting below the default minimum request count', async () => {
    let callCount = 0;
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false]),
        sendAlert: async () => {
          callCount += 1;
        },
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_minimum_requests');
    assert.equal(callCount, 0);
  });

  it('alerts for one request when minimumRequests is overridden to one', async () => {
    const reports: FailoverAlertReport[] = [];
    const result = await runFailoverAlertCheck(
      deps({
        events: makeEvents([false]),
        minimumRequests: '1',
        sendAlert: async (report) => {
          reports.push(report);
        },
      }),
    );

    assert.equal(result.body.alerted, true);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].totalRequests, 1);
  });

  it('falls back to the default threshold for an invalid override', async () => {
    const result = await runFailoverAlertCheck(
      deps({
        threshold: 'abc',
        events: makeEvents([false, ...Array<boolean>(19).fill(true)]),
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_threshold');
  });

  it('falls back to the default minimum request count for an invalid override', async () => {
    const result = await runFailoverAlertCheck(
      deps({
        minimumRequests: '0',
        events: makeEvents([false]),
      }),
    );

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'below_minimum_requests');
  });
});

function deps(
  overrides: Partial<FailoverAlertDependencies> & {
    events?: RecordedFailoverEvent[];
  } = {},
): FailoverAlertDependencies {
  const events = overrides.events ?? [];

  return {
    authHeader: overrides.authHeader ?? 'Bearer secret',
    cronSecret: overrides.cronSecret ?? 'secret',
    loadEvents: overrides.loadEvents ?? (async () => events),
    sendAlert: overrides.sendAlert ?? (async () => undefined),
    now: overrides.now ?? (() => new Date('2026-05-08T12:00:00.000Z')),
    threshold: overrides.threshold,
    minimumRequests: overrides.minimumRequests,
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
