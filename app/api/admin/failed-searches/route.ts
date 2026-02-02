import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserRole } from '@/lib/auth-utils';
import { getFailedSearchLogs } from '@/lib/db/queries/failed-search';

export async function GET(request: NextRequest) {
  // Auth check - reuse existing admin pattern
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userRole = await getUserRole(user.id);
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const logs = await getFailedSearchLogs({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      query: query || undefined,
      limit,
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (error) {
    console.error('[Admin API] Failed to fetch logs:', error);
    return NextResponse.json({
      error: 'Failed to fetch logs'
    }, { status: 500 });
  }
}
