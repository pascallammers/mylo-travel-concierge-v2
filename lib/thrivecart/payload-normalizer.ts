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
import { isMyloProductId, parseMyloProductIds } from './mylo-product-ids';

const NESTED_JSON_KEYS = ['customer', 'order', 'purchases', 'purchase_map'] as const;
// Only product identifiers stay numeric — they're small bounded values. Other
// IDs (customer_id, order_id, event_id) can exceed Number.MAX_SAFE_INTEGER
// (ThriveCart customer IDs are 18-digit snowflakes) and lose precision when
// coerced via Number(), so they must remain strings end-to-end.
const NUMERIC_ID_KEYS = ['base_product'] as const;

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

function extractProductId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;

  const mapped = value.match(/(?:product|upsell|bump|downsell)[_-]?(\d+)/i);
  if (!mapped?.[1]) return null;
  const n = Number(mapped[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns a purchases array of objects regardless of the shape ThriveCart sent.
 * Falls back to `order.charges` and `base_product` when `purchases` is degenerate.
 */
function reconstructPurchases(p: Record<string, unknown>): ThriveCartPurchase[] {
  const purchases = p.purchases;
  let reconstructed: ThriveCartPurchase[] = [];

  if (
    Array.isArray(purchases) &&
    purchases.length > 0 &&
    typeof purchases[0] === 'object' &&
    purchases[0] !== null
  ) {
    reconstructed = purchases as ThriveCartPurchase[];
  } else {
    const order = p.order as { charges?: Array<Record<string, unknown>> } | undefined;
    if (Array.isArray(order?.charges) && order.charges.length > 0) {
      reconstructed = order.charges.map(chargeToPurchase);
    } else {
      const baseProduct = Number(p.base_product);
      if (Number.isFinite(baseProduct)) {
        reconstructed = [
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
    }
  }

  return appendSubscriptionPurchase(reconstructed, p);
}

function appendSubscriptionPurchase(
  purchases: ThriveCartPurchase[],
  p: Record<string, unknown>
): ThriveCartPurchase[] {
  const sub = p.subscription;
  if (!sub || typeof sub !== 'object') {
    return purchases;
  }

  const record = sub as Record<string, unknown>;
  const productId = extractProductId(record.id) ?? extractProductId(record.upsell_id);
  if (productId === null) {
    return purchases;
  }

  if (purchases.some((item) => Number(item.product_id) === productId)) {
    return purchases;
  }

  return [
    ...purchases,
    {
      product_id: productId,
      product_name: typeof record.name === 'string' ? record.name : '',
      pricing_option: '',
      type: record.type === 'upsell' ? 'upsell' : 'product',
      amount: Number(record.amount) || 0,
      amount_str: typeof record.amount_str === 'string' ? record.amount_str : '',
    },
  ];
}

function chargeToPurchase(charge: Record<string, unknown>): ThriveCartPurchase {
  const productId =
    extractProductId(charge.reference) ??
    extractProductId(charge.item_identifier) ??
    0;

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
 * First MYLO line item in a normalized payload (standalone or upsell).
 *
 * @param payload - Normalized ThriveCart webhook payload.
 * @param productIds - MYLO product IDs to match (defaults to configured list).
 * @returns Matching purchase line or undefined.
 */
export function findMyloPurchase(
  payload: ThriveCartWebhookPayload,
  productIds: readonly number[] = parseMyloProductIds()
): ThriveCartPurchase | undefined {
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  return purchases.find((p) => {
    if (!p || typeof p !== 'object') return false;
    return isMyloProductId(
      (p as { product_id?: number | string }).product_id,
      productIds
    );
  });
}

/**
 * True if the normalized payload represents a purchase of a MYLO product.
 * Matches `base_product` OR any `purchases[].product_id` against the given id(s).
 *
 * @param payload - Normalized ThriveCart webhook payload.
 * @param productId - Single id or list of ThriveCart product ids (defaults to configured MYLO ids).
 * @returns True when any configured MYLO product is present.
 */
export function isProductPurchase(
  payload: ThriveCartWebhookPayload,
  productId: number | readonly number[] = parseMyloProductIds()
): boolean {
  const productIds = Array.isArray(productId) ? productId : [productId];

  if (isMyloProductId(payload.base_product, productIds)) return true;

  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  if (
    purchases.some((p) => {
      if (!p || typeof p !== 'object') return false;
      return isMyloProductId(
        (p as { product_id?: number | string }).product_id,
        productIds
      );
    })
  ) {
    return true;
  }

  const subscription = payload.subscription;
  if (
    subscription &&
    (isMyloProductId(subscription.id, productIds) ||
      isMyloProductId(subscription.upsell_id, productIds))
  ) {
    return true;
  }

  const purchaseMap = payload.purchase_map;
  if (purchaseMap && typeof purchaseMap === 'object') {
    return Object.values(purchaseMap).some((value) => {
      if (typeof value !== 'string') return false;
      const id = extractProductId(value);
      return id !== null && isMyloProductId(id, productIds);
    });
  }

  return false;
}
