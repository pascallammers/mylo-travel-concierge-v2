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
 */
export interface UserLoyaltyData {
  connected: boolean;
  lastSyncedAt: Date | null;
  accounts: LoyaltyAccount[];
}

/**
 * Response format for the loyalty balances tool.
 */
export interface LoyaltyBalancesResponse {
  connected: boolean;
  lastSyncedAt: string | null;
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
  if (!data.connected) {
    return {
      connected: false,
      lastSyncedAt: null,
      totalPoints: 0,
      accountCount: 0,
      accounts: [],
    };
  }

  let accounts = data.accounts;

  if (provider) {
    accounts = filterByProvider(accounts, provider);
  }

  return {
    connected: true,
    lastSyncedAt: data.lastSyncedAt?.toISOString() ?? null,
    totalPoints: calculateTotalPoints(accounts),
    accountCount: accounts.length,
    accounts: includeDetails ? accounts.map(formatAccount) : [],
  };
}
