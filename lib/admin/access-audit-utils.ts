import { doesSubscriptionGrantAccess } from '@/lib/subscription-access';

export type AccessAuditReason =
  | 'account_inactive'
  | 'no_subscription'
  | 'subscription_expired'
  | 'subscription_status_blocked';

export type AccessAuditUserRecord = {
  isActive: boolean | null;
  activationStatus: string | null;
};

export type LatestSubscriptionRecord = {
  status: string;
  currentPeriodEnd: Date;
};

/**
 * Evaluates whether a user should currently have product access.
 * @param userRecord - Current account activation state.
 * @param latestSubscription - Most recent subscription snapshot.
 * @param now - Comparison timestamp.
 * @returns Access decision and normalized denial reason.
 */
export function evaluateUserAccessState(
  userRecord: AccessAuditUserRecord,
  latestSubscription: LatestSubscriptionRecord | null,
  now: Date
): { hasAccess: boolean; reason?: AccessAuditReason } {
  const isAccountInactive =
    userRecord.isActive === false ||
    (userRecord.activationStatus !== null && userRecord.activationStatus !== 'active');

  if (isAccountInactive) {
    return { hasAccess: false, reason: 'account_inactive' };
  }

  if (!latestSubscription) {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  if (latestSubscription.currentPeriodEnd <= now) {
    return { hasAccess: false, reason: 'subscription_expired' };
  }

  if (!doesSubscriptionGrantAccess(latestSubscription.status, latestSubscription.currentPeriodEnd, now)) {
    return { hasAccess: false, reason: 'subscription_status_blocked' };
  }

  return { hasAccess: true };
}
