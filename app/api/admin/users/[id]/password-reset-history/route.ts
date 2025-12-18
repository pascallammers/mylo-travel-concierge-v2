import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { passwordResetHistory, user } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/admin/users/[id]/password-reset-history
 * Returns password reset history for a specific user
 * 
 * @param id - User ID
 * @returns Array of password reset history entries
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Check if user exists
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get password reset history with admin name
    const history = await db
      .select({
        id: passwordResetHistory.id,
        sentAt: passwordResetHistory.sentAt,
        triggerType: passwordResetHistory.triggerType,
        status: passwordResetHistory.status,
        errorMessage: passwordResetHistory.errorMessage,
        sentById: passwordResetHistory.sentBy,
      })
      .from(passwordResetHistory)
      .where(eq(passwordResetHistory.userId, userId))
      .orderBy(desc(passwordResetHistory.sentAt))
      .limit(20);

    // Get admin names for history entries
    const adminIds = [...new Set(history.map((h) => h.sentById).filter((id): id is string => id !== null))];
    const admins = adminIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(eq(user.id, adminIds[0]))
      : [];

    const adminMap = new Map(admins.map((a) => [a.id, a.name]));

    const enrichedHistory = history.map((entry) => ({
      id: entry.id,
      sentAt: entry.sentAt.toISOString(),
      triggerType: entry.triggerType,
      status: entry.status,
      errorMessage: entry.errorMessage,
      sentByName: entry.sentById ? adminMap.get(entry.sentById) || 'Admin' : null,
    }));

    return NextResponse.json({
      success: true,
      history: enrichedHistory,
    });
  } catch (error) {
    console.error('❌ Error fetching password reset history:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
