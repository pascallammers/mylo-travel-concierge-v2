import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { thrivecartWebhookLog, thrivecartSyncLog } from '@/lib/db/schema';
import { desc, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userRole = await getUserRole(user.id);
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'webhooks';
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search');

  try {
    if (type === 'webhooks') {
      const whereClause = search
        ? like(thrivecartWebhookLog.customerEmail, `%${search}%`)
        : undefined;

      const logs = await db
        .select()
        .from(thrivecartWebhookLog)
        .where(whereClause)
        .orderBy(desc(thrivecartWebhookLog.processedAt))
        .limit(limit);
      return NextResponse.json({ logs, count: logs.length });
    }

    if (type === 'syncs') {
      const logs = await db
        .select()
        .from(thrivecartSyncLog)
        .orderBy(desc(thrivecartSyncLog.startedAt))
        .limit(limit);

      return NextResponse.json({ logs, count: logs.length });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('[Admin API] Failed to fetch ThriveCart logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
