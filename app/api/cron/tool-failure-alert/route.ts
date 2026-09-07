import { and, gte, lt } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { dbUncached } from '@/lib/db';
import { toolCalls } from '@/lib/db/schema';
import { sendToolFailureAdminAlert } from '@/lib/email';
import {
  runToolFailureAlertCheck,
  type ToolCallSample,
} from '@/lib/observability/tool-failure-alert';

/**
 * Handles daily Vercel Cron invocations for MCP tool-failure alerts.
 *
 * @param request - Vercel Cron request with the CRON_SECRET bearer token.
 * @returns JSON alert result including the full 24-hour report.
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

/**
 * Handles manual tool-failure alert checks.
 *
 * @param request - Manual request with the CRON_SECRET bearer token.
 * @returns JSON alert result including the full 24-hour report.
 */
export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  const result = await runToolFailureAlertCheck({
    authHeader: request.headers.get('authorization'),
    cronSecret: serverEnv.CRON_SECRET,
    loadToolCalls,
    sendAlert: sendToolFailureAdminAlert,
  });

  return NextResponse.json(result.body, { status: result.status });
}

async function loadToolCalls(start: Date, end: Date): Promise<ToolCallSample[]> {
  return dbUncached
    .select({
      toolName: toolCalls.toolName,
      status: toolCalls.status,
      error: toolCalls.error,
      createdAt: toolCalls.createdAt,
    })
    .from(toolCalls)
    .where(and(gte(toolCalls.createdAt, start), lt(toolCalls.createdAt, end)));
}

export const maxDuration = 30;
