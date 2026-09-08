import { aggregateFailoverStats, type FailoverStats, type RecordedFailoverEvent } from './failover-aggregator';

export interface FailoverAlertReport extends FailoverStats {
  periodStart: string;
  periodEnd: string;
  threshold: number;
}

export interface FailoverAlertResult {
  status: number;
  body: {
    success?: boolean;
    skipped?: boolean;
    alerted?: boolean;
    reason?: string;
    failoverRate?: number;
    totalRequests?: number;
  };
}

export interface FailoverAlertDependencies {
  authHeader: string | null;
  cronSecret: string;
  loadEvents: (start: Date, end: Date) => Promise<RecordedFailoverEvent[]>;
  sendAlert: (report: FailoverAlertReport) => Promise<void>;
  now?: () => Date;
  /** Failover share between 0 and 1, e.g. 0.05 for 5 %. */
  threshold?: unknown;
  minimumRequests?: unknown;
  windowHours?: unknown;
}

export const DEFAULT_FAILOVER_THRESHOLD = 0.05;
export const DEFAULT_FAILOVER_MIN_REQUESTS = 5;
export const DEFAULT_FAILOVER_WINDOW_HOURS = 1;
const MAX_FAILOVER_WINDOW_HOURS = 168;

/**
 * Runs the hourly failover alert workflow with injectable dependencies.
 *
 * Threshold, minimum request count, and lookback window fall back to the
 * defaults when the override is missing or invalid.
 *
 * @param dependencies - Auth, persistence, delivery, clock, and override dependencies.
 * @returns Status/body pair for the route handler.
 */
export async function runFailoverAlertCheck(dependencies: FailoverAlertDependencies): Promise<FailoverAlertResult> {
  if (dependencies.authHeader !== `Bearer ${dependencies.cronSecret}`) {
    return {
      status: 401,
      body: { success: false, reason: 'unauthorized' },
    };
  }

  const now = dependencies.now?.() ?? new Date();
  const windowHours = parseWindowHours(dependencies.windowHours);
  const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const events = await dependencies.loadEvents(start, now);
  const threshold = parseThreshold(dependencies.threshold);
  const minimumRequests = parseMinimumRequests(dependencies.minimumRequests);
  const stats = aggregateFailoverStats(events, { start, end: now });

  if (stats.totalRequests < minimumRequests) {
    return {
      status: 200,
      body: {
        success: true,
        skipped: true,
        reason: 'below_minimum_requests',
        failoverRate: stats.failoverRate,
        totalRequests: stats.totalRequests,
      },
    };
  }

  if (stats.failoverRate <= threshold) {
    return {
      status: 200,
      body: {
        success: true,
        skipped: true,
        reason: 'below_threshold',
        failoverRate: stats.failoverRate,
        totalRequests: stats.totalRequests,
      },
    };
  }

  const report = createFailoverAlertReport(stats, start, now, threshold);

  try {
    await dependencies.sendAlert(report);
  } catch (error) {
    console.warn('[failover-alert] Email delivery failed:', error instanceof Error ? error.message : error);
    return {
      status: 502,
      body: {
        success: false,
        alerted: false,
        reason: 'alert_failed',
        failoverRate: stats.failoverRate,
        totalRequests: stats.totalRequests,
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      alerted: true,
      failoverRate: stats.failoverRate,
      totalRequests: stats.totalRequests,
    },
  };
}

function parseThreshold(value: unknown): number {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_FAILOVER_THRESHOLD;
}

function parseMinimumRequests(value: unknown): number {
  const parsed = toNumber(value);
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
    return parsed;
  }
  return DEFAULT_FAILOVER_MIN_REQUESTS;
}

function parseWindowHours(value: unknown): number {
  const parsed = toNumber(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_FAILOVER_WINDOW_HOURS) {
    return parsed;
  }
  return DEFAULT_FAILOVER_WINDOW_HOURS;
}

function createFailoverAlertReport(
  stats: FailoverStats,
  start: Date,
  end: Date,
  threshold: number,
): FailoverAlertReport {
  return {
    failoverRate: stats.failoverRate,
    totalRequests: stats.totalRequests,
    recoveryCount: stats.recoveryCount,
    recoveryRate: stats.recoveryRate,
    providerBreakdown: stats.providerBreakdown,
    attemptDepthHistogram: stats.attemptDepthHistogram,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    threshold,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  return text.length > 0 ? Number(text) : Number.NaN;
}
