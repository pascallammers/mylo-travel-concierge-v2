import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message } from '@/lib/db/schema';
import { eq, gte, count } from 'drizzle-orm';

/**
 * GET /api/admin/analytics/activity
 * Returns user activity analytics
 * Query params:
 * - days: number (default: 30)
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
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all messages in date range
    const messages = await db
      .select({
        userId: chat.userId,
        userEmail: user.email,
        createdAt: message.createdAt,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .innerJoin(user, eq(chat.userId, user.id))
      .where(gte(message.createdAt, startDate));

    // Calculate metrics
    let totalInteractions = messages.length;
    const activeUsersByDay = new Map<string, Set<string>>();
    const userInteractionMap = new Map<string, { email: string; interactions: number }>();

    messages.forEach((msg) => {
      // Track active users by day
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      if (!activeUsersByDay.has(dateKey)) {
        activeUsersByDay.set(dateKey, new Set());
      }
      activeUsersByDay.get(dateKey)!.add(msg.userId);

      // Track user interactions
      const existing = userInteractionMap.get(msg.userId) || {
        email: msg.userEmail,
        interactions: 0,
      };
      existing.interactions += 1;
      userInteractionMap.set(msg.userId, existing);
    });

    // Get unique active users
    const uniqueActiveUsers = new Set(messages.map((m) => m.userId)).size;

    // Calculate average interactions per user
    const avgInteractionsPerUser =
      uniqueActiveUsers > 0 ? parseFloat((totalInteractions / uniqueActiveUsers).toFixed(2)) : 0;

    // Get most active user
    let mostActiveUser = null;
    if (userInteractionMap.size > 0) {
      const [userId, data] = Array.from(userInteractionMap.entries()).reduce((max, current) =>
        current[1].interactions > max[1].interactions ? current : max,
      );
      mostActiveUser = {
        userId,
        email: data.email,
        interactions: data.interactions,
      };
    }

    // Format active users by day
    const activeUsersByDayArray = Array.from(activeUsersByDay.entries())
      .map(([date, userSet]) => ({
        date,
        count: userSet.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalInteractions,
      uniqueActiveUsers,
      avgInteractionsPerUser,
      activeUsersByDay: activeUsersByDayArray,
      mostActiveUser,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching activity analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
