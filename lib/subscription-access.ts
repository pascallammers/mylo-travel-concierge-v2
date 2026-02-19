const BLOCKED_SUBSCRIPTION_STATUSES = new Set(['incomplete', 'incomplete_expired', 'unpaid']);

/**
 * Checks if a subscription record currently grants product access.
 * @param subscriptionStatus - The provider status stored on the subscription.
 * @param periodEnd - End date of the current paid period.
 * @param now - Comparison date.
 * @returns True when the subscription should grant access right now.
 */
export function doesSubscriptionGrantAccess(
  subscriptionStatus: string | null | undefined,
  periodEnd: Date | null | undefined,
  now: Date
): boolean {
  if (!periodEnd) {
    return false;
  }

  if (periodEnd <= now) {
    return false;
  }

  if (subscriptionStatus && BLOCKED_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return false;
  }

  return true;
}
