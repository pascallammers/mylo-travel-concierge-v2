import { and, gte, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { dbUncached } from '@/lib/db';
import { failoverEvents } from '@/lib/db/schema';
import { sendFailoverAdminAlert } from '@/lib/email';
import { runFailoverAlertCheck } from '@/lib/observability/failover-alert';
import type { RecordedFailoverEvent } from '@/lib/observability/failover-aggregator';

/**
 * Handles Vercel Cron invocations for AI Gateway failover alerts.
 *
 * @param request - Vercel Cron request with the CRON_SECRET bearer token.
 * @returns JSON alert result.
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

/**
 * Handles manual probes. The query parameters `threshold`, `minRequests`, and
 * `hours` override the defaults so a probe can alert on real traffic, e.g.
 * `?hours=24&threshold=0&minRequests=1`.
 *
 * @param request - Manual request with the CRON_SECRET bearer token.
 * @returns JSON alert result.
 */
export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  const result = await runFailoverAlertCheck({
    authHeader: request.headers.get('authorization'),
    cronSecret: serverEnv.CRON_SECRET,
    loadEvents,
    sendAlert: sendFailoverAdminAlert,
    threshold: request.nextUrl.searchParams.get('threshold'),
    minimumRequests: request.nextUrl.searchParams.get('minRequests'),
    windowHours: request.nextUrl.searchParams.get('hours'),
  });

  return NextResponse.json(result.body, { status: result.status });
}

async function loadEvents(start: Date, end: Date): Promise<RecordedFailoverEvent[]> {
  const rows = await dbUncached
    .select()
    .from(failoverEvents)
    .where(and(gte(failoverEvents.createdAt, start), lt(failoverEvents.createdAt, end)));

  return rows.map((row) => ({
    createdAt: row.createdAt,
    originalModelId: row.originalModelId,
    finalProvider: row.finalProvider,
    modelAttemptCount: row.modelAttemptCount,
    primarySucceeded: row.primarySucceeded,
    totalProviderAttemptCount: row.totalProviderAttemptCount,
    fallbackChain: row.fallbackChain,
    recoveryUsed: row.recoveryUsed,
    streamId: row.streamId,
    userId: row.userId,
  }));
}

export const maxDuration = 30;
