/**
 * ThriveCart sends webhook payloads in two modes:
 *   1. Form-encoded — every value arrives as a string; nested fields (`customer`, `order`,
 *      `purchases`, `purchase_map`) are JSON-encoded strings that need parsing.
 *   2. JSON — numeric IDs still arrive as strings, and `purchases` is a string array of
 *      product names instead of an object array.
 *
 * This module normalizes both modes into a single typed shape so callers don't have to
 * defensively coerce at every comparison.
 */

import type { ThriveCartPurchase, ThriveCartWebhookPayload } from './types';

const NESTED_JSON_KEYS = ['customer', 'order', 'purchases', 'purchase_map'] as const;
const NUMERIC_ID_KEYS = ['order_id', 'customer_id', 'base_product', 'event_id'] as const;

/**
 * Normalize a raw ThriveCart webhook payload. Idempotent.
 */
export function normalizeThriveCartPayload(
  raw: Record<string, unknown> | ThriveCartWebhookPayload
): ThriveCartWebhookPayload {
  const p: Record<string, unknown> = { ...raw };

  for (const key of NESTED_JSON_KEYS) {
    if (typeof p[key] === 'string') {
      try {
        p[key] = JSON.parse(p[key] as string);
      } catch {
        // leave as-is when not valid JSON
      }
    }
  }

  for (const key of NUMERIC_ID_KEYS) {
    if (typeof p[key] === 'string' && p[key] !== '') {
      const n = Number(p[key]);
      if (Number.isFinite(n)) p[key] = n;
    }
  }

  p.purchases = reconstructPurchases(p);

  return p as unknown as ThriveCartWebhookPayload;
}

/**
 * Returns a purchases array of objects regardless of the shape ThriveCart sent.
 * Falls back to `order.charges` and `base_product` when `purchases` is degenerate.
 */
function reconstructPurchases(p: Record<string, unknown>): ThriveCartPurchase[] {
  const purchases = p.purchases;
  if (
    Array.isArray(purchases) &&
    purchases.length > 0 &&
    typeof purchases[0] === 'object' &&
    purchases[0] !== null
  ) {
    return purchases as ThriveCartPurchase[];
  }

  const order = p.order as { charges?: Array<Record<string, unknown>> } | undefined;
  if (Array.isArray(order?.charges) && order!.charges.length > 0) {
    return order!.charges.map(chargeToPurchase);
  }

  const baseProduct = Number(p.base_product);
  if (Number.isFinite(baseProduct)) {
    return [
      {
        product_id: baseProduct,
        product_name: typeof p.base_product_name === 'string' ? p.base_product_name : '',
        pricing_option: '',
        type: 'product',
        amount: 0,
        amount_str: '',
      },
    ];
  }

  return [];
}

function chargeToPurchase(charge: Record<string, unknown>): ThriveCartPurchase {
  const reference = charge.reference;
  const productId =
    typeof reference === 'number'
      ? reference
      : typeof reference === 'string'
        ? Number(reference)
        : 0;

  const amountRaw = charge.amount;
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? Number(amountRaw)
        : 0;

  return {
    product_id: Number.isFinite(productId) ? productId : 0,
    product_name: typeof charge.name === 'string' ? charge.name : '',
    pricing_option: '',
    type: 'product',
    amount: Number.isFinite(amount) ? amount : 0,
    amount_str: typeof charge.amount_str === 'string' ? charge.amount_str : '',
  };
}

/**
 * True if the normalized payload represents a purchase of the given product.
 * Matches `base_product` OR any `purchases[].product_id`.
 */
export function isProductPurchase(
  payload: ThriveCartWebhookPayload,
  productId: number
): boolean {
  if (Number(payload.base_product) === productId) return true;

  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  return purchases.some((p) => {
    if (!p || typeof p !== 'object') return false;
    return Number((p as { product_id?: number | string }).product_id) === productId;
  });
}
