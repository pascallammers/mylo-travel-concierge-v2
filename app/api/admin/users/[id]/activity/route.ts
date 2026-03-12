import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { adminActivityLog, user } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/admin/users/[id]/activity
 * Returns the admin activity log for a specific user.
 * @param id - Target user ID
 * @returns Array of activity entries with performer name
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;

    const entries = await db
      .select({
        id: adminActivityLog.id,
        action: adminActivityLog.action,
        details: adminActivityLog.details,
        createdAt: adminActivityLog.createdAt,
        performedById: adminActivityLog.performedBy,
        performedByName: user.name,
      })
      .from(adminActivityLog)
      .leftJoin(user, eq(adminActivityLog.performedBy, user.id))
      .where(eq(adminActivityLog.targetUserId, userId))
      .orderBy(desc(adminActivityLog.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      activity: entries.map((e) => ({
        id: e.id,
        action: e.action,
        details: e.details,
        createdAt: e.createdAt,
        performedBy: e.performedById
          ? { id: e.performedById, name: e.performedByName ?? 'Unbekannt' }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
