import type { FailoverEvent } from './failover-metrics';

export interface RecordedFailoverEvent extends FailoverEvent {
  createdAt: Date;
}

export interface FailoverStats {
  failoverRate: number;
  totalRequests: number;
  providerBreakdown: Record<string, number>;
  attemptDepthHistogram: Record<number, number>;
}

export interface FallbackCostEstimate {
  estimatedUsd: number;
  eventCount: number;
}

export const FALLBACK_SPEND_WARNING_USD = 5;
export const CLAUDE_OPUS_46_OUTPUT_USD_PER_MILLION = 25;
export const DEFAULT_FALLBACK_OUTPUT_TOKENS = 2500;

/**
 * Aggregates stored failover events into operator-facing period stats.
 *
 * @param events - Persisted AI Gateway failover events.
 * @param period - Inclusive start and exclusive end window.
 * @returns Failover rate, total request count, provider counts, and attempt-depth histogram.
 */
export function aggregateFailoverStats(
  events: RecordedFailoverEvent[],
  period: { start: Date; end: Date },
): FailoverStats {
  const eventsInPeriod = events.filter(
    (event) => event.createdAt >= period.start && event.createdAt < period.end,
  );

  const providerBreakdown: Record<string, number> = {};
  const attemptDepthHistogram: Record<number, number> = {};
  let failoverCount = 0;

  for (const event of eventsInPeriod) {
    providerBreakdown[event.finalProvider] = (providerBreakdown[event.finalProvider] ?? 0) + 1;
    attemptDepthHistogram[event.modelAttemptCount] =
      (attemptDepthHistogram[event.modelAttemptCount] ?? 0) + 1;

    if (!event.primarySucceeded) {
      failoverCount += 1;
    }
  }

  const totalRequests = eventsInPeriod.length;

  return {
    failoverRate: totalRequests > 0 ? failoverCount / totalRequests : 0,
    totalRequests,
    providerBreakdown,
    attemptDepthHistogram,
  };
}

/**
 * Estimates fallback spend for successful Anthropic failover events.
 *
 * @param events - AI Gateway failover events.
 * @returns Estimated USD spend and counted fallback events.
 */
export function estimateFallbackCost(events: FailoverEvent[]): FallbackCostEstimate {
  const billableEvents = events.filter(
    (event) => !event.primarySucceeded && event.finalProvider === 'anthropic',
  );
  const estimatedUsd =
    (billableEvents.length * DEFAULT_FALLBACK_OUTPUT_TOKENS * CLAUDE_OPUS_46_OUTPUT_USD_PER_MILLION) /
    1_000_000;

  return {
    estimatedUsd: roundCurrency(estimatedUsd),
    eventCount: billableEvents.length,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
