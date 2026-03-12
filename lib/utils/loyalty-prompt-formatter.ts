import 'server-only';

import type { UserLoyaltyData } from '@/lib/db/queries/awardwallet';
import {
  AMEX_TRANSFER_PARTNERS_DACH,
  calculatePartnerMiles,
  type AmexTransferPartner,
} from '@/lib/config';

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
  amexHeader: {
    de: (balance: number) => `### Amex Transfer-Optionen (DACH-Region)\nBei ${balance.toLocaleString()} Membership Rewards Punkten:`,
    en: (balance: number) => `### Amex Transfer Options (DACH Region)\nWith ${balance.toLocaleString()} Membership Rewards points:`,
  },
  amexWarning: {
    de: '**WICHTIG**: Diese Ratios gelten für Deutschland/Österreich/Schweiz. USA/UK haben oft bessere 1:1 Ratios.\nEmirates (2:1) ist stark abgewertet und nicht empfehlenswert.',
    en: '**IMPORTANT**: These ratios apply to Germany/Austria/Switzerland. US/UK often have better 1:1 ratios.\nEmirates (2:1) is significantly devalued and not recommended.',
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

/**
 * Generates Amex transfer information for a given MR balance.
 * Useful when user has Amex MR points and asks about award redemptions.
 * @param amexBalance - The user's Amex Membership Rewards balance
 * @param locale - Language for the output text (default: 'en')
 * @returns Formatted string with transfer options for top airline partners
 */
export function formatAmexTransferOptions(amexBalance: number, locale: PromptLocale = 'en'): string {
  if (amexBalance <= 0) return '';

  const topAirlinePartners: Array<{ id: string; partner: AmexTransferPartner }> = [
    { id: 'flyingBlue', partner: AMEX_TRANSFER_PARTNERS_DACH.flyingBlue },
    { id: 'britishAirways', partner: AMEX_TRANSFER_PARTNERS_DACH.britishAirways },
    { id: 'iberia', partner: AMEX_TRANSFER_PARTNERS_DACH.iberia },
    { id: 'cathay', partner: AMEX_TRANSFER_PARTNERS_DACH.cathay },
    { id: 'singaporeKrisflyer', partner: AMEX_TRANSFER_PARTNERS_DACH.singaporeKrisflyer },
  ];

  const transferOptions = topAirlinePartners
    .map(({ id, partner }) => {
      const resultMiles = calculatePartnerMiles(id, amexBalance);
      if (!resultMiles) return null;
      return `- ${partner.name}: ${resultMiles.toLocaleString()} ${partner.currencyUnit[locale]} (${partner.amexPoints}:${partner.partnerMiles} Ratio)`;
    })
    .filter(Boolean)
    .join('\n');

  return `
${promptI18n.amexHeader[locale](amexBalance)}
${transferOptions}

${promptI18n.amexWarning[locale]}`;
}

/**
 * Checks if a loyalty program name matches an Amex transfer partner.
 * @param providerName - The loyalty program name from AwardWallet
 * @returns The matching transfer partner info or null
 */
export function findAmexTransferPartner(providerName: string): AmexTransferPartner | null {
  const normalizedName = providerName.toLowerCase();

  const matchMap: Record<string, string> = {
    'membership rewards': 'amex',
    amex: 'amex',
    'american express': 'amex',
    'flying blue': 'flyingBlue',
    'air france': 'flyingBlue',
    klm: 'flyingBlue',
    'british airways': 'britishAirways',
    'executive club': 'britishAirways',
    avios: 'britishAirways',
    iberia: 'iberia',
    'iberia plus': 'iberia',
    sas: 'sasEurobonus',
    eurobonus: 'sasEurobonus',
    cathay: 'cathay',
    'asia miles': 'cathay',
    singapore: 'singaporeKrisflyer',
    krisflyer: 'singaporeKrisflyer',
    qatar: 'qatarPrivilegeClub',
    'privilege club': 'qatarPrivilegeClub',
    etihad: 'etihadGuest',
    'etihad guest': 'etihadGuest',
    delta: 'deltaSkyMiles',
    skymiles: 'deltaSkyMiles',
    emirates: 'emiratesSkywards',
    skywards: 'emiratesSkywards',
    hilton: 'hilton',
    'hilton honors': 'hilton',
    marriott: 'marriottBonvoy',
    bonvoy: 'marriottBonvoy',
    radisson: 'radisson',
  };

  for (const [keyword, partnerId] of Object.entries(matchMap)) {
    if (normalizedName.includes(keyword)) {
      return AMEX_TRANSFER_PARTNERS_DACH[partnerId] || null;
    }
  }

  return null;
}
