import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message, session, subscription } from '@/lib/db/schema';
import { count, desc, ilike, or, sql, eq, inArray, and, gte, lte, isNotNull } from 'drizzle-orm';

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
 * - status: 'active' | 'inactive' (optional, filters by is_active)
 * - role: 'user' | 'admin' (optional, filters by role)
 * - expiresIn: '7' | '30' | '60' | '90' (optional, filters by subscription expiring within X days)
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
    const statusFilter = searchParams.get('status') as 'active' | 'inactive' | null;
    const roleFilter = searchParams.get('role') as 'user' | 'admin' | null;
    const expiresInFilter = searchParams.get('expiresIn') as '7' | '30' | '60' | '90' | null;
    const offset = (page - 1) * limit;

    // Build where conditions array
    const conditions = [];

    // Search condition
    if (search) {
      conditions.push(or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`)));
    }

    // Status filter (active/inactive) - filters by subscription status, not user.isActive
    // Active: user has a subscription with currentPeriodEnd > now
    // Inactive: user has no subscription OR subscription has expired
    if (statusFilter === 'active') {
      const now = new Date();
      conditions.push(
        sql`"user".id IN (
          SELECT DISTINCT sub."userId" FROM subscription sub
          WHERE sub."currentPeriodEnd" > ${now.toISOString()}::timestamp
          AND sub."userId" IS NOT NULL
        )`
      );
    } else if (statusFilter === 'inactive') {
      const now = new Date();
      conditions.push(
        sql`"user".id NOT IN (
          SELECT DISTINCT sub."userId" FROM subscription sub
          WHERE sub."currentPeriodEnd" > ${now.toISOString()}::timestamp
          AND sub."userId" IS NOT NULL
        )`
      );
    }

    // Role filter
    if (roleFilter) {
      conditions.push(eq(user.role, roleFilter));
    }

    // ExpiresIn filter - filter users by subscription expiring within X days
    // This requires a subquery on the subscription table
    if (expiresInFilter) {
      const days = parseInt(expiresInFilter, 10);
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      // Subquery: user ID must have a subscription ending between now and futureDate
      conditions.push(
        sql`"user".id IN (
          SELECT DISTINCT sub."userId" FROM subscription sub
          WHERE sub."currentPeriodEnd" >= ${now.toISOString()}::timestamp
          AND sub."currentPeriodEnd" <= ${futureDate.toISOString()}::timestamp
          AND sub."userId" IS NOT NULL
        )`
      );
    }

    // Combine all conditions
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Calculate date for 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // OPTIMIZED: Single query with subqueries for aggregated stats
    // Using raw SQL strings for subqueries to avoid Drizzle interpolation issues
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
        lastLogin: sql<string | null>`(
          SELECT MAX(s.created_at)::text
          FROM "session" s
          WHERE s.user_id = "user".id
        )`.as('last_login'),
        // Subquery: Session count
        sessionCount: sql<number>`(
          SELECT COALESCE(COUNT(*), 0)::int
          FROM "session" s
          WHERE s.user_id = "user".id
        )`.as('session_count'),
        // Subquery: Token usage (last 30 days)
        tokensUsed: sql<number>`(
          SELECT COALESCE(SUM(m.total_tokens), 0)::int
          FROM "message" m
          INNER JOIN "chat" c ON m.chat_id = c.id
          WHERE c."userId" = "user".id
          AND m.created_at >= ${thirtyDaysAgoISO}::timestamp
        )`.as('tokens_used'),
        // Subquery: Active days (unique days with messages in last 30 days)
        activeDays: sql<number>`(
          SELECT COALESCE(COUNT(DISTINCT DATE(m.created_at)), 0)::int
          FROM "message" m
          INNER JOIN "chat" c ON m.chat_id = c.id
          WHERE c."userId" = "user".id
          AND m.created_at >= ${thirtyDaysAgoISO}::timestamp
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

      // Parse lastLogin string back to date if it exists
      const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || 'user',
        createdAt: u.createdAt.toISOString(),
        registeredAt: u.createdAt.toISOString(),
        lastLogin: lastLoginDate?.toISOString() || null,
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
