import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateToolFailures,
  runToolFailureAlertCheck,
  type ToolCallSample,
  type ToolFailureReport,
} from './tool-failure-alert';

const period = {
  start: new Date('2026-09-06T07:00:00.000Z'),
  end: new Date('2026-09-07T07:00:00.000Z'),
};

describe('aggregateToolFailures', () => {
  it('calculates rates, top errors, and orders tools by failures then name', () => {
    const report = aggregateToolFailures(
      [
        sample({ toolName: 'kiwi', status: 'failed', error: 'network' }),
        sample({ toolName: 'kiwi', status: 'failed', error: 'network' }),
        sample({ toolName: 'kiwi', status: 'timeout', error: 'timed out' }),
        sample({ toolName: 'kiwi', status: 'failed', error: 'upstream' }),
        sample({ toolName: 'kiwi', status: 'succeeded' }),
        sample({ toolName: 'trivago', status: 'failed', error: 'internal' }),
        sample({ toolName: 'trivago', status: 'timeout', error: 'timed out' }),
        sample({ toolName: 'trivago', status: 'succeeded' }),
        sample({ toolName: 'maps', status: 'succeeded' }),
        sample({
          toolName: 'outside-window',
          status: 'failed',
          createdAt: new Date('2026-09-06T06:59:59.999Z'),
        }),
      ],
      period,
    );

    assert.deepEqual(
      report.tools.map((tool) => tool.toolName),
      ['kiwi', 'trivago', 'maps'],
    );
    assert.deepEqual(report.tools[0], {
      toolName: 'kiwi',
      calls: 5,
      failed: 4,
      failureRate: 0.8,
      topErrors: [
        { error: 'network', count: 2 },
        { error: 'timed out', count: 1 },
        { error: 'upstream', count: 1 },
      ],
    });
    assert.equal(report.tools[1].failureRate, 2 / 3);
    assert.equal(report.tools[2].failureRate, 0);
    assert.deepEqual(report.alerting, []);
    assert.equal(report.periodStart, period.start.toISOString());
    assert.equal(report.periodEnd, period.end.toISOString());
  });

  it('ignores null errors when building the top errors', () => {
    const report = aggregateToolFailures(
      [
        sample({ status: 'failed', error: null }),
        sample({ status: 'failed', error: 'known' }),
        sample({ status: 'failed', error: null }),
      ],
      period,
    );

    assert.deepEqual(report.tools[0].topErrors, [{ error: 'known', count: 1 }]);
  });

  it('requires three calls before alerting at the default threshold', () => {
    const belowMinimum = aggregateToolFailures(
      [sample({ status: 'failed' }), sample({ status: 'timeout' })],
      period,
    );
    const atMinimum = aggregateToolFailures(
      [sample({ status: 'failed' }), sample({ status: 'timeout' }), sample({ status: 'failed' })],
      period,
    );

    assert.equal(belowMinimum.alerting.length, 0);
    assert.equal(atMinimum.alerting.length, 1);
  });

  it('respects a custom failure-rate threshold', () => {
    const report = aggregateToolFailures(
      [sample({ status: 'failed' }), sample({ status: 'failed' }), sample({ status: 'succeeded' })],
      period,
      { threshold: 2 / 3, minCalls: 3 },
    );

    assert.equal(report.alerting.length, 1);
  });
});

describe('runToolFailureAlertCheck', () => {
  it('returns 401 without loading rows or sending an alert for bad auth', async () => {
    let loaded = false;
    let sent = false;
    const result = await runToolFailureAlertCheck({
      ...dependencies(),
      authHeader: 'Bearer wrong',
      loadToolCalls: async () => {
        loaded = true;
        return [];
      },
      sendAlert: async () => {
        sent = true;
      },
    });

    assert.deepEqual(result, {
      status: 401,
      body: { success: false, reason: 'unauthorized' },
    });
    assert.equal(loaded, false);
    assert.equal(sent, false);
  });

  it('sends one alert with the full 24-hour report', async () => {
    const reports: ToolFailureReport[] = [];
    const result = await runToolFailureAlertCheck({
      ...dependencies(),
      loadToolCalls: async (start, end) => {
        assert.equal(start.toISOString(), period.start.toISOString());
        assert.equal(end.toISOString(), period.end.toISOString());
        return [sample({ status: 'failed' }), sample({ status: 'timeout' }), sample({ status: 'failed' })];
      },
      sendAlert: async (report) => {
        reports.push(report);
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.alerted, true);
    assert.equal(reports.length, 1);
    assert.equal(reports[0], result.body.report);
    assert.equal(reports[0].alerting.length, 1);
  });

  it('lists healthy tools in the report without alerting', async () => {
    let sent = false;
    const result = await runToolFailureAlertCheck({
      ...dependencies(),
      loadToolCalls: async () => [
        sample({ toolName: 'healthy', status: 'succeeded' }),
        sample({ toolName: 'healthy', status: 'succeeded' }),
        sample({ toolName: 'healthy', status: 'succeeded' }),
      ],
      sendAlert: async () => {
        sent = true;
      },
    });

    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'no_tool_above_threshold');
    assert.deepEqual(result.body.report?.tools.map((tool) => tool.toolName), ['healthy']);
    assert.deepEqual(result.body.report?.alerting, []);
    assert.equal(sent, false);
  });

  it('returns 502 and the report when alert delivery fails', async () => {
    const result = await runToolFailureAlertCheck({
      ...dependencies(),
      loadToolCalls: async () => [sample(), sample(), sample()],
      sendAlert: async () => {
        throw new Error('Resend unavailable');
      },
    });

    assert.equal(result.status, 502);
    assert.equal(result.body.success, false);
    assert.equal(result.body.alerted, false);
    assert.equal(result.body.reason, 'alert_failed');
    assert.ok(result.body.report);
  });
});

function dependencies() {
  return {
    authHeader: 'Bearer secret',
    cronSecret: 'secret',
    loadToolCalls: async (): Promise<ToolCallSample[]> => [],
    sendAlert: async (_report: ToolFailureReport): Promise<void> => undefined,
    now: () => period.end,
  };
}

function sample(overrides: Partial<ToolCallSample> = {}): ToolCallSample {
  return {
    toolName: 'kiwi',
    status: 'failed',
    error: 'network',
    createdAt: new Date('2026-09-06T12:00:00.000Z'),
    ...overrides,
  };
}
