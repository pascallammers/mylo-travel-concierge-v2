import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { chat, message, user } from '@/lib/db/schema';
import {
  calculateGrok43TokenCost,
  calculateRevenueBaseline,
  DEFAULT_USD_TO_EUR_RATE,
  GROK_43_PRICING_USD_PER_MILLION,
  MONTHLY_REVENUE_PER_USER_EUR,
} from '@/lib/admin/token-costs';
import { and, eq, gte, sql } from 'drizzle-orm';

type UsageRow = {
  userId: string;
  email: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
};

/**
 * GET /api/admin/analytics/tokens
 * Returns Grok 4.3 token usage, cost, and revenue-baseline analytics.
 * @param request - Incoming admin request with optional days query parameter.
 * @returns Token analytics for the selected period.
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseDays(searchParams.get('days'));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usageRows = await getUsageByUser(startDate);
    const dailyUsageRows = await getDailyUsage(startDate);
    const revenuePerUser = calculateRevenueBaseline({
      costUsd: 0,
      days,
      monthlyRevenueEur: MONTHLY_REVENUE_PER_USER_EUR,
      usdToEurRate: DEFAULT_USD_TO_EUR_RATE,
    }).revenueEur;

    const userCostRows = usageRows
      .map((row) => {
        const cost = calculateGrok43TokenCost(row);
        const baseline = calculateRevenueBaseline({
          costUsd: cost.totalCostUsd,
          days,
          monthlyRevenueEur: MONTHLY_REVENUE_PER_USER_EUR,
          usdToEurRate: DEFAULT_USD_TO_EUR_RATE,
        });

        return {
          userId: row.userId,
          email: row.email,
          messageCount: row.messageCount,
          inputTokens: cost.inputTokens,
          cachedInputTokens: cost.cachedInputTokens,
          billableInputTokens: cost.billableInputTokens,
          outputTokens: cost.outputTokens,
          totalTokens: cost.totalTokens,
          costUsd: roundCurrency(cost.totalCostUsd),
          revenueEur: roundCurrency(baseline.revenueEur),
          estimatedProfitEur: roundCurrency(baseline.profitEur),
          rawCostUsd: cost.totalCostUsd,
          rawRevenueEur: baseline.revenueEur,
          rawProfitEur: baseline.profitEur,
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);

    const users = userCostRows.map(({ rawCostUsd, rawRevenueEur, rawProfitEur, ...row }) => row);

    const totals = userCostRows.reduce(
      (acc, row) => ({
        inputTokens: acc.inputTokens + row.inputTokens,
        cachedInputTokens: acc.cachedInputTokens + row.cachedInputTokens,
        billableInputTokens: acc.billableInputTokens + row.billableInputTokens,
        outputTokens: acc.outputTokens + row.outputTokens,
        totalTokens: acc.totalTokens + row.totalTokens,
        totalCostUsd: acc.totalCostUsd + row.rawCostUsd,
        estimatedRevenueEur: acc.estimatedRevenueEur + row.rawRevenueEur,
        estimatedProfitEur: acc.estimatedProfitEur + row.rawProfitEur,
      }),
      {
        inputTokens: 0,
        cachedInputTokens: 0,
        billableInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        estimatedRevenueEur: 0,
        estimatedProfitEur: 0,
      },
    );

    const dailyUsage = dailyUsageRows.map((row) => {
      const cost = calculateGrok43TokenCost(row);
      return {
        date: row.date,
        inputTokens: cost.inputTokens,
        cachedInputTokens: cost.cachedInputTokens,
        outputTokens: cost.outputTokens,
        totalTokens: cost.totalTokens,
        tokens: cost.totalTokens,
        costUsd: roundCurrency(cost.totalCostUsd),
      };
    });

    return NextResponse.json({
      totalTokens: totals.totalTokens,
      totalCost: roundCurrency(totals.totalCostUsd),
      totalCostUsd: roundCurrency(totals.totalCostUsd),
      inputTokens: totals.inputTokens,
      cachedInputTokens: totals.cachedInputTokens,
      billableInputTokens: totals.billableInputTokens,
      outputTokens: totals.outputTokens,
      estimatedRevenueEur: roundCurrency(totals.estimatedRevenueEur),
      estimatedProfitEur: roundCurrency(totals.estimatedProfitEur),
      revenuePerUserEur: roundCurrency(revenuePerUser),
      trackedUsers: users.length,
      users,
      topUsers: users.slice(0, 6).map((row) => ({
        userId: row.userId,
        email: row.email,
        tokens: row.totalTokens,
        costUsd: row.costUsd,
      })),
      dailyUsage,
      pricing: {
        model: 'grok-4.3',
        inputUsdPerMillion: GROK_43_PRICING_USD_PER_MILLION.input,
        cachedInputUsdPerMillion: GROK_43_PRICING_USD_PER_MILLION.cachedInput,
        outputUsdPerMillion: GROK_43_PRICING_USD_PER_MILLION.output,
        monthlyRevenuePerUserEur: MONTHLY_REVENUE_PER_USER_EUR,
        usdToEurRate: DEFAULT_USD_TO_EUR_RATE,
      },
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

async function getUsageByUser(startDate: Date): Promise<UsageRow[]> {
  return db
    .select({
      userId: chat.userId,
      email: user.email,
      inputTokens: sql<number>`COALESCE(SUM(${message.inputTokens}), 0)::int`,
      cachedInputTokens: sql<number>`COALESCE(SUM(${message.cachedInputTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${message.outputTokens}), 0)::int`,
      totalTokens: sql<number>`COALESCE(SUM(${message.totalTokens}), 0)::int`,
      messageCount: sql<number>`COUNT(${message.id})::int`,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .innerJoin(user, eq(chat.userId, user.id))
    .where(and(gte(message.createdAt, startDate), gte(message.totalTokens, 1)))
    .groupBy(chat.userId, user.email);
}

async function getDailyUsage(startDate: Date) {
  return db
    .select({
      date: sql<string>`DATE(${message.createdAt})::text`,
      inputTokens: sql<number>`COALESCE(SUM(${message.inputTokens}), 0)::int`,
      cachedInputTokens: sql<number>`COALESCE(SUM(${message.cachedInputTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${message.outputTokens}), 0)::int`,
      totalTokens: sql<number>`COALESCE(SUM(${message.totalTokens}), 0)::int`,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(and(gte(message.createdAt, startDate), gte(message.totalTokens, 1)))
    .groupBy(sql`DATE(${message.createdAt})`)
    .orderBy(sql`DATE(${message.createdAt})`);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDays(value: string | null): number {
  const parsedDays = Number.parseInt(value || '30', 10);
  if (!Number.isFinite(parsedDays)) {
    return 30;
  }

  return Math.min(365, Math.max(1, parsedDays));
}
