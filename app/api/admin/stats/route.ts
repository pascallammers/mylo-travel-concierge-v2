import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message, subscription } from '@/lib/db/schema';
import { count, eq, gte, sql } from 'drizzle-orm';

/**
 * GET /api/admin/stats
 * Returns overall system statistics for the admin dashboard
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate date 30 days ago for active user count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total users count
    const [totalUsersResult] = await db.select({ count: count() }).from(user);
    const totalUsers = totalUsersResult?.count || 0;

    // Get active users (users with messages in last 30 days)
    const activeUsersResult = await db
      .select({ userId: chat.userId })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(gte(message.createdAt, thirtyDaysAgo))
      .groupBy(chat.userId);

    const activeUsers = activeUsersResult.length;

    // Get total documents (chats)
    const [totalDocumentsResult] = await db.select({ count: count() }).from(chat);
    const totalDocuments = totalDocumentsResult?.count || 0;

    // Get total media files (count attachments in messages)
    const messagesWithAttachments = await db
      .select({ attachments: message.attachments })
      .from(message)
      .where(sql`${message.attachments} IS NOT NULL AND ${message.attachments} != '[]'`);

    let totalMedia = 0;
    messagesWithAttachments.forEach((msg) => {
      if (Array.isArray(msg.attachments)) {
        totalMedia += msg.attachments.length;
      }
    });

    // Get storage used (approximate based on database size)
    // For a real implementation, you'd query actual file storage
    const storageUsed = 0; // Placeholder

    // System status
    const systemStatus = 'active';

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalDocuments,
      totalMedia,
      storageUsed,
      systemStatus,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
