import 'server-only';

import type { UserLoyaltyData } from '@/lib/db/queries/awardwallet';

/**
 * Formats loyalty data for injection into the system prompt.
 * Returns a human-readable summary of the user's loyalty program accounts.
 * @param data - The user's loyalty data from the database
 * @returns A formatted string for the system prompt, or null if not connected
 */
export function formatLoyaltyDataForPrompt(data: UserLoyaltyData): string {
  if (!data.connected || data.accounts.length === 0) {
    return `### Loyalty Programs
User has not connected AwardWallet. If they ask about loyalty points or miles, suggest connecting their AwardWallet account at /settings/loyalty.`;
  }

  const totalPoints = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const lastSync = data.lastSyncedAt
    ? new Date(data.lastSyncedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  const accountsSummary = data.accounts
    .map((acc) => {
      let line = `- ${acc.providerName}: ${acc.balance.toLocaleString()} ${acc.balanceUnit}`;
      if (acc.eliteStatus) {
        line += ` (${acc.eliteStatus})`;
      }
      if (acc.expirationDate) {
        const expDate = new Date(acc.expirationDate);
        const isExpiringSoon = expDate.getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000; // 90 days
        if (isExpiringSoon) {
          line += ` ⚠️ Expires: ${expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }
      return line;
    })
    .join('\n');

  return `### Loyalty Programs (AwardWallet Connected)
Last synced: ${lastSync}
Total programs: ${data.accounts.length}
Combined balance: ~${totalPoints.toLocaleString()} points/miles

**Accounts:**
${accountsSummary}

When the user asks about their loyalty points or miles, you can directly answer from this data. For detailed queries about specific programs, use the get_loyalty_balances tool.`;
}
