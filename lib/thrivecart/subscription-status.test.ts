import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  determineSubscriptionStatus,
  pickLatestSubscription,
} from './subscription-status';

const now = new Date('2026-08-14T08:00:00.000Z');

describe('determineSubscriptionStatus', () => {
  it('returns none when there is no subscription', () => {
    const result = determineSubscriptionStatus(null, now);
    assert.deepEqual(result, { status: 'none', validUntil: null });
  });

  it('returns active when status is active and period is in the future', () => {
    const result = determineSubscriptionStatus(
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      now
    );
    assert.equal(result.status, 'active');
    assert.equal(result.validUntil, '2026-09-01T00:00:00.000Z');
  });

  it('returns cancelled when cancelAtPeriodEnd is set', () => {
    const result = determineSubscriptionStatus(
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        cancelAtPeriodEnd: true,
      },
      now
    );
    assert.equal(result.status, 'cancelled');
    assert.equal(result.validUntil, '2026-07-01T00:00:00.000Z');
  });

  it('returns inactive when period ended and not flagged cancelled', () => {
    const result = determineSubscriptionStatus(
      {
        status: 'expired',
        currentPeriodEnd: new Date('2026-07-07T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      now
    );
    assert.deepEqual(result, { status: 'inactive', validUntil: null });
  });

  it('returns inactive when status is canceled', () => {
    const result = determineSubscriptionStatus(
      {
        status: 'canceled',
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      now
    );
    assert.deepEqual(result, { status: 'inactive', validUntil: null });
  });
});

describe('pickLatestSubscription', () => {
  it('returns null for an empty list', () => {
    assert.equal(pickLatestSubscription([]), null);
  });

  it('does not let a newer expired row hide an older still-valid period', () => {
    const olderValid = {
      id: 'valid',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    };
    const newerExpired = {
      id: 'expired',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-07-15T00:00:00.000Z'),
    };

    const picked = pickLatestSubscription([newerExpired, olderValid]);
    assert.equal(picked?.id, 'valid');
  });
});
