import { NextRequest, NextResponse } from 'next/server';
import { and, gte, lt } from 'drizzle-orm';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { failoverEvents } from '@/lib/db/schema';
import {
  aggregateFailoverStats,
  estimateFallbackCost,
  FALLBACK_SPEND_WARNING_USD,
  type RecordedFailoverEvent,
} from '@/lib/observability/failover-aggregator';

/**
 * GET /api/admin/analytics/failover
 * Returns AI Gateway failover stats for the last 24 hours.
 *
 * @param request - Incoming admin request.
 * @returns Aggregated failover analytics.
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(failoverEvents)
      .where(and(gte(failoverEvents.createdAt, start), lt(failoverEvents.createdAt, now)));
    const events: RecordedFailoverEvent[] = rows.map((row) => ({
      createdAt: row.createdAt,
      originalModelId: row.originalModelId,
      finalProvider: row.finalProvider,
      modelAttemptCount: row.modelAttemptCount,
      primarySucceeded: row.primarySucceeded,
      totalProviderAttemptCount: row.totalProviderAttemptCount,
      fallbackChain: row.fallbackChain,
    }));
    const stats = aggregateFailoverStats(events, { start, end: now });
    const costEstimate = estimateFallbackCost(events);

    return NextResponse.json({
      ...stats,
      costEstimate,
      spendWarningThresholdUsd: FALLBACK_SPEND_WARNING_USD,
      autoTopUpUrl: 'https://vercel.com/dashboard/~/ai-gateway/settings/billing',
      period: {
        startDate: start.toISOString(),
        endDate: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching failover analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
