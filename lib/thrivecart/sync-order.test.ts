import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { orderUsersForSync, type SyncCandidate } from './sync-order';

const now = new Date('2026-09-05T20:00:00.000Z');

function candidate(overrides: Partial<SyncCandidate> & { userId: string }): SyncCandidate {
  return {
    isActive: true,
    subStatus: 'active',
    currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
    lastSyncedAt: null,
    ...overrides,
  };
}

describe('orderUsersForSync', () => {
  it('puts active users with an expired or non-active subscription first', () => {
    const ordered = orderUsersForSync(
      [
        candidate({ userId: 'fresh', lastSyncedAt: null }),
        candidate({ userId: 'active-expired', currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z') }),
        candidate({ userId: 'active-past-due', subStatus: 'past_due' }),
      ],
      now,
    );

    assert.deepEqual(
      ordered.map((u) => u.userId),
      ['active-expired', 'active-past-due', 'fresh'],
    );
  });

  it('does not prioritise inactive users, they are a steady state', () => {
    const ordered = orderUsersForSync(
      [
        candidate({ userId: 'inactive-old', isActive: false, subStatus: 'canceled', lastSyncedAt: new Date('2026-09-01T00:00:00.000Z') }),
        candidate({ userId: 'active-never-synced' }),
      ],
      now,
    );

    assert.deepEqual(ordered.map((u) => u.userId), ['active-never-synced', 'inactive-old']);
  });

  it('visits never-synced users before stale ones and stale before recent ones', () => {
    const ordered = orderUsersForSync(
      [
        candidate({ userId: 'recent', lastSyncedAt: new Date('2026-09-05T12:00:00.000Z') }),
        candidate({ userId: 'stale', lastSyncedAt: new Date('2026-06-01T00:00:00.000Z') }),
        candidate({ userId: 'never' }),
      ],
      now,
    );

    assert.deepEqual(ordered.map((u) => u.userId), ['never', 'stale', 'recent']);
  });

  it('keeps one row per user, the one with the latest period end', () => {
    const ordered = orderUsersForSync(
      [
        candidate({ userId: 'u1', subStatus: 'canceled', currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z') }),
        candidate({ userId: 'u1', currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z') }),
      ],
      now,
    );

    assert.equal(ordered.length, 1);
    assert.equal(ordered[0].currentPeriodEnd.toISOString(), '2026-12-01T00:00:00.000Z');
  });
});
