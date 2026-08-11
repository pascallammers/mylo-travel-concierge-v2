import { checkUserAccess } from '@/lib/access-control';

/**
 * Check whether a user may access Flight Deals.
 *
 * Flight Deals is part of the paid product, so the gate is the regular product
 * access check — admins and customers with a running subscription. This stays a
 * named seam because the upcoming tier structure will narrow it to a plan.
 *
 * @param userId - ID of the signed-in user, or null/undefined for a visitor.
 * @returns True when the account may use Flight Deals.
 */
export async function hasFlightDealsAccess(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  const { hasAccess } = await checkUserAccess(userId);
  return hasAccess;
}
