const BLOCKED_SUBSCRIPTION_STATUSES = new Set(['incomplete', 'incomplete_expired', 'unpaid']);

/** The columns of a subscription row that decide when its product access ends. */
export type AccessWindow = {
  status: string | null | undefined;
  /** End date of the current paid period. */
  currentPeriodEnd: Date | null | undefined;
  /** Written on a failed rebill: the paid period may already be over, access still runs until here. */
  gracePeriodEnd?: Date | null;
};

/**
 * Returns the moment product access from this subscription ends.
 * A `past_due` subscription keeps access until its grace period runs out, even when the
 * paid period has already ended; every other status ends with the paid period.
 * @param sub - Subscription columns relevant for access.
 * @returns The access end date, or null when the row has no period at all.
 */
export function accessEndsAt(sub: AccessWindow): Date | null {
  if (!sub.currentPeriodEnd) {
    return null;
  }

  if (sub.status === 'past_due' && sub.gracePeriodEnd && sub.gracePeriodEnd > sub.currentPeriodEnd) {
    return sub.gracePeriodEnd;
  }

  return sub.currentPeriodEnd;
}

/**
 * Checks if a subscription record currently grants product access.
 * @param sub - Subscription columns relevant for access.
 * @param now - Comparison date.
 * @returns True when the subscription should grant access right now.
 */
export function doesSubscriptionGrantAccess(sub: AccessWindow | null | undefined, now: Date): boolean {
  if (!sub) {
    return false;
  }

  const endsAt = accessEndsAt(sub);
  if (!endsAt) {
    return false;
  }

  if (endsAt <= now) {
    return false;
  }

  if (sub.status && BLOCKED_SUBSCRIPTION_STATUSES.has(sub.status)) {
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
  subscription?: (AccessWindow & { currentPeriodEnd: Date }) | null;
};

/**
 * Applies the product access rules to an account snapshot.
 *
 * Access Rules:
 * 1. Admins ALWAYS have access (bypass all checks)
 * 2. Inactive users are blocked
 * 3. Regular users need a subscription whose access window (paid period, or grace period
 *    after a failed rebill) is still open
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

  const endsAt = accessEndsAt(subscription) ?? subscription.currentPeriodEnd;

  if (doesSubscriptionGrantAccess(subscription, now)) {
    return {
      hasAccess: true,
      reason: 'active_subscription',
      subscriptionEndDate: endsAt,
    };
  }

  if (endsAt <= now) {
    return {
      hasAccess: false,
      reason: 'expired_subscription',
      subscriptionEndDate: endsAt,
    };
  }

  return {
    hasAccess: false,
    reason: 'no_subscription',
    subscriptionEndDate: endsAt,
  };
}
