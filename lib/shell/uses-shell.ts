/**
 * Decide the binary shell rollout for navigation and deal actions (MYLO-74 changes this seam).
 * @param userId - Authenticated user ID, or no session.
 * @param isAdmin - Injected current rollout eligibility check.
 * @returns Whether the user sees the shell and its award-mask deal action.
 */
export async function usesShell(
  userId: string | null | undefined,
  isAdmin: (id: string) => Promise<boolean>,
): Promise<boolean> {
  return userId ? isAdmin(userId) : false;
}
