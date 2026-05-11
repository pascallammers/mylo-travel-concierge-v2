/**
 * Checks whether a stored transaction belongs to the selected ThriveCart product.
 * @param transaction - Stored ThriveCart product identifiers.
 * @param productId - Product id that should be counted for KPI reporting.
 * @returns True when the row belongs to the selected product.
 */
export function isTrackedProductTransactionForProduct(
  transaction: {
    baseProduct: string | null;
    itemId: string | null;
  },
  productId: string,
): boolean {
  return transaction.baseProduct === productId || transaction.itemId === productId;
}
