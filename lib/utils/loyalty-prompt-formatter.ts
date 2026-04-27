import 'server-only';

import type { UserLoyaltyData } from '@/lib/db/queries/awardwallet';

type PromptLocale = 'de' | 'en';

const promptI18n = {
  notConnected: {
    de: `### Loyalty Programs
Der Nutzer hat AwardWallet nicht verbunden. Bei Fragen zu Treuepunkten oder Meilen, schlage vor, das AwardWallet-Konto unter /settings/loyalty zu verbinden.`,
    en: `### Loyalty Programs
User has not connected AwardWallet. If they ask about loyalty points or miles, suggest connecting their AwardWallet account at /settings/loyalty.`,
  },
  connectedHeader: {
    de: '### Treueprogramme (AwardWallet verbunden)',
    en: '### Loyalty Programs (AwardWallet Connected)',
  },
  lastSynced: { de: 'Letzte Synchronisierung', en: 'Last synced' },
  totalPrograms: { de: 'Programme gesamt', en: 'Total programs' },
  combinedBalance: { de: 'Gesamtguthaben', en: 'Combined balance' },
  pointsMiles: { de: 'Punkte/Meilen', en: 'points/miles' },
  accounts: { de: 'Konten', en: 'Accounts' },
  expires: { de: 'Läuft ab', en: 'Expires' },
  loyaltyHint: {
    de: 'Bei Fragen zu Treuepunkten oder Meilen kannst du direkt aus diesen Daten antworten. Für Detail-Abfragen zu bestimmten Programmen nutze das get_loyalty_balances Tool.',
    en: 'When the user asks about their loyalty points or miles, you can directly answer from this data. For detailed queries about specific programs, use the get_loyalty_balances tool.',
  },
} as const;

/**
 * Formats loyalty data for injection into the system prompt.
 * Returns a human-readable summary of the user's loyalty program accounts.
 * @param data - The user's loyalty data from the database
 * @param locale - Language for the prompt text (default: 'en')
 * @returns A formatted string for the system prompt, or null if not connected
 */
export function formatLoyaltyDataForPrompt(data: UserLoyaltyData, locale: PromptLocale = 'en'): string {
  if (!data.connected || data.accounts.length === 0) {
    return promptI18n.notConnected[locale];
  }

  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US';
  const totalPoints = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const lastSync = data.lastSyncedAt
    ? new Date(data.lastSyncedAt).toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : (locale === 'de' ? 'Nie' : 'Never');

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
          line += ` ⚠️ ${promptI18n.expires[locale]}: ${expDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }
      return line;
    })
    .join('\n');

  return `${promptI18n.connectedHeader[locale]}
${promptI18n.lastSynced[locale]}: ${lastSync}
${promptI18n.totalPrograms[locale]}: ${data.accounts.length}
${promptI18n.combinedBalance[locale]}: ~${totalPoints.toLocaleString()} ${promptI18n.pointsMiles[locale]}

**${promptI18n.accounts[locale]}:**
${accountsSummary}

${promptI18n.loyaltyHint[locale]}`;
}
