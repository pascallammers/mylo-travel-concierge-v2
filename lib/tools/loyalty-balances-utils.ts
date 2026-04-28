/**
 * Utility functions for loyalty balances formatting.
 * Separated from the main tool to enable unit testing without server dependencies.
 */

/**
 * Represents a single loyalty account from the database.
 */
export interface LoyaltyAccount {
  id: string;
  connectionId: string;
  providerCode: string;
  providerName: string;
  balance: number;
  balanceUnit: string;
  eliteStatus: string | null;
  expirationDate: Date | null;
  accountNumber: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Combined user loyalty data for UI display.
 *
 * Mirrors the shape returned by `getUserLoyaltyData` so that pure formatting
 * helpers in this module stay free of server-only imports.
 */
export type LoyaltyDataStatus = 'connected' | 'error' | 'disconnected';

export interface UserLoyaltyData {
  status: LoyaltyDataStatus;
  /** @deprecated Use `status === 'connected'`. Kept for back-compat. */
  connected: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  accounts: LoyaltyAccount[];
}

/**
 * Response format for the loyalty balances tool.
 *
 * `status` lets the LLM distinguish "user has no connection" from
 * "user has a connection but the last sync failed and the balances may
 * be stale". `connected` is kept for back-compat (true iff status='connected').
 */
export interface LoyaltyBalancesResponse {
  /** @deprecated Prefer `status`. */
  connected: boolean;
  status: LoyaltyDataStatus;
  lastSyncedAt: string | null;
  /** Error message if status='error', otherwise null. */
  lastError: string | null;
  totalPoints: number;
  accountCount: number;
  accounts: LoyaltyAccountSummary[];
}

/**
 * Summary of a single loyalty account for tool response.
 */
export interface LoyaltyAccountSummary {
  providerCode: string;
  providerName: string;
  balance: number;
  balanceUnit: string;
  eliteStatus: string | null;
  expirationDate: string | null;
  accountNumber: string | null;
  logoUrl: string | null;
}

/**
 * Formats a loyalty account for tool response.
 * @param account - The loyalty account from database
 * @returns Formatted account summary
 */
export function formatAccount(account: LoyaltyAccount): LoyaltyAccountSummary {
  return {
    providerCode: account.providerCode,
    providerName: account.providerName,
    balance: account.balance,
    balanceUnit: account.balanceUnit,
    eliteStatus: account.eliteStatus,
    expirationDate: account.expirationDate?.toISOString() ?? null,
    accountNumber: account.accountNumber,
    logoUrl: account.logoUrl,
  };
}

/**
 * Filters accounts by provider code or name (case-insensitive).
 * @param accounts - Array of loyalty accounts
 * @param provider - Provider filter string
 * @returns Filtered accounts
 */
export function filterByProvider(accounts: LoyaltyAccount[], provider: string): LoyaltyAccount[] {
  const normalizedFilter = provider.toLowerCase();
  return accounts.filter(
    (account) =>
      account.providerCode.toLowerCase().includes(normalizedFilter) ||
      account.providerName.toLowerCase().includes(normalizedFilter)
  );
}

/**
 * Calculates total points across all accounts.
 * @param accounts - Array of loyalty accounts
 * @returns Total points/miles
 */
export function calculateTotalPoints(accounts: LoyaltyAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

/**
 * Formats loyalty data for tool response.
 * @param data - User loyalty data from database
 * @param provider - Optional provider filter
 * @param includeDetails - Whether to include full account details
 * @returns Formatted response
 */
export function formatLoyaltyResponse(
  data: UserLoyaltyData,
  provider?: string,
  includeDetails: boolean = true
): LoyaltyBalancesResponse {
  if (data.status === 'disconnected') {
    return {
      connected: false,
      status: 'disconnected',
      lastSyncedAt: null,
      lastError: null,
      totalPoints: 0,
      accountCount: 0,
      accounts: [],
    };
  }

  // 'error' state: surface accounts (so the LLM can answer "what was your last
  // known balance?") but flag the error explicitly so the assistant warns the
  // user the data may be stale.
  if (data.status === 'error') {
    let accounts = data.accounts;
    if (provider) {
      accounts = filterByProvider(accounts, provider);
    }
    return {
      connected: false,
      status: 'error',
      lastSyncedAt: data.lastSyncedAt?.toISOString() ?? null,
      lastError: data.lastError,
      totalPoints: calculateTotalPoints(accounts),
      accountCount: accounts.length,
      accounts: includeDetails ? accounts.map(formatAccount) : [],
    };
  }

  let accounts = data.accounts;

  if (provider) {
    accounts = filterByProvider(accounts, provider);
  }

  return {
    connected: true,
    status: 'connected',
    lastSyncedAt: data.lastSyncedAt?.toISOString() ?? null,
    lastError: null,
    totalPoints: calculateTotalPoints(accounts),
    accountCount: accounts.length,
    accounts: includeDetails ? accounts.map(formatAccount) : [],
  };
}
