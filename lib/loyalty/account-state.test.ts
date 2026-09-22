import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyLoyaltyAccount, countStaleAccounts, type LoyaltyAccountStateInput } from './account-state';

const now = new Date('2026-09-22T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const account: LoyaltyAccountStateInput = {
  balance: 12000,
  syncErrorCode: 1,
  lastRetrievedAt: daysAgo(1),
};

describe('classifyLoyaltyAccount', () => {
  for (const code of [0, 1, 9]) {
    it(`accepts successful or never-run update code ${code}`, () => {
      assert.deepEqual(classifyLoyaltyAccount({ ...account, syncErrorCode: code }, now), { kind: 'current' });
    });
  }

  for (const code of [2, 7, 8, 10]) {
    it(`prioritizes repair code ${code} over stale or missing balances`, () => {
      for (const balance of [12000, null]) {
        assert.deepEqual(
          classifyLoyaltyAccount({ balance, syncErrorCode: code, lastRetrievedAt: daysAgo(194) }, now),
          { kind: 'needs_repair', code },
        );
      }
    });
  }

  for (const code of [3, 4, 5, 6, 11, 42]) {
    it(`prioritizes retry code ${code} over stale or missing balances`, () => {
      for (const balance of [12000, null]) {
        assert.deepEqual(
          classifyLoyaltyAccount({ balance, syncErrorCode: code, lastRetrievedAt: daysAgo(194) }, now),
          { kind: 'read_failed', code },
        );
      }
    });
  }

  it('treats a missing balance without an update error as no_balance', () => {
    assert.deepEqual(
      classifyLoyaltyAccount({ ...account, balance: null, lastRetrievedAt: daysAgo(194) }, now),
      { kind: 'no_balance' },
    );
    assert.deepEqual(
      classifyLoyaltyAccount({ balance: null, syncErrorCode: null, lastRetrievedAt: null }, now),
      { kind: 'no_balance' },
    );
  });

  it('does not mark never-read or hand-typed balances stale', () => {
    assert.deepEqual(classifyLoyaltyAccount({ ...account, lastRetrievedAt: null }, now), { kind: 'current' });
  });

  it('keeps a balance current at 89 whole days', () => {
    assert.deepEqual(classifyLoyaltyAccount({ ...account, lastRetrievedAt: daysAgo(89.99) }, now), { kind: 'current' });
  });

  it('marks a balance stale at exactly 90 days', () => {
    assert.deepEqual(
      classifyLoyaltyAccount({ ...account, lastRetrievedAt: daysAgo(90) }, now),
      { kind: 'stale', days: 90 },
    );
  });

  it('reports only whole days for a stale zero balance', () => {
    assert.deepEqual(
      classifyLoyaltyAccount({ ...account, balance: 0, lastRetrievedAt: daysAgo(194.75) }, now),
      { kind: 'stale', days: 194 },
    );
  });

  it('classifies legacy rows with null error codes by their balance age', () => {
    assert.deepEqual(classifyLoyaltyAccount({ ...account, syncErrorCode: null }, now), { kind: 'current' });
    assert.deepEqual(
      classifyLoyaltyAccount({ ...account, syncErrorCode: null, lastRetrievedAt: daysAgo(90) }, now),
      { kind: 'stale', days: 90 },
    );
  });

  it('does not mark future read timestamps stale', () => {
    assert.deepEqual(classifyLoyaltyAccount({ ...account, lastRetrievedAt: daysAgo(-1) }, now), { kind: 'current' });
  });
});

describe('countStaleAccounts', () => {
  it('counts only stale balances in a mixed list', () => {
    assert.equal(countStaleAccounts([
      { kind: 'current' },
      { kind: 'stale', days: 90 },
      { kind: 'no_balance' },
      { kind: 'needs_repair', code: 2 },
      { kind: 'read_failed', code: 42 },
      { kind: 'stale', days: 194 },
    ]), 2);
  });

  it('returns zero for an empty list', () => {
    assert.equal(countStaleAccounts([]), 0);
  });
});
