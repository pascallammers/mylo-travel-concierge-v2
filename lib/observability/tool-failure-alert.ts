import type { ToolCallStatus } from '@/lib/db/schema';

export interface ToolCallSample {
  toolName: string;
  status: ToolCallStatus;
  error: string | null;
  createdAt: Date;
}

export interface ToolFailureStats {
  toolName: string;
  calls: number;
  failed: number;
  failureRate: number;
  topErrors: Array<{ error: string; count: number }>;
}

export interface ToolFailureReport {
  periodStart: string;
  periodEnd: string;
  tools: ToolFailureStats[];
  alerting: ToolFailureStats[];
}

export const DEFAULT_TOOL_FAILURE_THRESHOLD = 1;
export const DEFAULT_TOOL_FAILURE_MIN_CALLS = 3;

interface MutableToolFailureStats {
  toolName: string;
  calls: number;
  failed: number;
  errors: Map<string, number>;
}

/**
 * Aggregates tool calls into operator-facing failure statistics.
 *
 * @param rows - Recorded tool calls to inspect.
 * @param period - Inclusive start and exclusive end window.
 * @param options - Optional alert threshold and minimum call count.
 * @returns Full per-tool report and the tools that cross the alert threshold.
 */
export function aggregateToolFailures(
  rows: ToolCallSample[],
  period: { start: Date; end: Date },
  options: { threshold?: number; minCalls?: number } = {},
): ToolFailureReport {
  const threshold = options.threshold ?? DEFAULT_TOOL_FAILURE_THRESHOLD;
  const minCalls = options.minCalls ?? DEFAULT_TOOL_FAILURE_MIN_CALLS;
  const grouped = new Map<string, MutableToolFailureStats>();

  for (const row of rows) {
    if (row.createdAt < period.start || row.createdAt >= period.end) continue;

    const stats = grouped.get(row.toolName) ?? {
      toolName: row.toolName,
      calls: 0,
      failed: 0,
      errors: new Map<string, number>(),
    };
    stats.calls += 1;

    if (row.status === 'failed' || row.status === 'timeout') {
      stats.failed += 1;
      if (row.error !== null) {
        stats.errors.set(row.error, (stats.errors.get(row.error) ?? 0) + 1);
      }
    }

    grouped.set(row.toolName, stats);
  }

  const tools = Array.from(grouped.values())
    .map<ToolFailureStats>((stats) => ({
      toolName: stats.toolName,
      calls: stats.calls,
      failed: stats.failed,
      failureRate: stats.calls > 0 ? stats.failed / stats.calls : 0,
      topErrors: Array.from(stats.errors, ([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count || a.error.localeCompare(b.error))
        .slice(0, 3),
    }))
    .sort((a, b) => b.failed - a.failed || a.toolName.localeCompare(b.toolName));

  return {
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    tools,
    alerting: tools.filter(
      (tool) => tool.calls >= minCalls && tool.failureRate >= threshold,
    ),
  };
}

/**
 * Runs the daily tool-failure alert workflow with injectable dependencies.
 *
 * @param deps - Authentication, persistence, delivery, clock, and threshold dependencies.
 * @returns Status/body pair for the route handler.
 */
export async function runToolFailureAlertCheck(deps: {
  authHeader: string | null;
  cronSecret: string;
  loadToolCalls: (start: Date, end: Date) => Promise<ToolCallSample[]>;
  sendAlert: (report: ToolFailureReport) => Promise<void>;
  now?: () => Date;
  threshold?: number;
  minCalls?: number;
}): Promise<{
  status: number;
  body: {
    success: boolean;
    alerted?: boolean;
    skipped?: boolean;
    reason?: string;
    report?: ToolFailureReport;
  };
}> {
  if (deps.authHeader !== `Bearer ${deps.cronSecret}`) {
    return { status: 401, body: { success: false, reason: 'unauthorized' } };
  }

  const end = deps.now?.() ?? new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const rows = await deps.loadToolCalls(start, end);
  const report = aggregateToolFailures(rows, { start, end }, {
    threshold: deps.threshold,
    minCalls: deps.minCalls,
  });

  if (report.alerting.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        skipped: true,
        reason: 'no_tool_above_threshold',
        report,
      },
    };
  }

  try {
    await deps.sendAlert(report);
  } catch (error) {
    console.warn(
      '[tool-failure-alert] Email delivery failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      status: 502,
      body: {
        success: false,
        alerted: false,
        reason: 'alert_failed',
        report,
      },
    };
  }

  return {
    status: 200,
    body: { success: true, alerted: true, report },
  };
}
