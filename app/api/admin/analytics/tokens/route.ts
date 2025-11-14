import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, chat, message } from '@/lib/db/schema';
import { eq, gte, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/analytics/tokens
 * Returns token usage analytics
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

    // Get all messages in date range with tokens
    const messages = await db
      .select({
        userId: chat.userId,
        userEmail: user.email,
        totalTokens: message.totalTokens,
        createdAt: message.createdAt,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .innerJoin(user, eq(chat.userId, user.id))
      .where(gte(message.createdAt, startDate));

    // Calculate total tokens and cost
    let totalTokens = 0;
    const userTokenMap = new Map<string, { email: string; tokens: number }>();
    const dailyTokenMap = new Map<string, number>();

    messages.forEach((msg) => {
      const tokens = msg.totalTokens || 0;
      totalTokens += tokens;

      // Aggregate by user
      const existing = userTokenMap.get(msg.userId) || { email: msg.userEmail, tokens: 0 };
      existing.tokens += tokens;
      userTokenMap.set(msg.userId, existing);

      // Aggregate by day
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      dailyTokenMap.set(dateKey, (dailyTokenMap.get(dateKey) || 0) + tokens);
    });

    // Calculate cost (example: $0.002 per 1K tokens for GPT-4)
    const costPerThousandTokens = 0.002;
    const totalCost = (totalTokens / 1000) * costPerThousandTokens;

    // Get top users by token usage
    const topUsers = Array.from(userTokenMap.entries())
      .map(([userId, data]) => ({
        userId,
        email: data.email,
        tokens: data.tokens,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 6);

    // Get daily usage
    const dailyUsage = Array.from(dailyTokenMap.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(2)),
      topUsers,
      dailyUsage,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching token analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
