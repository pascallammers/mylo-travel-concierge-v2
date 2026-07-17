import type { ThriveCartPurchase, ThriveCartWebhookPayload } from './types';
import { findMyloPurchase, isProductPurchase, normalizeThriveCartPayload } from './payload-normalizer';

/** Computed subscription access window from ThriveCart webhook history. */
export interface SubscriptionWindow {
  periodStart: Date;
  periodEnd: Date;
  startedAt: Date;
  checkoutOrderId: string;
  rebillCount: number;
  cancelAtPeriodEnd: boolean;
}

export interface WebhookHistoryRow {
  event_type: string;
  order_id: string | null;
  processed_at: Date;
  payload: Record<string, unknown>;
}

/**
 * Parse ThriveCart `order.date` strings (e.g. "2026-04-04 05:16:42").
 *
 * @param value - Raw date string from ThriveCart
 * @returns Parsed date or null when invalid
 */
export function parseThriveCartOrderDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Add calendar months to a date (handles month-end edge cases via Date rollover).
 *
 * @param from - Start date
 * @param months - Number of months to add (default 1)
 * @returns New date
 */
export function addCalendarMonths(from: Date, months = 1): Date {
  const result = new Date(from);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Derive initial subscription window from a single `order.success` payload.
 *
 * @param payload - Normalized ThriveCart webhook payload
 * @param myloProductIds - MYLO product IDs to match
 * @returns Period start/end based on order date and optional next payment date
 */
export function deriveSubscriptionWindowFromPayload(
  payload: ThriveCartWebhookPayload,
  myloProductIds: readonly number[]
): SubscriptionWindow {
  const myloPurchase = findMyloPurchase(payload, myloProductIds);
  const periodStart =
    parseThriveCartOrderDate(payload.order?.date) ?? new Date();
  const nextPayment = parseThriveCartOrderDate(
    myloPurchase?.subscription?.next_payment_date
  );
  const periodEnd = nextPayment ?? addCalendarMonths(periodStart, 1);

  return {
    periodStart,
    periodEnd,
    startedAt: periodStart,
    checkoutOrderId: String(payload.order_id),
    rebillCount: 0,
    cancelAtPeriodEnd: false,
  };
}

/**
 * Replay MYLO-related webhook history to compute the correct access window (incl. rebills).
 *
 * @param rows - Webhook log rows sorted ascending by `processed_at`
 * @param myloProductIds - MYLO product IDs
 * @returns Window or null when no MYLO purchase exists
 */
export function computeSubscriptionWindowFromWebhookHistory(
  rows: WebhookHistoryRow[],
  myloProductIds: readonly number[]
): SubscriptionWindow | null {
  let window: SubscriptionWindow | null = null;

  const sorted = [...rows].sort(
    (a, b) => new Date(a.processed_at).getTime() - new Date(b.processed_at).getTime()
  );

  for (const row of sorted) {
    const payload = normalizeThriveCartPayload(row.payload);
    if (!isProductPurchase(payload, myloProductIds)) continue;

    if (row.event_type === 'order.success') {
      window = deriveSubscriptionWindowFromPayload(payload, myloProductIds);
      continue;
    }

    if (!window) continue;

    if (row.event_type === 'order.subscription_payment') {
      const paymentDate =
        parseThriveCartOrderDate(payload.order?.date) ??
        new Date(row.processed_at);
      const rebillEnd = addCalendarMonths(paymentDate, 1);
      if (rebillEnd > window.periodEnd) {
        window.periodEnd = rebillEnd;
      }
      window.rebillCount += 1;
      continue;
    }

    if (row.event_type === 'order.subscription_cancelled') {
      window.cancelAtPeriodEnd = true;
    }
  }

  return window;
}

/**
 * Find the latest MYLO `order.success` payload in webhook history.
 *
 * @param rows - Webhook rows (any order)
 * @param myloProductIds - MYLO product IDs
 * @returns Normalized payload or null
 */
export function findLatestMyloOrderSuccessPayload(
  rows: WebhookHistoryRow[],
  myloProductIds: readonly number[]
): ThriveCartWebhookPayload | null {
  const successes = rows
    .filter((r) => r.event_type === 'order.success')
    .sort(
      (a, b) =>
        new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime()
    );

  for (const row of successes) {
    const payload = normalizeThriveCartPayload(row.payload);
    if (isProductPurchase(payload, myloProductIds)) {
      return payload;
    }
  }

  return null;
}
