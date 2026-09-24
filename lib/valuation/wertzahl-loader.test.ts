import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LoyaltyAccount, UserLoyaltyData } from '../db/queries/awardwallet';
import { ChatSDKError } from '../errors';
import { seedRows } from './seeds';
import { buildValuationTable } from './table';
import { loadRailWertzahl } from './wertzahl-loader';

const today = new Date('2026-09-24T12:00:00Z');
const table = buildValuationTable(seedRows(), today);
const deps = { loadTable: async () => table, now: () => today };

function loyalty(status: UserLoyaltyData['status'], accounts: LoyaltyAccount[] = []): UserLoyaltyData {
  return { status, connected: status === 'connected', awPlan: null, lastSyncedAt: null, lastError: null, accounts };
}

test('a loyalty database failure logs its cause and returns unavailable without rejecting', async (t) => {
  const error = new ChatSDKError('bad_request:database', 'Failed to get user loyalty data');
  const log = t.mock.method(console, 'error', () => {});
  const result = await loadRailWertzahl('user-70', {
    ...deps,
    loadLoyalty: async () => {
      throw error;
    },
  });
  assert.deepEqual(result, { kind: 'unavailable' });
  assert.equal(log.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[0], /^\[Wertzahl\]/);
  assert.equal(log.mock.calls[0].arguments[1], error);
});

test('disconnected maps to not_connected and passes the authenticated user ID to the query', async () => {
  let requestedUser: string | undefined;
  const result = await loadRailWertzahl('user-70', {
    ...deps,
    loadLoyalty: async (userId) => {
      requestedUser = userId;
      return loyalty('disconnected');
    },
  });
  assert.equal(requestedUser, 'user-70');
  assert.deepEqual(result, { kind: 'not_connected' });
});

test('connected with no accounts remains no_rateable_account', async () => {
  assert.deepEqual(
    await loadRailWertzahl('user-70', {
      ...deps,
      loadLoyalty: async () => loyalty('connected'),
    }),
    { kind: 'no_rateable_account', unreadableCount: 0, totalAccounts: 0 },
  );
});

test('a sync-error connection keeps its last known balances despite legacy connected being false', async () => {
  const account: LoyaltyAccount = {
    id: 'account-70',
    connectionId: 'connection-70',
    awAccountId: 70,
    programId: 'lufthansa',
    providerCode: 'lufthansa',
    providerName: 'Miles & More',
    providerKind: 'Airlines',
    balance: 100_000,
    balanceUnit: 'miles',
    balanceVerified: false,
    ownerName: 'Other owner',
    ownerIsConnectedUser: false,
    syncErrorCode: 2,
    lastRetrievedAt: new Date('2020-01-01'),
    eliteStatus: null,
    expirationDate: null,
    accountNumber: null,
    logoUrl: null,
    updatedAt: today,
    createdAt: today,
  };
  const result = await loadRailWertzahl('user-70', {
    ...deps,
    loadLoyalty: async () => loyalty('error', [account]),
  });
  assert.deepEqual(result, {
    kind: 'value',
    travelEur: 1700,
    noPlan: { eur: 300, coveredPrograms: 1, totalPrograms: 1 },
    ratedAccounts: 1,
    totalAccounts: 1,
    unreadableCount: 0,
    programs: [{ programId: 'lufthansa', name: 'Miles & More', travelEur: 1700 }],
  });
});

test('an unexpected table failure also stays inside the layout boundary', async (t) => {
  const error = new Error('Snapshot unavailable');
  const log = t.mock.method(console, 'error', () => {});
  const result = await loadRailWertzahl('user-70', {
    ...deps,
    loadLoyalty: async () => loyalty('connected'),
    loadTable: async () => {
      throw error;
    },
  });
  assert.deepEqual(result, { kind: 'unavailable' });
  assert.equal(log.mock.calls[0].arguments[1], error);
});
