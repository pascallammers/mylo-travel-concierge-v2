import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const queryUrl = new URL('./awardwallet.ts', import.meta.url).href;
const databaseUrl = new URL('../index.ts', import.meta.url).href;

function verifyQuery(script: string): void {
  // A fresh module graph keeps the real database and server environment out of these tests.
  const setup = `
    import { mock } from 'node:test';
    globalThis.queryFixture = { reads: [], rows: [], updates: [], failInsert: false };
    const fixture = globalThis.queryFixture;
    const db = {
      delete: () => ({ where: async () => { fixture.rows = []; } }),
      insert: () => ({ values: async (rows) => {
        if (fixture.failInsert) throw new Error('insert failed');
        fixture.rows = rows;
      } }),
      update: () => ({ set: (values) => ({ where: async () => { fixture.updates.push(values); } }) }),
      select: () => {
        const query = {
          from: () => query, where: () => query, orderBy: () => query,
          $withCache: async () => fixture.reads.shift(),
        };
        return query;
      },
    };
    mock.module('server-only', { defaultExport: {} });
    mock.module(${JSON.stringify(databaseUrl)}, { namedExports: { db } });
  `;
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', '--experimental-test-module-mocks',
    '--import', `data:text/javascript,${encodeURIComponent(setup)}`,
    '--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      import { getUserLoyaltyData, syncLoyaltyAccounts } from ${JSON.stringify(queryUrl)};
      const fixture = globalThis.queryFixture;
      ${script}
    `,
  ], { encoding: 'utf8', timeout: 10000 });

  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
}

describe('syncLoyaltyAccounts plan persistence', () => {
  it('stores the plan with the sync timestamp while retaining account fields and count', () => {
    verifyQuery(`
      const account = {
        awAccountId: 123, programId: 'lufthansa', providerCode: 'lufthansa',
        providerName: 'Miles & More', providerKind: 'Airlines', balance: 12000,
        balanceUnit: 'miles', balanceVerified: true, ownerName: 'Erika Mustermann',
        ownerIsConnectedUser: true, syncErrorCode: 2,
        lastRetrievedAt: new Date('2026-03-12T12:00:00Z'), eliteStatus: null,
        expirationDate: null, accountNumber: 'member-123', logoUrl: null,
      };
      const count = await syncLoyaltyAccounts('connection-123', { plan: 'free', accounts: [account] });
      assert.equal(count, 1);
      assert.deepEqual(fixture.rows, [{ connectionId: 'connection-123', ...account }]);
      assert.equal(fixture.updates.length, 1);
      assert.equal(fixture.updates[0].awPlan, 'free');
      assert.ok(fixture.updates[0].lastSyncedAt instanceof Date);
    `);
  });

  it('persists Plus or unknown plans even when no accounts are shared', () => {
    verifyQuery(`
      for (const plan of ['plus', null]) {
        assert.equal(await syncLoyaltyAccounts('connection-123', { plan, accounts: [] }), 0);
        assert.equal(fixture.updates.at(-1).awPlan, plan);
        assert.ok(fixture.updates.at(-1).lastSyncedAt instanceof Date);
      }
    `);
  });

  it('does not mark the plan or timestamp synced after an account write failure', () => {
    verifyQuery(`
      fixture.failInsert = true;
      await assert.rejects(
        syncLoyaltyAccounts('connection-123', { plan: 'plus', accounts: [{ balance: 0 }] }),
        error => error.type === 'bad_request' && error.surface === 'database',
      );
      assert.deepEqual(fixture.updates, []);
    `);
  });
});

describe('getUserLoyaltyData plan visibility', () => {
  it('exposes the saved plan for connected and errored connections', () => {
    verifyQuery(`
      for (const status of ['connected', 'error']) {
        const connection = {
          id: 'connection-123', status, awPlan: 'plus', lastSyncedAt: new Date(), errorMessage: 'Sync failed',
        };
        fixture.reads = [[connection], [{ id: 'account-123' }]];
        const data = await getUserLoyaltyData('user-123');
        assert.equal(data.awPlan, 'plus');
        assert.equal(data.connected, status === 'connected');
        assert.equal(data.status, status);
        assert.deepEqual(data.accounts, [{ id: 'account-123' }]);
      }
    `);
  });

  it('returns a null plan for absent or disconnected connections', () => {
    verifyQuery(`
      for (const connections of [[], [{ status: 'disconnected', awPlan: 'plus' }]]) {
        fixture.reads = [connections];
        const data = await getUserLoyaltyData('user-123');
        assert.equal(data.awPlan, null);
        assert.equal(data.status, 'disconnected');
        assert.deepEqual(data.accounts, []);
      }
    `);
  });
});
