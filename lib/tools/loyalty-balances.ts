import { tool } from 'ai';
import { z } from 'zod';
import { getUserLoyaltyData, type UserLoyaltyData, type LoyaltyAccount } from '@/lib/db/queries/awardwallet';

/**
 * Response format for the loyalty balances tool
 */
export interface LoyaltyBalancesResponse {
  connected: boolean;
  lastSyncedAt: string | null;
  totalPoints: number;
  accountCount: number;
  accounts: LoyaltyAccountSummary[];
}

/**
 * Summary of a single loyalty account for tool response
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
 * Formats a loyalty account for tool response
 * @param account - The loyalty account from database
 * @returns Formatted account summary
 */
function formatAccount(account: LoyaltyAccount): LoyaltyAccountSummary {
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
 * Filters accounts by provider code or name (case-insensitive)
 * @param accounts - Array of loyalty accounts
 * @param provider - Provider filter string
 * @returns Filtered accounts
 */
function filterByProvider(accounts: LoyaltyAccount[], provider: string): LoyaltyAccount[] {
  const normalizedFilter = provider.toLowerCase();
  return accounts.filter(
    (account) =>
      account.providerCode.toLowerCase().includes(normalizedFilter) ||
      account.providerName.toLowerCase().includes(normalizedFilter)
  );
}

/**
 * Calculates total points across all accounts
 * @param accounts - Array of loyalty accounts
 * @returns Total points/miles
 */
function calculateTotalPoints(accounts: LoyaltyAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

/**
 * Formats loyalty data for tool response
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

/**
 * Get Loyalty Balances Tool
 *
 * Retrieves the user's loyalty program balances from the database.
 * Data is synced from AwardWallet and cached locally.
 *
 * @description Use this tool when the user asks about their specific loyalty
 * program balances, account details, or wants to filter by a specific program.
 * For general questions about total points, prefer using the system context.
 */
export const getLoyaltyBalancesTool = tool({
  description: `Retrieve detailed loyalty program balances for the user.

This tool fetches the user's connected loyalty accounts from AwardWallet, including:
- Miles and points balances for each program
- Elite status information
- Account expiration dates
- Filtered results by specific provider

Use this tool when:
- User asks for specific loyalty program details
- User wants to filter by a particular airline or hotel program
- User needs account numbers or expiration dates
- User asks "How many miles do I have with [airline]?"

For general "How many points do I have?" questions, the system already has this context - you don't need to call this tool unless the user wants specific details or filtering.`,

  inputSchema: z.object({
    provider: z
      .string()
      .optional()
      .describe(
        'Filter by loyalty provider name or code (e.g., "Lufthansa", "united", "marriott"). Case-insensitive partial match.'
      ),
    includeDetails: z
      .boolean()
      .default(true)
      .describe(
        'Whether to include full account details (balances, status, expiration). Set to false for summary only.'
      ),
  }),

  execute: async (
    { provider, includeDetails = true }: { provider?: string; includeDetails?: boolean },
    { messages }
  ) => {
    const chatId = (messages as unknown as Array<{ chatId?: string }>)?.[0]?.chatId || 'unknown';
    const userId = (messages as unknown as Array<{ userId?: string }>)?.[0]?.userId;

    console.log('[Loyalty Balances] Starting lookup:', { chatId, provider, includeDetails });

    if (!userId) {
      console.warn('[Loyalty Balances] No userId available in context');
      return {
        connected: false,
        lastSyncedAt: null,
        totalPoints: 0,
        accountCount: 0,
        accounts: [],
        error: 'User not authenticated. Please sign in to view your loyalty balances.',
      };
    }

    try {
      const loyaltyData = await getUserLoyaltyData(userId);
      const response = formatLoyaltyResponse(loyaltyData, provider, includeDetails);

      console.log('[Loyalty Balances] Results:', {
        connected: response.connected,
        accountCount: response.accountCount,
        totalPoints: response.totalPoints,
        filtered: !!provider,
      });

      if (!response.connected) {
        return {
          ...response,
          message: 'AwardWallet ist nicht verbunden. Verbinde dein AwardWallet-Konto, um deine Loyalty-Daten zu sehen.',
        };
      }

      if (provider && response.accountCount === 0) {
        return {
          ...response,
          message: `Keine Konten gefunden für "${provider}". Überprüfe den Programmnamen oder zeige alle Konten an.`,
        };
      }

      return response;
    } catch (error) {
      console.error('[Loyalty Balances] Error:', error);
      throw error;
    }
  },
});
