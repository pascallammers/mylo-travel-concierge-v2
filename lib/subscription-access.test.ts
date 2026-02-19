import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doesSubscriptionGrantAccess } from './subscription-access';

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
