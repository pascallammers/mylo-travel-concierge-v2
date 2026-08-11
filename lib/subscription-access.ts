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

export type AccessCheckResult = {
  hasAccess: boolean;
  reason?: 'admin' | 'active_subscription' | 'no_subscription' | 'expired_subscription' | 'inactive_user';
  subscriptionEndDate?: Date;
};

/** Account snapshot the access rules are applied to, already loaded from the database. */
export type AccountAccessSnapshot = {
  role?: string | null;
  isActive?: boolean | null;
  activationStatus?: string | null;
  /** Latest subscription of the account, or null when there is none. */
  subscription?: { status: string | null; currentPeriodEnd: Date } | null;
};

/**
 * Applies the product access rules to an account snapshot.
 *
 * Access Rules:
 * 1. Admins ALWAYS have access (bypass all checks)
 * 2. Inactive users are blocked
 * 3. Regular users need an active subscription with currentPeriodEnd > now
 *
 * @param account - Account snapshot, or null when no user record exists.
 * @param now - Comparison date.
 * @returns Access check result with reason.
 */
export function evaluateAccountAccess(account: AccountAccessSnapshot | null | undefined, now: Date): AccessCheckResult {
  if (!account) {
    return { hasAccess: false, reason: 'inactive_user' };
  }

  if (account.role === 'admin') {
    return { hasAccess: true, reason: 'admin' };
  }

  if (account.isActive === false || (account.activationStatus && account.activationStatus !== 'active')) {
    return { hasAccess: false, reason: 'inactive_user' };
  }

  const subscription = account.subscription;

  if (!subscription) {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  if (doesSubscriptionGrantAccess(subscription.status, subscription.currentPeriodEnd, now)) {
    return {
      hasAccess: true,
      reason: 'active_subscription',
      subscriptionEndDate: subscription.currentPeriodEnd,
    };
  }

  if (subscription.currentPeriodEnd <= now) {
    return {
      hasAccess: false,
      reason: 'expired_subscription',
      subscriptionEndDate: subscription.currentPeriodEnd,
    };
  }

  return {
    hasAccess: false,
    reason: 'no_subscription',
    subscriptionEndDate: subscription.currentPeriodEnd,
  };
}
