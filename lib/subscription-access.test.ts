import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { accessEndsAt, doesSubscriptionGrantAccess, evaluateAccountAccess } from './subscription-access';

describe('accessEndsAt', () => {
  const periodEnd = new Date('2026-02-18T00:00:00.000Z');
  const graceEnd = new Date('2026-02-25T00:00:00.000Z');

  it('ends with the paid period for an active subscription', () => {
    assert.equal(accessEndsAt({ status: 'active', currentPeriodEnd: periodEnd, gracePeriodEnd: graceEnd }), periodEnd);
  });

  it('extends a past_due subscription to the end of its grace period', () => {
    assert.equal(accessEndsAt({ status: 'past_due', currentPeriodEnd: periodEnd, gracePeriodEnd: graceEnd }), graceEnd);
  });

  it('keeps the paid period when the grace period ends earlier', () => {
    const earlierGrace = new Date('2026-02-10T00:00:00.000Z');
    assert.equal(accessEndsAt({ status: 'past_due', currentPeriodEnd: periodEnd, gracePeriodEnd: earlierGrace }), periodEnd);
  });

  it('ignores a grace period on statuses other than past_due', () => {
    assert.equal(accessEndsAt({ status: 'expired', currentPeriodEnd: periodEnd, gracePeriodEnd: graceEnd }), periodEnd);
  });

  it('returns null without a period end', () => {
    assert.equal(accessEndsAt({ status: 'past_due', currentPeriodEnd: null, gracePeriodEnd: graceEnd }), null);
  });
});

describe('doesSubscriptionGrantAccess', () => {
  const now = new Date('2026-02-19T10:00:00.000Z');

  it('returns true for active subscription with future end date', () => {
    const result = doesSubscriptionGrantAccess({ status: 'active', currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z') }, now);
    assert.equal(result, true);
  });

  it('returns false when subscription end date is in the past', () => {
    const result = doesSubscriptionGrantAccess({ status: 'active', currentPeriodEnd: new Date('2026-01-18T00:00:00.000Z') }, now);
    assert.equal(result, false);
  });

  it('returns false for blocked billing statuses even with future end date', () => {
    const result = doesSubscriptionGrantAccess({ status: 'unpaid', currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z') }, now);
    assert.equal(result, false);
  });

  it('returns false for a missing row', () => {
    assert.equal(doesSubscriptionGrantAccess(null, now), false);
  });

  it('keeps a past_due subscription open while its grace period runs', () => {
    const sub = {
      status: 'past_due',
      currentPeriodEnd: new Date('2026-02-18T00:00:00.000Z'),
      gracePeriodEnd: new Date('2026-02-25T00:00:00.000Z'),
    };
    assert.equal(doesSubscriptionGrantAccess(sub, now), true);
    assert.equal(doesSubscriptionGrantAccess(sub, new Date('2026-02-25T00:00:00.001Z')), false);
  });

  it('closes a past_due subscription without a grace period at the paid period end', () => {
    const sub = { status: 'past_due', currentPeriodEnd: new Date('2026-02-18T00:00:00.000Z'), gracePeriodEnd: null };
    assert.equal(doesSubscriptionGrantAccess(sub, now), false);
  });
});

describe('evaluateAccountAccess', () => {
  const now = new Date('2026-02-19T10:00:00.000Z');
  const future = new Date('2026-03-01T00:00:00.000Z');
  const past = new Date('2026-01-18T00:00:00.000Z');

  it('denies unknown accounts', () => {
    assert.deepEqual(evaluateAccountAccess(null, now), { hasAccess: false, reason: 'inactive_user' });
  });

  it('grants admins access without looking at their subscription', () => {
    const result = evaluateAccountAccess({ role: 'admin', isActive: false, subscription: null }, now);
    assert.deepEqual(result, { hasAccess: true, reason: 'admin' });
  });

  it('denies deactivated accounts', () => {
    assert.deepEqual(
      evaluateAccountAccess({ role: 'user', isActive: false, subscription: { status: 'active', currentPeriodEnd: future } }, now),
      { hasAccess: false, reason: 'inactive_user' },
    );
    assert.deepEqual(
      evaluateAccountAccess(
        { role: 'user', activationStatus: 'pending', subscription: { status: 'active', currentPeriodEnd: future } },
        now,
      ),
      { hasAccess: false, reason: 'inactive_user' },
    );
  });

  it('grants access on a running subscription and reports its end date', () => {
    assert.deepEqual(
      evaluateAccountAccess({ role: 'user', isActive: true, subscription: { status: 'active', currentPeriodEnd: future } }, now),
      { hasAccess: true, reason: 'active_subscription', subscriptionEndDate: future },
    );
  });

  it('denies accounts without any subscription', () => {
    assert.deepEqual(evaluateAccountAccess({ role: 'user', isActive: true, subscription: null }, now), {
      hasAccess: false,
      reason: 'no_subscription',
    });
  });

  it('reports an expired subscription separately from a never-started one', () => {
    assert.deepEqual(
      evaluateAccountAccess({ role: 'user', isActive: true, subscription: { status: 'active', currentPeriodEnd: past } }, now),
      { hasAccess: false, reason: 'expired_subscription', subscriptionEndDate: past },
    );
  });

  it('grants access during the grace period after a failed rebill and reports its end', () => {
    const graceEnd = new Date('2026-02-25T00:00:00.000Z');
    assert.deepEqual(
      evaluateAccountAccess(
        { role: 'user', isActive: true, subscription: { status: 'past_due', currentPeriodEnd: past, gracePeriodEnd: graceEnd } },
        now,
      ),
      { hasAccess: true, reason: 'active_subscription', subscriptionEndDate: graceEnd },
    );
  });

  it('reports an expired grace period as an expired subscription', () => {
    const graceEnd = new Date('2026-02-01T00:00:00.000Z');
    assert.deepEqual(
      evaluateAccountAccess(
        { role: 'user', isActive: true, subscription: { status: 'past_due', currentPeriodEnd: past, gracePeriodEnd: graceEnd } },
        now,
      ),
      { hasAccess: false, reason: 'expired_subscription', subscriptionEndDate: graceEnd },
    );
  });

  it('denies a blocked billing status even while the period still runs', () => {
    assert.deepEqual(
      evaluateAccountAccess({ role: 'user', isActive: true, subscription: { status: 'unpaid', currentPeriodEnd: future } }, now),
      { hasAccess: false, reason: 'no_subscription', subscriptionEndDate: future },
    );
  });
});
