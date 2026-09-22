import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { ChatSDKError } from '@/lib/errors';
import type { AWLoyaltyAccount } from '@/lib/api/awardwallet-client';

interface Fixture {
  rows: unknown[];
  updates: Record<string, unknown>[];
  reads: unknown[][];
  failInsert: boolean;
}

const fixture: Fixture = { rows: [], updates: [], reads: [], failInsert: false };

const db = {
  delete: () => ({
    where: async () => {
      fixture.rows = [];
    },
  }),
  insert: () => ({
    values: async (rows: unknown[]) => {
      if (fixture.failInsert) throw new Error('insert failed');
      fixture.rows = rows;
    },
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        fixture.updates.push(values);
      },
    }),
  }),
  select: () => {
    const query = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      $withCache: async () => fixture.reads.shift() ?? [],
    };
    return query;
  },
};

mock.module('server-only', { defaultExport: {} });
mock.module(new URL('../index.ts', import.meta.url).href, { namedExports: { db } });

const { getUserLoyaltyData, syncLoyaltyAccounts } = await import('./awardwallet');

const account: AWLoyaltyAccount = {
  awAccountId: 123,
  programId: 'lufthansa',
  providerCode: 'lufthansa',
  providerName: 'Miles & More',
  providerKind: 'Airlines',
  balance: 12000,
  balanceUnit: 'miles',
  balanceVerified: true,
  ownerName: 'Erika Mustermann',
  ownerIsConnectedUser: true,
  syncErrorCode: 2,
  lastRetrievedAt: new Date('2026-03-12T12:00:00Z'),
  eliteStatus: null,
  expirationDate: null,
  accountNumber: 'member-123',
  logoUrl: null,
};

beforeEach(() => {
  fixture.rows = [];
  fixture.updates = [];
  fixture.reads = [];
  fixture.failInsert = false;
});

describe('syncLoyaltyAccounts', () => {
  it('stores the plan with the sync timestamp and keeps the account rows intact', async () => {
    const count = await syncLoyaltyAccounts('connection-123', { plan: 'free', accounts: [account] });

    assert.equal(count, 1);
    assert.deepEqual(fixture.rows, [{ connectionId: 'connection-123', ...account }]);
    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].awPlan, 'free');
    assert.ok(fixture.updates[0].lastSyncedAt instanceof Date);
  });

  it('persists a Plus or unknown plan even when no accounts are shared', async () => {
    for (const plan of ['plus', null] as const) {
      assert.equal(await syncLoyaltyAccounts('connection-123', { plan, accounts: [] }), 0);
      assert.equal(fixture.updates.at(-1)?.awPlan, plan);
    }
  });

  it('does not stamp the plan or timestamp when the account write fails', async () => {
    fixture.failInsert = true;

    await assert.rejects(
      syncLoyaltyAccounts('connection-123', { plan: 'plus', accounts: [account] }),
      (error: unknown) => error instanceof ChatSDKError && error.surface === 'database',
    );
    assert.deepEqual(fixture.updates, []);
  });
});

describe('getUserLoyaltyData', () => {
  it('exposes the saved plan for connected and errored connections', async () => {
    for (const status of ['connected', 'error'] as const) {
      const connection = {
        id: 'connection-123',
        status,
        awPlan: 'plus',
        lastSyncedAt: new Date(),
        errorMessage: 'Sync failed',
      };
      fixture.reads = [[connection], [{ id: 'account-123' }]];

      const data = await getUserLoyaltyData('user-123');

      assert.equal(data.awPlan, 'plus');
      assert.equal(data.status, status);
      assert.deepEqual(data.accounts, [{ id: 'account-123' }]);
    }
  });

  it('returns a null plan for absent or disconnected connections', async () => {
    for (const connections of [[], [{ status: 'disconnected', awPlan: 'plus' }]]) {
      fixture.reads = [connections];

      const data = await getUserLoyaltyData('user-123');

      assert.equal(data.awPlan, null);
      assert.equal(data.status, 'disconnected');
      assert.deepEqual(data.accounts, []);
    }
  });
});
