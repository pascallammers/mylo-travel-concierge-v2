import { db } from '@/lib/db';
import {
  thriveCartTransaction,
  thriveCartImportState,
  subscription,
  user,
} from '@/lib/db/schema';
import { eq, gte, lte, and, sql, count, desc, ne } from 'drizzle-orm';

export interface KPIData {
  revenue: RevenueKPIs;
  subscriptions: SubscriptionKPIs;
  churn: ChurnKPIs;
  payments: PaymentKPIs;
  growth: GrowthData;
  importState: ImportState;
}

interface RevenueKPIs {
  mrr: number;
  totalRevenueAllTime: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowthPercent: number;
  arpu: number;
  ltv: number;
  currency: string;
}

interface SubscriptionKPIs {
  totalActiveSubscribers: number;
  totalCancelledSubscribers: number;
  newSubscribersThisMonth: number;
  newSubscribersLastMonth: number;
  averageSubscriptionMonths: number;
}

interface ChurnKPIs {
  churnRateThisMonth: number;
  churnRateLastMonth: number;
  churnedThisMonth: number;
  churnedLastMonth: number;
}

interface PaymentKPIs {
  totalPaymentsAllTime: number;
  successfulRebillsThisMonth: number;
  failedPaymentsThisMonth: number;
  refundsThisMonth: number;
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
 * Get the end of a month, N months ago from today.
 */
function monthEnd(monthsAgo: number): Date {
  const d = monthStart(monthsAgo);
  d.setMonth(d.getMonth() + 1);
  d.setMilliseconds(-1);
  return d;
}

/**
 * Compute all KPIs from stored transaction and subscription data.
 */
export async function computeKPIs(): Promise<KPIData> {
  const now = new Date();
  const thisMonthStart = monthStart(0);
  const lastMonthStart = monthStart(1);
  const lastMonthEnd = monthEnd(1);

  // --- Revenue from transactions ---
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

  // Total revenue all-time (charges + rebills - refunds)
  let totalRevenueAllTime = 0;
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let rebillsThisMonth = 0;
  let failedThisMonth = 0;
  let refundsThisMonth = 0;
  let refundAmountThisMonth = 0;
  let totalPaymentsAllTime = 0;

  // Track unique customers and their first purchase + total payments
  const customerFirstPurchase = new Map<string, Date>();
  const customerPaymentCount = new Map<string, number>();
  const customerTotalPaid = new Map<string, number>();
  const newCustomersThisMonth = new Set<string>();
  const newCustomersLastMonth = new Set<string>();
  const cancelsThisMonth = new Set<string>();
  const cancelsLastMonth = new Set<string>();

  // Monthly aggregation for charts (last 12 months)
  const monthlyMap = new Map<string, { revenue: number; newSubs: number; cancels: number }>();

  for (const txn of allTransactions) {
    const email = txn.customerEmail.toLowerCase();
    const date = txn.transactionDate;
    const amount = txn.amount; // in cents
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { revenue: 0, newSubs: 0, cancels: 0 });
    }
    const monthData = monthlyMap.get(monthKey)!;

    if (txn.transactionType === 'charge' || txn.transactionType === 'rebill') {
      totalRevenueAllTime += amount;
      totalPaymentsAllTime++;
      monthData.revenue += amount;

      // Track customer metrics
      const currentCount = customerPaymentCount.get(email) || 0;
      customerPaymentCount.set(email, currentCount + 1);
      customerTotalPaid.set(email, (customerTotalPaid.get(email) || 0) + amount);

      if (!customerFirstPurchase.has(email) || date < customerFirstPurchase.get(email)!) {
        customerFirstPurchase.set(email, date);
      }

      if (txn.transactionType === 'charge') {
        // First purchase = new subscriber
        if (date >= thisMonthStart) {
          newCustomersThisMonth.add(email);
          monthData.newSubs++;
        } else if (date >= lastMonthStart && date <= lastMonthEnd) {
          newCustomersLastMonth.add(email);
        }
      }

      if (date >= thisMonthStart) {
        revenueThisMonth += amount;
        if (txn.transactionType === 'rebill') rebillsThisMonth++;
      } else if (date >= lastMonthStart && date <= lastMonthEnd) {
        revenueLastMonth += amount;
      }
    } else if (txn.transactionType === 'refund') {
      totalRevenueAllTime -= amount;
      monthData.revenue -= amount;
      if (date >= thisMonthStart) {
        refundsThisMonth++;
        refundAmountThisMonth += amount;
      }
    } else if (txn.transactionType === 'cancel') {
      if (date >= thisMonthStart) {
        cancelsThisMonth.add(email);
        monthData.cancels++;
      } else if (date >= lastMonthStart && date <= lastMonthEnd) {
        cancelsLastMonth.add(email);
      }
    } else if (txn.transactionType === 'failed') {
      if (date >= thisMonthStart) {
        failedThisMonth++;
      }
    }
  }

  // --- Subscription-based metrics from DB ---
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

  // Average subscription duration
  const subsWithDuration = await db
    .select({
      startedAt: subscription.startedAt,
      canceledAt: subscription.canceledAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
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
  const mrr = totalActiveSubscribers > 0 && revenueThisMonth > 0
    ? revenueThisMonth
    : revenueLastMonth; // fallback if month just started

  const arpu = totalActiveSubscribers > 0
    ? Math.round(mrr / totalActiveSubscribers)
    : 0;

  const ltv = arpu > 0 && avgSubMonths > 0
    ? Math.round(arpu * avgSubMonths)
    : 0;

  const revenueGrowthPercent = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 1000) / 10
    : 0;

  // Churn: cancellations this month / active subscribers at start of month
  const activeAtMonthStart = totalActiveSubscribers + cancelsThisMonth.size;
  const churnRateThisMonth = activeAtMonthStart > 0
    ? Math.round((cancelsThisMonth.size / activeAtMonthStart) * 1000) / 10
    : 0;

  const activeAtLastMonthStart = totalActiveSubscribers + cancelsThisMonth.size + cancelsLastMonth.size;
  const churnRateLastMonth = activeAtLastMonthStart > 0
    ? Math.round((cancelsLastMonth.size / activeAtLastMonthStart) * 1000) / 10
    : 0;

  const totalRebillsAndChargesThisMonth = rebillsThisMonth + newCustomersThisMonth.size;
  const paymentSuccessRate = (totalRebillsAndChargesThisMonth + failedThisMonth) > 0
    ? Math.round((totalRebillsAndChargesThisMonth / (totalRebillsAndChargesThisMonth + failedThisMonth)) * 1000) / 10
    : 100;

  // --- Growth charts: last 12 months ---
  const monthlyRevenue: Array<{ month: string; revenue: number; subscribers: number }> = [];
  const monthlyChurn: Array<{ month: string; churnRate: number; churned: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const ms = monthStart(i);
    const key = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}`;
    const data = monthlyMap.get(key) || { revenue: 0, newSubs: 0, cancels: 0 };

    monthlyRevenue.push({
      month: key,
      revenue: Math.round(data.revenue / 100), // convert cents to euros
      subscribers: data.newSubs,
    });

    // Rough churn estimation per month
    const estimated = data.newSubs > 0 ? Math.round((data.cancels / (data.newSubs + data.cancels || 1)) * 100) : 0;
    monthlyChurn.push({
      month: key,
      churnRate: estimated,
      churned: data.cancels,
    });
  }

  // --- Import state ---
  const importStateRows = await db
    .select()
    .from(thriveCartImportState)
    .where(eq(thriveCartImportState.id, 'singleton'));

  const importRow = importStateRows[0];

  return {
    revenue: {
      mrr: Math.round(mrr / 100), // cents -> euros
      totalRevenueAllTime: Math.round(totalRevenueAllTime / 100),
      revenueThisMonth: Math.round(revenueThisMonth / 100),
      revenueLastMonth: Math.round(revenueLastMonth / 100),
      revenueGrowthPercent,
      arpu: Math.round(arpu / 100),
      ltv: Math.round(ltv / 100),
      currency: 'EUR',
    },
    subscriptions: {
      totalActiveSubscribers,
      totalCancelledSubscribers,
      newSubscribersThisMonth: newCustomersThisMonth.size,
      newSubscribersLastMonth: newCustomersLastMonth.size,
      averageSubscriptionMonths: avgSubMonths,
    },
    churn: {
      churnRateThisMonth,
      churnRateLastMonth,
      churnedThisMonth: cancelsThisMonth.size,
      churnedLastMonth: cancelsLastMonth.size,
    },
    payments: {
      totalPaymentsAllTime,
      successfulRebillsThisMonth: rebillsThisMonth,
      failedPaymentsThisMonth: failedThisMonth,
      refundsThisMonth,
      refundAmount: Math.round(refundAmountThisMonth / 100),
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
    },
  };
}
