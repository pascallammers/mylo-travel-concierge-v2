import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message, session, subscription } from '@/lib/db/schema';
import { count, desc, ilike, or, sql, eq, inArray } from 'drizzle-orm';

/**
 * Subscription status type for admin user list
 */
type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'none';

/**
 * Determines the subscription status based on subscription data
 */
function determineSubscriptionStatus(
  sub: { status: string; currentPeriodEnd: Date; cancelAtPeriodEnd: boolean } | null
): { status: SubscriptionStatus; validUntil: string | null } {
  if (!sub) {
    return { status: 'none', validUntil: null };
  }

  const now = new Date();
  const periodEnd = sub.currentPeriodEnd;

  if (sub.status === 'active' && periodEnd > now) {
    return { status: 'active', validUntil: periodEnd.toISOString() };
  } else if (sub.cancelAtPeriodEnd) {
    return { status: 'cancelled', validUntil: periodEnd.toISOString() };
  } else if (sub.status === 'canceled' || periodEnd < now) {
    return { status: 'inactive', validUntil: null };
  }
  
  return { status: 'active', validUntil: periodEnd.toISOString() };
}

/**
 * GET /api/admin/users
 * Returns paginated list of users with statistics
 * 
 * OPTIMIZED: Uses batch queries instead of N+1 pattern
 * - Single query for users with aggregated stats via subqueries
 * - Batch load subscriptions for all users at once
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 100)
 * - search: string (optional, searches name and email)
 * 
 * @requires Admin role
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

    // Calculate date for 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // OPTIMIZED: Single query with subqueries for aggregated stats
    // This replaces ~5 queries per user with a single query
    const usersWithStats = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        isActive: user.isActive,
        activationStatus: user.activationStatus,
        // Subquery: Last login (max session created_at)
        lastLogin: sql<Date | null>`(
          SELECT MAX(${session.createdAt})
          FROM ${session}
          WHERE ${session.userId} = ${user.id}
        )`.as('last_login'),
        // Subquery: Session count
        sessionCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${session}
          WHERE ${session.userId} = ${user.id}
        )`.as('session_count'),
        // Subquery: Token usage (last 30 days)
        tokensUsed: sql<number>`(
          SELECT COALESCE(SUM(${message.totalTokens}), 0)::int
          FROM ${message}
          INNER JOIN ${chat} ON ${message.chatId} = ${chat.id}
          WHERE ${chat.userId} = ${user.id}
          AND ${message.createdAt} >= ${thirtyDaysAgo}
        )`.as('tokens_used'),
        // Subquery: Active days (unique days with messages in last 30 days)
        activeDays: sql<number>`(
          SELECT COUNT(DISTINCT DATE(${message.createdAt}))::int
          FROM ${message}
          INNER JOIN ${chat} ON ${message.chatId} = ${chat.id}
          WHERE ${chat.userId} = ${user.id}
          AND ${message.createdAt} >= ${thirtyDaysAgo}
        )`.as('active_days'),
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count (separate query for pagination)
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    // OPTIMIZED: Batch load all subscriptions at once
    const userIds = usersWithStats.map((u) => u.id);
    
    // Only query if we have users
    const allSubscriptions = userIds.length > 0 
      ? await db
          .select({
            userId: subscription.userId,
            status: subscription.status,
            planName: subscription.planName,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            createdAt: subscription.createdAt,
          })
          .from(subscription)
          .where(inArray(subscription.userId, userIds))
          .orderBy(desc(subscription.createdAt))
      : [];

    // Create a map for O(1) subscription lookup
    // Keep only the most recent subscription per user
    const subscriptionMap = new Map<string, typeof allSubscriptions[0]>();
    for (const sub of allSubscriptions) {
      if (sub.userId && !subscriptionMap.has(sub.userId)) {
        subscriptionMap.set(sub.userId, sub);
      }
    }

    // Map users to response format
    const enrichedUsers = usersWithStats.map((u) => {
      const userSub = subscriptionMap.get(u.id);
      const { status: subscriptionStatus, validUntil } = determineSubscriptionStatus(
        userSub ? {
          status: userSub.status,
          currentPeriodEnd: userSub.currentPeriodEnd,
          cancelAtPeriodEnd: userSub.cancelAtPeriodEnd,
        } : null
      );

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || 'user',
        createdAt: u.createdAt.toISOString(),
        registeredAt: u.createdAt.toISOString(),
        lastLogin: u.lastLogin?.toISOString() || null,
        activeDays: u.activeDays || 0,
        sessions: u.sessionCount || 0,
        tokensUsed: u.tokensUsed || 0,
        subscriptionStatus,
        subscriptionPlan: userSub?.planName || null,
        subscriptionValidUntil: validUntil,
        isActive: u.isActive,
        activationStatus: u.activationStatus,
      };
    });

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
