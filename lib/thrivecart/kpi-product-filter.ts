/**
 * Checks whether a stored transaction belongs to a MYLO ThriveCart product.
 * @param transaction - Stored ThriveCart product identifiers.
 * @param productIds - Product ids that should be counted for KPI reporting.
 * @returns True when the row belongs to any selected product.
 */
export function isTrackedProductTransactionForProduct(
  transaction: {
    baseProduct: string | null;
    itemId: string | null;
  },
  productIds: string | readonly string[],
): boolean {
  const ids = typeof productIds === 'string' ? [productIds] : productIds;
  return ids.some(
    (id) => transaction.baseProduct === id || transaction.itemId === id
  );
}
