import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUserAccessState } from './access-audit-utils';

describe('evaluateUserAccessState', () => {
  const now = new Date('2026-02-19T12:00:00.000Z');

  it('returns account_inactive for deactivated users', () => {
    const result = evaluateUserAccessState(
      {
        isActive: false,
        activationStatus: 'suspended',
      },
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-03-19T00:00:00.000Z'),
      },
      now
    );

    assert.deepEqual(result, { hasAccess: false, reason: 'account_inactive' });
  });

  it('returns subscription_expired when period end is in the past', () => {
    const result = evaluateUserAccessState(
      {
        isActive: true,
        activationStatus: 'active',
      },
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-01-10T00:00:00.000Z'),
      },
      now
    );

    assert.deepEqual(result, { hasAccess: false, reason: 'subscription_expired' });
  });

  it('returns subscription_status_blocked for unpaid subscriptions with future end', () => {
    const result = evaluateUserAccessState(
      {
        isActive: true,
        activationStatus: 'active',
      },
      {
        status: 'unpaid',
        currentPeriodEnd: new Date('2026-03-19T00:00:00.000Z'),
      },
      now
    );

    assert.deepEqual(result, { hasAccess: false, reason: 'subscription_status_blocked' });
  });

  it('returns hasAccess true for active account and valid subscription', () => {
    const result = evaluateUserAccessState(
      {
        isActive: true,
        activationStatus: 'active',
      },
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-03-19T00:00:00.000Z'),
      },
      now
    );

    assert.deepEqual(result, { hasAccess: true });
  });
});
