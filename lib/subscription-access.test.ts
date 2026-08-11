import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doesSubscriptionGrantAccess, evaluateAccountAccess } from './subscription-access';

describe('doesSubscriptionGrantAccess', () => {
  it('returns true for active subscription with future end date', () => {
    const now = new Date('2026-02-19T10:00:00.000Z');
    const result = doesSubscriptionGrantAccess('active', new Date('2026-03-01T00:00:00.000Z'), now);
    assert.equal(result, true);
  });

  it('returns false when subscription end date is in the past', () => {
    const now = new Date('2026-02-19T10:00:00.000Z');
    const result = doesSubscriptionGrantAccess('active', new Date('2026-01-18T00:00:00.000Z'), now);
    assert.equal(result, false);
  });

  it('returns false for blocked billing statuses even with future end date', () => {
    const now = new Date('2026-02-19T10:00:00.000Z');
    const result = doesSubscriptionGrantAccess('unpaid', new Date('2026-03-01T00:00:00.000Z'), now);
    assert.equal(result, false);
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

  it('denies a blocked billing status even while the period still runs', () => {
    assert.deepEqual(
      evaluateAccountAccess({ role: 'user', isActive: true, subscription: { status: 'unpaid', currentPeriodEnd: future } }, now),
      { hasAccess: false, reason: 'no_subscription', subscriptionEndDate: future },
    );
  });
});
