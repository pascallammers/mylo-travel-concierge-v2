import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message, session } from '@/lib/db/schema';
import { count, desc, ilike, or, sql, gte } from 'drizzle-orm';

/**
 * GET /api/admin/users
 * Returns paginated list of users with statistics
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 100)
 * - search: string (optional, searches name and email)
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause = search
      ? or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`))
      : undefined;

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    // Get paginated users
    const users = await db.query.user.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(user.createdAt)],
    });

    // Calculate date for 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Enrich users with statistics
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        // Get last login from sessions
        const lastSessionResult = await db.query.session.findFirst({
          where: (session, { eq }) => eq(session.userId, u.id),
          orderBy: [desc(session.createdAt)],
          columns: { createdAt: true },
        });

        // Get session count
        const [sessionCountResult] = await db
          .select({ count: count() })
          .from(session)
          .where(sql`${session.userId} = ${u.id}`);

        // Get messages in last 30 days and calculate tokens
        const userChats = await db.query.chat.findMany({
          where: (chat, { eq }) => eq(chat.userId, u.id),
          columns: { id: true },
        });

        const chatIds = userChats.map((c) => c.id);

        let tokensUsed = 0;
        let activeDays = 0;

        if (chatIds.length > 0) {
          // Get messages from user's chats in last 30 days
          const userMessages = await db.query.message.findMany({
            where: (message, { and, inArray, gte }) =>
              and(inArray(message.chatId, chatIds), gte(message.createdAt, thirtyDaysAgo)),
            columns: { totalTokens: true, createdAt: true },
          });

          // Sum tokens
          tokensUsed = userMessages.reduce((sum, m) => sum + (m.totalTokens || 0), 0);

          // Calculate active days
          const uniqueDays = new Set(
            userMessages.map((m) => m.createdAt.toISOString().split('T')[0]),
          );
          activeDays = uniqueDays.size;
        }

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role || 'user',
          createdAt: u.createdAt.toISOString(),
          lastLogin: lastSessionResult?.createdAt.toISOString() || null,
          activeDays,
          sessions: sessionCountResult?.count || 0,
          tokensUsed,
        };
      }),
    );

    return NextResponse.json({
      users: enrichedUsers,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
