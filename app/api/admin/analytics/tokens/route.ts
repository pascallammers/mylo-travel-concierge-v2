import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { chat, message, user } from '@/lib/db/schema';
import {
  calculateGrokTokenCost,
  calculateRevenueBaseline,
  DEFAULT_USD_TO_EUR_RATE,
  GROK_45_PRICING_USD_PER_MILLION,
  MONTHLY_REVENUE_PER_USER_EUR,
} from '@/lib/admin/token-costs';
import { and, eq, gte, sql } from 'drizzle-orm';

type UsageRow = {
  userId: string;
  email: string;
  model: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
};

/**
 * GET /api/admin/analytics/tokens
 * Returns Grok token usage, cost, and revenue-baseline analytics. Rows are
 * aggregated per model so historical Grok 4.3 messages keep 4.3 pricing while
 * Grok 4.5 messages are billed at 4.5 rates.
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

    const userCostRows = [...aggregateUsersAcrossModels(usageRows).values()]
      .map((row) => {
        const baseline = calculateRevenueBaseline({
          costUsd: row.rawCostUsd,
          days,
          monthlyRevenueEur: MONTHLY_REVENUE_PER_USER_EUR,
          usdToEurRate: DEFAULT_USD_TO_EUR_RATE,
        });

        return {
          userId: row.userId,
          email: row.email,
          messageCount: row.messageCount,
          inputTokens: row.inputTokens,
          cachedInputTokens: row.cachedInputTokens,
          billableInputTokens: row.billableInputTokens,
          outputTokens: row.outputTokens,
          totalTokens: row.totalTokens,
          costUsd: roundCurrency(row.rawCostUsd),
          revenueEur: roundCurrency(baseline.revenueEur),
          estimatedProfitEur: roundCurrency(baseline.profitEur),
          rawCostUsd: row.rawCostUsd,
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

    const dailyUsage = [...aggregateDaysAcrossModels(dailyUsageRows).values()].map((row) => ({
      date: row.date,
      inputTokens: row.inputTokens,
      cachedInputTokens: row.cachedInputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      tokens: row.totalTokens,
      costUsd: roundCurrency(row.rawCostUsd),
    }));

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
        model: 'grok-4.5',
        inputUsdPerMillion: GROK_45_PRICING_USD_PER_MILLION.input,
        cachedInputUsdPerMillion: GROK_45_PRICING_USD_PER_MILLION.cachedInput,
        outputUsdPerMillion: GROK_45_PRICING_USD_PER_MILLION.output,
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
      model: message.model,
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
    .groupBy(chat.userId, user.email, message.model);
}

async function getDailyUsage(startDate: Date) {
  return db
    .select({
      date: sql<string>`DATE(${message.createdAt})::text`,
      model: message.model,
      inputTokens: sql<number>`COALESCE(SUM(${message.inputTokens}), 0)::int`,
      cachedInputTokens: sql<number>`COALESCE(SUM(${message.cachedInputTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${message.outputTokens}), 0)::int`,
      totalTokens: sql<number>`COALESCE(SUM(${message.totalTokens}), 0)::int`,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(and(gte(message.createdAt, startDate), gte(message.totalTokens, 1)))
    .groupBy(sql`DATE(${message.createdAt})`, message.model)
    .orderBy(sql`DATE(${message.createdAt})`);
}

type UserAggregate = {
  userId: string;
  email: string;
  messageCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  billableInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  rawCostUsd: number;
};

function aggregateUsersAcrossModels(rows: UsageRow[]): Map<string, UserAggregate> {
  const perUser = new Map<string, UserAggregate>();
  for (const row of rows) {
    const cost = calculateGrokTokenCost(row, row.model);
    const aggregate = perUser.get(row.userId) ?? {
      userId: row.userId,
      email: row.email,
      messageCount: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      billableInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      rawCostUsd: 0,
    };
    aggregate.messageCount += row.messageCount;
    aggregate.inputTokens += cost.inputTokens;
    aggregate.cachedInputTokens += cost.cachedInputTokens;
    aggregate.billableInputTokens += cost.billableInputTokens;
    aggregate.outputTokens += cost.outputTokens;
    aggregate.totalTokens += cost.totalTokens;
    aggregate.rawCostUsd += cost.totalCostUsd;
    perUser.set(row.userId, aggregate);
  }
  return perUser;
}

type DailyAggregate = {
  date: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  rawCostUsd: number;
};

function aggregateDaysAcrossModels(
  rows: Awaited<ReturnType<typeof getDailyUsage>>,
): Map<string, DailyAggregate> {
  const perDay = new Map<string, DailyAggregate>();
  for (const row of rows) {
    const cost = calculateGrokTokenCost(row, row.model);
    const aggregate = perDay.get(row.date) ?? {
      date: row.date,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      rawCostUsd: 0,
    };
    aggregate.inputTokens += cost.inputTokens;
    aggregate.cachedInputTokens += cost.cachedInputTokens;
    aggregate.outputTokens += cost.outputTokens;
    aggregate.totalTokens += cost.totalTokens;
    aggregate.rawCostUsd += cost.totalCostUsd;
    perDay.set(row.date, aggregate);
  }
  return perDay;
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
