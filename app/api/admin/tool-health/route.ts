import { and, gte, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { dbUncached } from '@/lib/db';
import { toolCalls } from '@/lib/db/schema';
import { aggregateToolFailures } from '@/lib/observability/tool-failure-alert';

/**
 * Returns the last 24 hours of tool health data for administrators.
 *
 * @returns JSON tool failure report or an authorization/server error.
 */
export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const rows = await dbUncached
      .select({
        toolName: toolCalls.toolName,
        status: toolCalls.status,
        error: toolCalls.error,
        createdAt: toolCalls.createdAt,
      })
      .from(toolCalls)
      .where(and(gte(toolCalls.createdAt, start), lt(toolCalls.createdAt, end)));

    return NextResponse.json(aggregateToolFailures(rows, { start, end }));
  } catch (error) {
    console.error(
      'Error fetching admin tool health:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
