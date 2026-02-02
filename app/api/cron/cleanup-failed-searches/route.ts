import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredLogs } from '@/lib/db/queries/failed-search';

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deleted = await deleteExpiredLogs();
    console.log(`[Cron] Deleted ${deleted.length} expired failed search logs`);
    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron] Failed to cleanup logs:', error);
    return NextResponse.json({
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
