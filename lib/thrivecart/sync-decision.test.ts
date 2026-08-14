import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideSyncAction,
  findMyloApiSubscription,
  resolvePeriodEndFromThriveCart,
  type SyncDbState,
} from './sync-decision';
import type { ThriveCartApiCustomer } from './types';

const PRODUCT_IDS = [1, 5] as const;
const now = new Date('2026-08-14T08:00:00.000Z');

const expiredSuspended: SyncDbState = {
  isActive: false,
  subStatus: 'expired',
  currentPeriodEnd: new Date('2026-07-07T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
};

const dbActive: SyncDbState = {
  isActive: true,
  subStatus: 'active',
  currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
};

function customerWithPurchaseSub(status: string): ThriveCartApiCustomer {
  return {
    id: 'tc-1',
    email: 'user@example.com',
    name: 'User',
    purchases: [
      {
        order_id: '100',
        product_id: 5,
        product_name: 'MYLO',
        status: 'paid',
        subscription: {
          id: 'sub-1',
          status: status as 'active' | 'cancelled' | 'paused' | 'completed',
          frequency: 'month',
          next_payment_date: '2026-09-07 00:00:00',
          amount: 4700,
          currency: 'EUR',
        },
      },
    ],
  };
}

function customerWithSubscriptionsOnly(status: string): ThriveCartApiCustomer {
  return {
    id: 'tc-2',
    email: 'user@example.com',
    name: 'User',
    purchases: [
      {
        order_id: '100',
        product_id: 5,
        product_name: 'MYLO',
        status: 'paid',
      },
    ],
    subscriptions: [
      {
        status,
        item_id: 5,
        next_payment: '2026-09-15 00:00:00',
      },
    ],
  };
}

describe('findMyloApiSubscription', () => {
  it('reads nested purchases[].subscription', () => {
    const found = findMyloApiSubscription(customerWithPurchaseSub('active'), PRODUCT_IDS);
    assert.equal(found?.source, 'purchases');
    assert.equal(found?.status, 'active');
    assert.equal(found?.productId, 5);
  });

  it('reads top-level subscriptions[] when purchases have no nested subscription', () => {
    const found = findMyloApiSubscription(customerWithSubscriptionsOnly('active'), PRODUCT_IDS);
    assert.equal(found?.source, 'subscriptions');
    assert.equal(found?.status, 'active');
    assert.equal(found?.productId, 5);
  });

  it('ignores non-MYLO product ids', () => {
    const found = findMyloApiSubscription(
      {
        id: 'tc-3',
        email: 'user@example.com',
        name: 'User',
        subscriptions: [{ status: 'active', item_id: 32 }],
      },
      PRODUCT_IDS
    );
    assert.equal(found, null);
  });
});

describe('decideSyncAction', () => {
  it('reactivates when period is expired but ThriveCart purchase subscription is active', () => {
    const action = decideSyncAction(
      expiredSuspended,
      customerWithPurchaseSub('active'),
      false,
      PRODUCT_IDS,
      now
    );
    assert.equal(action.type, 'reactivate');
  });

  it('does not mark cancelled when the only TC signal is subscriptions[]', () => {
    const action = decideSyncAction(
      dbActive,
      customerWithSubscriptionsOnly('active'),
      false,
      PRODUCT_IDS,
      now
    );
    assert.notEqual(action.type, 'mark_cancelled');
    assert.equal(action.type, 'extend_period');
  });

  it('skips cancel when a recent rebill webhook exists', () => {
    const action = decideSyncAction(dbActive, null, true, PRODUCT_IDS, now);
    assert.equal(action.type, 'skip_recent_webhook');
  });

  it('marks cancelled when ThriveCart has no MYLO subscription and no recent webhook', () => {
    const action = decideSyncAction(
      dbActive,
      { id: 'tc-4', email: 'user@example.com', name: 'User', purchases: [] },
      false,
      PRODUCT_IDS,
      now
    );
    assert.deepEqual(action, { type: 'mark_cancelled', reason: 'no_subscription' });
  });

  it('marks cancelled when ThriveCart reports cancelled', () => {
    const action = decideSyncAction(
      dbActive,
      customerWithPurchaseSub('cancelled'),
      false,
      PRODUCT_IDS,
      now
    );
    assert.deepEqual(action, { type: 'mark_cancelled', reason: 'tc_cancelled' });
  });
});

describe('resolvePeriodEndFromThriveCart', () => {
  it('uses a future next_payment_date', () => {
    const end = resolvePeriodEndFromThriveCart('2026-09-07 00:00:00', now);
    assert.equal(end.toISOString().slice(0, 10), '2026-09-07');
  });

  it('falls back to now plus one month when the date is missing', () => {
    const end = resolvePeriodEndFromThriveCart(undefined, now);
    assert.equal(end.toISOString().slice(0, 10), '2026-09-14');
  });
});
