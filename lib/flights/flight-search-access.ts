/**
 * Gate award searches using the current paid-product access rule, ready for module access.
 * @param userId - Authenticated user ID, or no session.
 * @param checkAccess - Injected product access check; never called for guests.
 * @returns Whether this user may spend award-search calls.
 */
export async function hasFlightSearchAccess(
  userId: string | null | undefined,
  checkAccess: (id: string) => Promise<{ hasAccess: boolean }>,
): Promise<boolean> {
  return userId ? (await checkAccess(userId)).hasAccess : false;
}
