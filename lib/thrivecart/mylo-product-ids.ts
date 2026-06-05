import { serverEnv } from '@/env/server';

/**
 * ThriveCart product IDs that grant MYLO access.
 * - 5: standalone "MYLO Miles and Travel Concierge"
 * - 1: upsell / bundle line item "MYLO - Miles & Travel Concierge"
 */
const DEFAULT_MYLO_PRODUCT_IDS = [1, 5] as const;

/**
 * Parse configured MYLO ThriveCart product IDs from environment.
 * Supports `THRIVECART_PRODUCT_IDS` (comma-separated) and legacy `THRIVECART_PRODUCT_ID`.
 *
 * @returns Sorted unique numeric product IDs.
 */
export function parseMyloProductIds(): number[] {
  const ids = new Set<number>(DEFAULT_MYLO_PRODUCT_IDS);

  const listRaw = serverEnv.THRIVECART_PRODUCT_IDS;
  if (listRaw) {
    for (const part of listRaw.split(',')) {
      const n = Number(part.trim());
      if (Number.isFinite(n)) ids.add(n);
    }
  }

  const legacy = serverEnv.THRIVECART_PRODUCT_ID;
  if (legacy) {
    const n = Number(legacy.trim());
    if (Number.isFinite(n)) ids.add(n);
  }

  return [...ids].sort((a, b) => a - b);
}

/**
 * @param productId - ThriveCart product_id or base_product value.
 * @param productIds - Optional override list (defaults to configured MYLO IDs).
 * @returns True when the id is a known MYLO product.
 */
export function isMyloProductId(
  productId: number | string | null | undefined,
  productIds: readonly number[] = parseMyloProductIds()
): boolean {
  const n = Number(productId);
  if (!Number.isFinite(n)) return false;
  return productIds.includes(n);
}

/**
 * Primary product id string for KPI / API filters (prefers standalone id 5).
 *
 * @param productIds - Optional override list.
 * @returns String product id for legacy single-id call sites.
 */
export function primaryMyloProductIdString(
  productIds: readonly number[] = parseMyloProductIds()
): string {
  if (productIds.includes(5)) return '5';
  return String(productIds[0] ?? 5);
}
