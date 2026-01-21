import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLoyaltyResponse,
  type LoyaltyBalancesResponse,
  type LoyaltyAccount,
  type UserLoyaltyData,
} from './loyalty-balances-utils';

// ============================================
// Test Utilities
// ============================================

/**
 * Creates a mock LoyaltyAccount for testing
 */
function createMockAccount(overrides: Partial<LoyaltyAccount> = {}): LoyaltyAccount {
  const defaults: LoyaltyAccount = {
    id: 'account-1',
    connectionId: 'conn-1',
    providerCode: 'LH',
    providerName: 'Lufthansa Miles & More',
    balance: 50000,
    balanceUnit: 'miles',
    eliteStatus: 'Senator',
    expirationDate: new Date('2025-12-31'),
    accountNumber: '1234567890',
    logoUrl: 'https://example.com/lh.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Creates connected UserLoyaltyData for testing
 */
function createConnectedUserData(accounts: LoyaltyAccount[]): UserLoyaltyData {
  return {
    connected: true,
    lastSyncedAt: new Date('2026-01-20T10:00:00Z'),
    accounts,
  };
}

/**
 * Creates disconnected UserLoyaltyData for testing
 */
function createDisconnectedUserData(): UserLoyaltyData {
  return {
    connected: false,
    lastSyncedAt: null,
    accounts: [],
  };
}

// ============================================
// Tests
// ============================================

describe('formatLoyaltyResponse', () => {
  describe('Disconnected User', () => {
    it('returns empty response for disconnected user', () => {
      const data = createDisconnectedUserData();
      const result = formatLoyaltyResponse(data);

      assert.equal(result.connected, false);
      assert.equal(result.lastSyncedAt, null);
      assert.equal(result.totalPoints, 0);
      assert.equal(result.accountCount, 0);
      assert.deepEqual(result.accounts, []);
    });

    it('ignores provider filter for disconnected user', () => {
      const data = createDisconnectedUserData();
      const result = formatLoyaltyResponse(data, 'lufthansa');

      assert.equal(result.connected, false);
      assert.equal(result.accountCount, 0);
    });

    it('ignores includeDetails for disconnected user', () => {
      const data = createDisconnectedUserData();
      const result = formatLoyaltyResponse(data, undefined, true);

      assert.equal(result.connected, false);
      assert.deepEqual(result.accounts, []);
    });
  });

  describe('Connected User with Accounts', () => {
    it('returns full response for connected user', () => {
      const accounts = [
        createMockAccount({ balance: 50000, providerName: 'Lufthansa Miles & More' }),
        createMockAccount({
          id: 'account-2',
          providerCode: 'UA',
          providerName: 'United MileagePlus',
          balance: 30000,
        }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.connected, true);
      assert.equal(result.totalPoints, 80000);
      assert.equal(result.accountCount, 2);
      assert.equal(result.accounts.length, 2);
    });

    it('formats lastSyncedAt as ISO string', () => {
      const accounts = [createMockAccount()];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.lastSyncedAt, '2026-01-20T10:00:00.000Z');
    });

    it('calculates total points across all accounts', () => {
      const accounts = [
        createMockAccount({ balance: 10000 }),
        createMockAccount({ id: 'acc-2', balance: 25000 }),
        createMockAccount({ id: 'acc-3', balance: 5000 }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.totalPoints, 40000);
    });

    it('handles zero balance accounts', () => {
      const accounts = [
        createMockAccount({ balance: 0 }),
        createMockAccount({ id: 'acc-2', balance: 1000 }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.totalPoints, 1000);
      assert.equal(result.accountCount, 2);
    });
  });

  describe('Account Formatting', () => {
    it('formats account with all fields', () => {
      const account = createMockAccount({
        providerCode: 'LH',
        providerName: 'Lufthansa Miles & More',
        balance: 75000,
        balanceUnit: 'miles',
        eliteStatus: 'Senator',
        expirationDate: new Date('2025-12-31T00:00:00Z'),
        accountNumber: '123456789',
        logoUrl: 'https://example.com/logo.png',
      });
      const data = createConnectedUserData([account]);

      const result = formatLoyaltyResponse(data);
      const formattedAccount = result.accounts[0];

      assert.equal(formattedAccount.providerCode, 'LH');
      assert.equal(formattedAccount.providerName, 'Lufthansa Miles & More');
      assert.equal(formattedAccount.balance, 75000);
      assert.equal(formattedAccount.balanceUnit, 'miles');
      assert.equal(formattedAccount.eliteStatus, 'Senator');
      assert.equal(formattedAccount.expirationDate, '2025-12-31T00:00:00.000Z');
      assert.equal(formattedAccount.accountNumber, '123456789');
      assert.equal(formattedAccount.logoUrl, 'https://example.com/logo.png');
    });

    it('handles null optional fields', () => {
      const account = createMockAccount({
        eliteStatus: null,
        expirationDate: null,
        accountNumber: null,
        logoUrl: null,
      });
      const data = createConnectedUserData([account]);

      const result = formatLoyaltyResponse(data);
      const formattedAccount = result.accounts[0];

      assert.equal(formattedAccount.eliteStatus, null);
      assert.equal(formattedAccount.expirationDate, null);
      assert.equal(formattedAccount.accountNumber, null);
      assert.equal(formattedAccount.logoUrl, null);
    });
  });

  describe('Provider Filter', () => {
    it('filters by provider code (case-insensitive)', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', providerName: 'Lufthansa' }),
        createMockAccount({ id: 'acc-2', providerCode: 'UA', providerName: 'United' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'lh');

      assert.equal(result.accountCount, 1);
      assert.equal(result.accounts[0].providerCode, 'LH');
    });

    it('filters by provider name (case-insensitive)', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', providerName: 'Lufthansa Miles & More' }),
        createMockAccount({ id: 'acc-2', providerCode: 'UA', providerName: 'United MileagePlus' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'lufthansa');

      assert.equal(result.accountCount, 1);
      assert.equal(result.accounts[0].providerName, 'Lufthansa Miles & More');
    });

    it('filters by partial match', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', providerName: 'Lufthansa Miles & More' }),
        createMockAccount({ id: 'acc-2', providerCode: 'MH', providerName: 'Malaysia Airlines' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'miles');

      assert.equal(result.accountCount, 1);
      assert.equal(result.accounts[0].providerName, 'Lufthansa Miles & More');
    });

    it('returns empty when no accounts match filter', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', providerName: 'Lufthansa' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'united');

      assert.equal(result.connected, true);
      assert.equal(result.accountCount, 0);
      assert.equal(result.totalPoints, 0);
      assert.deepEqual(result.accounts, []);
    });

    it('recalculates total points after filtering', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', balance: 50000 }),
        createMockAccount({ id: 'acc-2', providerCode: 'UA', balance: 30000 }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'LH');

      assert.equal(result.totalPoints, 50000);
      assert.equal(result.accountCount, 1);
    });

    it('matches multiple accounts with same filter', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', providerName: 'Lufthansa Miles' }),
        createMockAccount({ id: 'acc-2', providerCode: 'SQ', providerName: 'Singapore Miles' }),
        createMockAccount({ id: 'acc-3', providerCode: 'UA', providerName: 'American Miles' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'miles');

      assert.equal(result.accountCount, 3);
    });
  });

  describe('includeDetails Parameter', () => {
    it('includes accounts when includeDetails is true', () => {
      const accounts = [createMockAccount()];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, undefined, true);

      assert.equal(result.accounts.length, 1);
    });

    it('excludes accounts when includeDetails is false', () => {
      const accounts = [createMockAccount(), createMockAccount({ id: 'acc-2' })];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, undefined, false);

      assert.equal(result.accountCount, 2);
      assert.equal(result.totalPoints, 100000);
      assert.deepEqual(result.accounts, []);
    });

    it('defaults to true when not specified', () => {
      const accounts = [createMockAccount()];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.accounts.length, 1);
    });

    it('combines filter and includeDetails=false', () => {
      const accounts = [
        createMockAccount({ providerCode: 'LH', balance: 50000 }),
        createMockAccount({ id: 'acc-2', providerCode: 'UA', balance: 30000 }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'LH', false);

      assert.equal(result.accountCount, 1);
      assert.equal(result.totalPoints, 50000);
      assert.deepEqual(result.accounts, []);
    });
  });

  describe('Response Structure', () => {
    it('has correct structure for connected user', () => {
      const accounts = [createMockAccount()];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.ok('connected' in result);
      assert.ok('lastSyncedAt' in result);
      assert.ok('totalPoints' in result);
      assert.ok('accountCount' in result);
      assert.ok('accounts' in result);
      assert.equal(typeof result.connected, 'boolean');
      assert.equal(typeof result.lastSyncedAt, 'string');
      assert.equal(typeof result.totalPoints, 'number');
      assert.equal(typeof result.accountCount, 'number');
      assert.ok(Array.isArray(result.accounts));
    });

    it('has correct structure for disconnected user', () => {
      const data = createDisconnectedUserData();

      const result = formatLoyaltyResponse(data);

      assert.ok('connected' in result);
      assert.ok('lastSyncedAt' in result);
      assert.ok('totalPoints' in result);
      assert.ok('accountCount' in result);
      assert.ok('accounts' in result);
    });

    it('account summary has correct structure', () => {
      const accounts = [createMockAccount()];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);
      const account = result.accounts[0];

      const requiredKeys = [
        'providerCode',
        'providerName',
        'balance',
        'balanceUnit',
        'eliteStatus',
        'expirationDate',
        'accountNumber',
        'logoUrl',
      ];

      for (const key of requiredKeys) {
        assert.ok(key in account, `Missing key: ${key}`);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty accounts array', () => {
      const data: UserLoyaltyData = {
        connected: true,
        lastSyncedAt: new Date(),
        accounts: [],
      };

      const result = formatLoyaltyResponse(data);

      assert.equal(result.connected, true);
      assert.equal(result.accountCount, 0);
      assert.equal(result.totalPoints, 0);
    });

    it('handles null lastSyncedAt', () => {
      const data: UserLoyaltyData = {
        connected: true,
        lastSyncedAt: null,
        accounts: [createMockAccount()],
      };

      const result = formatLoyaltyResponse(data);

      assert.equal(result.lastSyncedAt, null);
    });

    it('handles very large balances', () => {
      const accounts = [
        createMockAccount({ balance: 1_000_000_000 }),
        createMockAccount({ id: 'acc-2', balance: 500_000_000 }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data);

      assert.equal(result.totalPoints, 1_500_000_000);
    });

    it('handles special characters in provider names', () => {
      const accounts = [
        createMockAccount({ providerName: 'Café Miles & More™' }),
      ];
      const data = createConnectedUserData(accounts);

      const result = formatLoyaltyResponse(data, 'café');

      assert.equal(result.accountCount, 1);
    });
  });
});
