import { tool } from 'ai';
import { z } from 'zod';
import { getUserLoyaltyData } from '@/lib/db/queries/awardwallet';
import {
  formatLoyaltyResponse,
  type LoyaltyBalancesResponse,
  type LoyaltyAccountSummary,
} from './loyalty-balances-utils';

export { formatLoyaltyResponse };
export type { LoyaltyBalancesResponse, LoyaltyAccountSummary };

type LoyaltyLocale = 'de' | 'en';

const loyaltyI18n = {
  notAuthenticated: {
    de: 'Benutzer nicht authentifiziert. Bitte melde dich an, um deine Treueprogramme zu sehen.',
    en: 'User not authenticated. Please sign in to view your loyalty balances.',
  },
  notConnected: {
    de: 'AwardWallet ist nicht verbunden. Verbinde dein AwardWallet-Konto, um deine Loyalty-Daten zu sehen.',
    en: 'AwardWallet is not connected. Connect your AwardWallet account to view your loyalty data.',
  },
  noAccountsForProvider: {
    de: (provider: string) =>
      `Keine Konten gefunden für "${provider}". Überprüfe den Programmnamen oder zeige alle Konten an.`,
    en: (provider: string) =>
      `No accounts found for "${provider}". Check the program name or show all accounts.`,
  },
} as const;

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

    // Default locale for tool responses (tool output is interpreted by the LLM)
    const locale: LoyaltyLocale = 'de';

    if (!userId) {
      console.warn('[Loyalty Balances] No userId available in context');
      return {
        connected: false,
        lastSyncedAt: null,
        totalPoints: 0,
        accountCount: 0,
        accounts: [],
        error: loyaltyI18n.notAuthenticated[locale],
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
          message: loyaltyI18n.notConnected[locale],
        };
      }

      if (provider && response.accountCount === 0) {
        return {
          ...response,
          message: loyaltyI18n.noAccountsForProvider[locale](provider),
        };
      }

      return response;
    } catch (error) {
      console.error('[Loyalty Balances] Error:', error);
      throw error;
    }
  },
});
