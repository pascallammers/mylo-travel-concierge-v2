import { get } from '@vercel/edge-config';
import { and, gte, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { dbUncached } from '@/lib/db';
import { failoverEvents } from '@/lib/db/schema';
import {
  postFailoverWebhook,
  runFailoverAlertCheck,
} from '@/lib/observability/failover-alert';
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
 * Handles manual invocations for local alert testing.
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
    getConfig: get,
    loadEvents,
    postWebhook: postFailoverWebhook,
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
