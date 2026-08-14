import type { ThriveCartApiCustomer, ThriveCartApiPurchase, ThriveCartApiSubscription } from './types';

export type SyncDbState = {
  isActive: boolean;
  subStatus: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

export type FoundMyloApiSubscription = {
  status: string;
  productId: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  subscriptionId?: string;
  source: 'purchases' | 'subscriptions';
};

export type SyncAction =
  | { type: 'none' }
  | { type: 'skip_recent_webhook' }
  | { type: 'mark_cancelled'; reason: 'no_subscription' | 'tc_cancelled' }
  | { type: 'reactivate'; nextPaymentDate?: string }
  | { type: 'extend_period'; nextPaymentDate?: string }
  | { type: 'touch_synced' };

const ACTIVE_STATUSES = new Set(['active']);

/**
 * Finds a MYLO subscription on a ThriveCart customer payload.
 * Accepts both `purchases[].subscription` and the top-level `subscriptions[]` shape.
 *
 * @param customer - Raw ThriveCart customer API payload
 * @param productIds - MYLO product IDs (typically 1 and 5)
 * @returns Best matching MYLO subscription, preferring `active`
 */
export function findMyloApiSubscription(
  customer: ThriveCartApiCustomer | null | undefined,
  productIds: readonly number[]
): FoundMyloApiSubscription | null {
  if (!customer) {
    return null;
  }

  const fromPurchases = collectFromPurchases(customer.purchases, productIds);
  const fromSubscriptions = collectFromSubscriptions(customer.subscriptions, productIds);
  const all = [...fromPurchases, ...fromSubscriptions];

  if (all.length === 0) {
    return null;
  }

  const active = all.find((item) => isActiveStatus(item.status));
  return active ?? all[0] ?? null;
}

/**
 * Decides how cron sync should reconcile one DB user against ThriveCart.
 *
 * @param dbState - Current Mylo user + subscription snapshot
 * @param tcCustomer - ThriveCart customer payload (or null when not found)
 * @param recentWebhook - True when a recent order.success or rebill webhook exists
 * @param productIds - MYLO product IDs
 * @param now - Comparison timestamp
 * @returns The single action sync should apply
 */
export function decideSyncAction(
  dbState: SyncDbState,
  tcCustomer: ThriveCartApiCustomer | null,
  recentWebhook: boolean,
  productIds: readonly number[],
  now: Date = new Date()
): SyncAction {
  const tcSub = findMyloApiSubscription(tcCustomer, productIds);

  if (tcSub && isActiveStatus(tcSub.status)) {
    const needsReactivate =
      !dbState.isActive ||
      dbState.subStatus !== 'active' ||
      dbState.currentPeriodEnd <= now;

    if (needsReactivate) {
      return { type: 'reactivate', nextPaymentDate: tcSub.nextPaymentDate };
    }

    const tcPeriodEnd = parseApiDate(tcSub.nextPaymentDate);
    if (tcPeriodEnd && tcPeriodEnd > dbState.currentPeriodEnd) {
      return { type: 'extend_period', nextPaymentDate: tcSub.nextPaymentDate };
    }

    return { type: 'touch_synced' };
  }

  if (recentWebhook) {
    return { type: 'skip_recent_webhook' };
  }

  if (tcSub && isCancelledStatus(tcSub.status)) {
    if (dbState.subStatus === 'active' && !dbState.cancelAtPeriodEnd) {
      return { type: 'mark_cancelled', reason: 'tc_cancelled' };
    }
    return { type: 'none' };
  }

  if (dbState.subStatus === 'active' && !dbState.cancelAtPeriodEnd) {
    return { type: 'mark_cancelled', reason: 'no_subscription' };
  }

  return { type: 'none' };
}

/**
 * Resolves the period end to write when reactivating or extending from ThriveCart.
 *
 * @param nextPaymentDate - ThriveCart next_payment_date string
 * @param now - Fallback start when the date is missing
 * @returns Period end date
 */
export function resolvePeriodEndFromThriveCart(
  nextPaymentDate: string | undefined,
  now: Date = new Date()
): Date {
  const parsed = parseApiDate(nextPaymentDate);
  if (parsed && parsed > now) {
    return parsed;
  }

  const fallback = new Date(now);
  fallback.setMonth(fallback.getMonth() + 1);
  return fallback;
}

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

function isCancelledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled';
}

function parseApiDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesProductId(
  productId: number | string | null | undefined,
  productIds: readonly number[]
): boolean {
  const n = Number(productId);
  if (!Number.isFinite(n)) return false;
  return productIds.includes(n);
}

function collectFromPurchases(
  purchases: ThriveCartApiPurchase[] | undefined,
  productIds: readonly number[]
): FoundMyloApiSubscription[] {
  if (!purchases) {
    return [];
  }

  const found: FoundMyloApiSubscription[] = [];
  for (const purchase of purchases) {
    if (!matchesProductId(purchase.product_id, productIds) || !purchase.subscription) {
      continue;
    }

    found.push({
      status: purchase.subscription.status,
      productId: Number(purchase.product_id),
      nextPaymentDate:
        purchase.subscription.next_payment_date ?? purchase.subscription.last_payment_date,
      lastPaymentDate: purchase.subscription.last_payment_date,
      subscriptionId: purchase.subscription.id,
      source: 'purchases',
    });
  }
  return found;
}

function collectFromSubscriptions(
  subscriptions: ThriveCartApiSubscription[] | undefined,
  productIds: readonly number[]
): FoundMyloApiSubscription[] {
  if (!subscriptions) {
    return [];
  }

  const found: FoundMyloApiSubscription[] = [];
  for (const sub of subscriptions) {
    const productId = sub.item_id ?? sub.product_id;
    if (!matchesProductId(productId, productIds)) {
      continue;
    }

    found.push({
      status: sub.status,
      productId: Number(productId),
      nextPaymentDate: sub.next_payment_date ?? sub.next_payment,
      lastPaymentDate: sub.last_payment_date ?? sub.last_payment,
      subscriptionId: sub.id,
      source: 'subscriptions',
    });
  }
  return found;
}
