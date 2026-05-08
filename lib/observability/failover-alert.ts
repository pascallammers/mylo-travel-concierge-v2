import {
  aggregateFailoverStats,
  type FailoverStats,
  type RecordedFailoverEvent,
} from './failover-aggregator';

export interface FailoverAlertPayload extends FailoverStats {
  text: string;
  periodStart: string;
  periodEnd: string;
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
  getConfig: (key: string) => Promise<unknown>;
  loadEvents: (start: Date, end: Date) => Promise<RecordedFailoverEvent[]>;
  postWebhook: (url: string, payload: FailoverAlertPayload) => Promise<void>;
  now?: () => Date;
}

const DEFAULT_THRESHOLD = 0.05;
// Avoid 1/1 = 100% false-positive alerts on low-traffic periods. Configurable
// via FAILOVER_ALERT_MIN_REQUESTS Edge Config key.
const DEFAULT_MINIMUM_REQUESTS = 5;

/**
 * Runs the hourly failover alert workflow with injectable dependencies.
 *
 * @param dependencies - Auth, config, persistence, and webhook dependencies.
 * @returns Status/body pair for the route handler.
 */
export async function runFailoverAlertCheck(
  dependencies: FailoverAlertDependencies,
): Promise<FailoverAlertResult> {
  if (dependencies.authHeader !== `Bearer ${dependencies.cronSecret}`) {
    return {
      status: 401,
      body: { success: false, reason: 'unauthorized' },
    };
  }

  const now = dependencies.now?.() ?? new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);
  const [thresholdValue, minimumRequestsValue, webhookUrlValue, events] = await Promise.all([
    readConfigValue(dependencies, 'FAILOVER_ALERT_THRESHOLD'),
    readConfigValue(dependencies, 'FAILOVER_ALERT_MIN_REQUESTS'),
    readConfigValue(dependencies, 'FAILOVER_ALERT_WEBHOOK_URL'),
    dependencies.loadEvents(start, now),
  ]);
  const threshold = parseThreshold(thresholdValue);
  const minimumRequests = parseMinimumRequests(minimumRequestsValue);
  const webhookUrl = parseWebhookUrl(webhookUrlValue);
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

  if (!webhookUrl) {
    console.warn(
      '[failover-alert] Threshold exceeded but FAILOVER_ALERT_WEBHOOK_URL is missing or not https',
    );
    return {
      status: 200,
      body: {
        success: true,
        skipped: true,
        reason: 'missing_webhook_url',
        failoverRate: stats.failoverRate,
        totalRequests: stats.totalRequests,
      },
    };
  }

  const payload = createFailoverAlertPayload(stats, start, now, threshold);

  try {
    await dependencies.postWebhook(webhookUrl, payload);
  } catch (error) {
    console.warn(
      '[failover-alert] Webhook delivery failed:',
      error instanceof Error ? error.message : error,
    );
    // Surface the failure to the caller (and Vercel Cron logs) instead of
    // pretending the alert went out. Otherwise outages stay invisible.
    return {
      status: 502,
      body: {
        success: false,
        alerted: false,
        reason: 'webhook_failed',
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

async function readConfigValue(
  dependencies: Pick<FailoverAlertDependencies, 'getConfig'>,
  key: string,
): Promise<unknown> {
  try {
    return await dependencies.getConfig(key);
  } catch (error) {
    console.warn(
      `[failover-alert] Failed to read Edge Config key ${key}:`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

/**
 * Posts a Slack-compatible failover alert payload with a timeout.
 *
 * @param url - Webhook target URL (must be https; caller validates).
 * @param payload - Slack-compatible JSON body.
 * @returns Promise that resolves when delivery succeeds.
 */
export async function postFailoverWebhook(
  url: string,
  payload: FailoverAlertPayload,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function parseThreshold(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_THRESHOLD;
}

function parseMinimumRequests(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
    return parsed;
  }
  return DEFAULT_MINIMUM_REQUESTS;
}

function parseWebhookUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function createFailoverAlertPayload(
  stats: FailoverStats,
  start: Date,
  end: Date,
  threshold: number,
): FailoverAlertPayload {
  const failoverPercent = (stats.failoverRate * 100).toFixed(1);
  const thresholdPercent = (threshold * 100).toFixed(1);

  return {
    text: `MYLO AI Gateway failover rate is ${failoverPercent}% over the last hour, above ${thresholdPercent}%.`,
    failoverRate: stats.failoverRate,
    totalRequests: stats.totalRequests,
    providerBreakdown: stats.providerBreakdown,
    attemptDepthHistogram: stats.attemptDepthHistogram,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
