import { dbUncached as db } from '@/lib/db';
import {
  thriveCartTransaction,
  thriveCartImportState,
  subscription,
  user,
} from '@/lib/db/schema';
import { eq, and, count, ne, desc } from 'drizzle-orm';

export const DATE_RANGES = ['this_month', 'last_month', 'this_year', 'last_year', 'all_time'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export interface KPIData {
  dateRange: DateRange;
  revenue: RevenueKPIs;
  subscriptions: SubscriptionKPIs;
  churn: ChurnKPIs;
  payments: PaymentKPIs;
  growth: GrowthData;
  importState: ImportState;
}

interface RevenueKPIs {
  mrr: number;
  totalRevenue: number;
  previousPeriodRevenue: number;
  revenueGrowthPercent: number;
  arpu: number;
  ltv: number;
  currency: string;
}

interface SubscriptionKPIs {
  totalActiveSubscribers: number;
  totalCancelledSubscribers: number;
  newSubscribers: number;
  previousPeriodNewSubscribers: number;
  averageSubscriptionMonths: number;
}

interface ChurnKPIs {
  churnRate: number;
  previousPeriodChurnRate: number;
  churned: number;
  previousPeriodChurned: number;
}

interface PaymentKPIs {
  totalPayments: number;
  successfulRebills: number;
  failedPayments: number;
  refunds: number;
  refundAmount: number;
  paymentSuccessRate: number;
}

interface GrowthData {
  monthlyRevenue: Array<{ month: string; revenue: number; subscribers: number }>;
  monthlyChurn: Array<{ month: string; churnRate: number; churned: number }>;
}

interface ImportState {
  lastImportAt: string | null;
  totalImported: number;
  status: string;
  lastTransactionAt: string | null;
  dataFreshness: 'fresh' | 'stale' | 'critical' | 'unknown';
  hoursStale: number | null;
}

interface PeriodBounds {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

/**
 * Get the start of a month, N months ago from today.
 */
function monthStart(monthsAgo: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute period boundaries for a given date range selection.
 */
function getPeriodBounds(dateRange: DateRange): PeriodBounds {
  const now = new Date();

  switch (dateRange) {
    case 'this_month': {
      const start = monthStart(0);
      const previousStart = monthStart(1);
      const previousEnd = new Date(start);
      previousEnd.setMilliseconds(-1);
      return { start, end: now, previousStart, previousEnd };
    }
    case 'last_month': {
      const start = monthStart(1);
      const end = new Date(monthStart(0));
      end.setMilliseconds(-1);
      const previousStart = monthStart(2);
      const previousEnd = new Date(start);
      previousEnd.setMilliseconds(-1);
      return { start, end, previousStart, previousEnd };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const previousStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const previousEnd = new Date(start);
      previousEnd.setMilliseconds(-1);
      return { start, end: now, previousStart, previousEnd };
    }
    case 'last_year': {
      const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setMilliseconds(-1);
      const previousStart = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0, 0);
      const previousEnd = new Date(start);
      previousEnd.setMilliseconds(-1);
      return { start, end, previousStart, previousEnd };
    }
    case 'all_time': {
      const start = new Date(2020, 0, 1);
      return { start, end: now, previousStart: start, previousEnd: start };
    }
  }
}

/**
 * Check if a transaction represents a paying customer (not a free trial).
 */
function isPaidTransaction(amount: number): boolean {
  return amount > 0;
}

/**
 * Check if a date falls within a period (inclusive).
 */
function isInPeriod(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

/**
 * Compute all KPIs from stored transaction and subscription data.
 * @param dateRange - The time period to compute KPIs for.
 */
export async function computeKPIs(dateRange: DateRange = 'this_month'): Promise<KPIData> {
  const now = new Date();
  const bounds = getPeriodBounds(dateRange);
  const lastFullMonthStart = monthStart(1);
  const lastFullMonthEnd = new Date(monthStart(0));
  lastFullMonthEnd.setMilliseconds(-1);

  const allTransactions = await db
    .select({
      transactionType: thriveCartTransaction.transactionType,
      amount: thriveCartTransaction.amount,
      currency: thriveCartTransaction.currency,
      transactionDate: thriveCartTransaction.transactionDate,
      customerEmail: thriveCartTransaction.customerEmail,
      orderId: thriveCartTransaction.orderId,
    })
    .from(thriveCartTransaction);

  // Period-scoped accumulators
  let periodRevenue = 0;
  let previousPeriodRevenue = 0;
  let periodRebills = 0;
  let periodFailed = 0;
  let periodRefunds = 0;
  let periodRefundAmount = 0;
  let periodPayments = 0;
  let lastMonthRevenue = 0;

  const periodNewCustomers = new Set<string>();
  const previousPeriodNewCustomers = new Set<string>();
  const periodCancels = new Set<string>();
  const previousPeriodCancels = new Set<string>();

  // Monthly aggregation for charts (always last 12 months, independent of dateRange)
  const monthlyMap = new Map<string, { revenue: number; newPaidSubs: number; cancels: number }>();

  for (const txn of allTransactions) {
    const email = txn.customerEmail.toLowerCase();
    const date = txn.transactionDate;
    const amount = txn.amount;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { revenue: 0, newPaidSubs: 0, cancels: 0 });
    }
    const monthData = monthlyMap.get(monthKey)!;

    if (txn.transactionType === 'charge' || txn.transactionType === 'rebill') {
      if (!isPaidTransaction(amount)) continue;

      monthData.revenue += amount;

      if (txn.transactionType === 'charge') {
        monthData.newPaidSubs++;
        if (isInPeriod(date, bounds.start, bounds.end)) {
          periodNewCustomers.add(email);
        }
        if (isInPeriod(date, bounds.previousStart, bounds.previousEnd)) {
          previousPeriodNewCustomers.add(email);
        }
      }

      if (isInPeriod(date, bounds.start, bounds.end)) {
        periodRevenue += amount;
        periodPayments++;
        if (txn.transactionType === 'rebill') periodRebills++;
      }
      if (isInPeriod(date, bounds.previousStart, bounds.previousEnd)) {
        previousPeriodRevenue += amount;
      }
      if (isInPeriod(date, lastFullMonthStart, lastFullMonthEnd)) {
        lastMonthRevenue += amount;
      }
    } else if (txn.transactionType === 'refund') {
      monthData.revenue -= amount;
      if (isInPeriod(date, bounds.start, bounds.end)) {
        periodRefunds++;
        periodRefundAmount += amount;
        periodRevenue -= amount;
      }
      if (isInPeriod(date, bounds.previousStart, bounds.previousEnd)) {
        previousPeriodRevenue -= amount;
      }
    } else if (txn.transactionType === 'cancel') {
      monthData.cancels++;
      if (isInPeriod(date, bounds.start, bounds.end)) {
        periodCancels.add(email);
      }
      if (isInPeriod(date, bounds.previousStart, bounds.previousEnd)) {
        previousPeriodCancels.add(email);
      }
    } else if (txn.transactionType === 'failed') {
      if (isInPeriod(date, bounds.start, bounds.end)) {
        periodFailed++;
      }
    }
  }

  // --- Subscription-based metrics (always current state) ---
  const activeSubsResult = await db
    .select({ count: count() })
    .from(subscription)
    .innerJoin(user, eq(subscription.userId, user.id))
    .where(
      and(
        eq(subscription.status, 'active'),
        ne(user.role, 'admin')
      )
    );
  const totalActiveSubscribers = activeSubsResult[0]?.count || 0;

  const cancelledSubsResult = await db
    .select({ count: count() })
    .from(subscription)
    .where(eq(subscription.status, 'cancelled'));
  const totalCancelledSubscribers = cancelledSubsResult[0]?.count || 0;

  const subsWithDuration = await db
    .select({
      startedAt: subscription.startedAt,
      canceledAt: subscription.canceledAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })
    .from(subscription);

  let totalMonths = 0;
  let countedSubs = 0;
  for (const sub of subsWithDuration) {
    const start = sub.startedAt;
    const end = sub.canceledAt || sub.currentPeriodEnd || now;
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months > 0 && months < 120) {
      totalMonths += months;
      countedSubs++;
    }
  }
  const avgSubMonths = countedSubs > 0 ? Math.round((totalMonths / countedSubs) * 10) / 10 : 0;

  // --- Calculate KPIs ---
  // MRR always based on last full month (current state metric)
  const arpu = totalActiveSubscribers > 0 && lastMonthRevenue > 0
    ? Math.round(lastMonthRevenue / totalActiveSubscribers)
    : 0;
  const mrr = totalActiveSubscribers > 0 && arpu > 0
    ? arpu * totalActiveSubscribers
    : lastMonthRevenue;

  const ltv = arpu > 0 && avgSubMonths > 0
    ? Math.round(arpu * avgSubMonths)
    : 0;

  const revenueGrowthPercent = previousPeriodRevenue > 0 && dateRange !== 'all_time'
    ? Math.round(((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 1000) / 10
    : 0;

  // Churn: cancellations / active subscribers at start of period
  const activeAtPeriodStart = totalActiveSubscribers + periodCancels.size;
  const churnRate = activeAtPeriodStart > 0
    ? Math.round((periodCancels.size / activeAtPeriodStart) * 1000) / 10
    : 0;

  const activeAtPreviousPeriodStart = activeAtPeriodStart + previousPeriodCancels.size;
  const previousPeriodChurnRate = activeAtPreviousPeriodStart > 0 && dateRange !== 'all_time'
    ? Math.round((previousPeriodCancels.size / activeAtPreviousPeriodStart) * 1000) / 10
    : 0;

  const totalSuccessful = periodRebills + periodNewCustomers.size;
  const paymentSuccessRate = (totalSuccessful + periodFailed) > 0
    ? Math.round((totalSuccessful / (totalSuccessful + periodFailed)) * 1000) / 10
    : 100;

  // --- Growth charts: last 12 months (always shown) ---
  const sortedMonthKeys = Array.from(monthlyMap.keys()).sort();
  const cumulativeSubscribers = new Map<string, number>();
  let runningTotal = 0;
  for (const key of sortedMonthKeys) {
    const data = monthlyMap.get(key)!;
    runningTotal += data.newPaidSubs - data.cancels;
    cumulativeSubscribers.set(key, Math.max(0, runningTotal));
  }

  const monthlyRevenue: Array<{ month: string; revenue: number; subscribers: number }> = [];
  const monthlyChurn: Array<{ month: string; churnRate: number; churned: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const ms = monthStart(i);
    const key = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}`;
    const data = monthlyMap.get(key) || { revenue: 0, newPaidSubs: 0, cancels: 0 };

    monthlyRevenue.push({
      month: key,
      revenue: Math.round(data.revenue / 100),
      subscribers: data.newPaidSubs,
    });

    const prevMs = monthStart(i + 1);
    const prevKey = `${prevMs.getFullYear()}-${String(prevMs.getMonth() + 1).padStart(2, '0')}`;
    const subscribersAtStart = cumulativeSubscribers.get(prevKey) || 0;
    const monthChurnRate = subscribersAtStart > 0
      ? Math.round((data.cancels / subscribersAtStart) * 1000) / 10
      : 0;

    monthlyChurn.push({
      month: key,
      churnRate: monthChurnRate,
      churned: data.cancels,
    });
  }

  // --- Import state + data freshness ---
  const importStateRows = await db
    .select()
    .from(thriveCartImportState)
    .where(eq(thriveCartImportState.id, 'singleton'));
  const importRow = importStateRows[0];

  // Check when the most recent transaction was recorded (from webhook or import)
  const [latestTransaction] = await db
    .select({ importedAt: thriveCartTransaction.importedAt })
    .from(thriveCartTransaction)
    .orderBy(desc(thriveCartTransaction.importedAt))
    .limit(1);
  const lastTransactionAt = latestTransaction?.importedAt || importRow?.lastImportAt;
  const hoursStale = lastTransactionAt
    ? Math.round((now.getTime() - lastTransactionAt.getTime()) / (1000 * 60 * 60))
    : null;
  const dataFreshness = hoursStale === null ? 'unknown' : hoursStale <= 24 ? 'fresh' : hoursStale <= 72 ? 'stale' : 'critical';

  return {
    dateRange,
    revenue: {
      mrr: Math.round(mrr / 100),
      totalRevenue: Math.round(periodRevenue / 100),
      previousPeriodRevenue: Math.round(previousPeriodRevenue / 100),
      revenueGrowthPercent,
      arpu: Math.round(arpu / 100),
      ltv: Math.round(ltv / 100),
      currency: 'EUR',
    },
    subscriptions: {
      totalActiveSubscribers,
      totalCancelledSubscribers,
      newSubscribers: periodNewCustomers.size,
      previousPeriodNewSubscribers: previousPeriodNewCustomers.size,
      averageSubscriptionMonths: avgSubMonths,
    },
    churn: {
      churnRate,
      previousPeriodChurnRate,
      churned: periodCancels.size,
      previousPeriodChurned: previousPeriodCancels.size,
    },
    payments: {
      totalPayments: periodPayments,
      successfulRebills: periodRebills,
      failedPayments: periodFailed,
      refunds: periodRefunds,
      refundAmount: Math.round(periodRefundAmount / 100),
      paymentSuccessRate,
    },
    growth: {
      monthlyRevenue,
      monthlyChurn,
    },
    importState: {
      lastImportAt: importRow?.lastImportAt?.toISOString() || null,
      totalImported: importRow?.totalImported || 0,
      status: importRow?.status || 'unknown',
      lastTransactionAt: lastTransactionAt?.toISOString() || null,
      dataFreshness,
      hoursStale,
    },
  };
}
