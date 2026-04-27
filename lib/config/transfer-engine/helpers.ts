/**
 * Transfer-engine helper functions: calculations, prompt-injection formatting,
 * and provider-name lookup.
 *
 * Helpers operate on a `PartnerMap` so they work for any region/source program.
 * DACH-specific convenience wrappers are provided for backward compatibility
 * with the legacy `lib/config/amex-transfer-ratios` API.
 */

import { AMEX_DACH_PARTNERS } from './dach';
import type { PartnerMap, TransferLocale, TransferPartner } from './types';

// ============================================
// Generic calculations (work on any partner)
// ============================================

/**
 * Calculate how many partner miles you receive from a given source-points amount.
 * Returns `null` when the partner id is not found in the map.
 *
 * @param partners - Partner map for the source program/region.
 * @param partnerId - Key in the partner map.
 * @param sourcePoints - Source-program points to transfer.
 */
export function calculatePartnerMilesIn(
  partners: PartnerMap,
  partnerId: string,
  sourcePoints: number
): number | null {
  const partner = partners[partnerId];
  if (!partner) return null;
  return Math.floor((sourcePoints * partner.partnerMiles) / partner.amexPoints);
}

/**
 * Calculate how many source points are required for a target amount of partner miles.
 * Returns `null` when the partner id is not found in the map.
 *
 * @param partners - Partner map for the source program/region.
 * @param partnerId - Key in the partner map.
 * @param targetMiles - Desired miles/points at the partner program.
 */
export function calculateRequiredSourcePoints(
  partners: PartnerMap,
  partnerId: string,
  targetMiles: number
): number | null {
  const partner = partners[partnerId];
  if (!partner) return null;
  return Math.ceil((targetMiles * partner.amexPoints) / partner.partnerMiles);
}

/**
 * Get partners sorted by effective rate (best first).
 */
export function sortPartnersByEffectiveRate(partners: PartnerMap): TransferPartner[] {
  return Object.values(partners).sort((a, b) => b.effectiveRate - a.effectiveRate);
}

/**
 * Get airline partners only.
 */
export function getAirlinePartnersIn(partners: PartnerMap): TransferPartner[] {
  return Object.values(partners).filter((p) => p.type === 'airline');
}

/**
 * Format transfer ratio as human-readable string, e.g. "5:4 (80%)".
 */
export function formatTransferRatio(partner: TransferPartner): string {
  return `${partner.amexPoints}:${partner.partnerMiles} (${partner.effectiveRate}%)`;
}

/**
 * Get the localized value from a `LocalizedString`, defaulting to German.
 */
export function getLocalizedValue(
  value: { de: string; en: string },
  locale: TransferLocale = 'de'
): string {
  return value[locale];
}

// ============================================
// DACH-specific convenience wrappers (backward compat)
// ============================================

/**
 * Calculate partner miles from Amex DACH MR points.
 * Backward-compatible alias for `calculatePartnerMilesIn(AMEX_DACH_PARTNERS, ...)`.
 */
export function calculatePartnerMiles(partnerId: string, amexPoints: number): number | null {
  return calculatePartnerMilesIn(AMEX_DACH_PARTNERS, partnerId, amexPoints);
}

/**
 * Calculate required Amex DACH MR points for a target partner-miles amount.
 * Backward-compatible alias for `calculateRequiredSourcePoints(AMEX_DACH_PARTNERS, ...)`.
 */
export function calculateRequiredAmexPoints(
  partnerId: string,
  targetMiles: number
): number | null {
  return calculateRequiredSourcePoints(AMEX_DACH_PARTNERS, partnerId, targetMiles);
}

/**
 * Get DACH Amex partners sorted by effective rate.
 * Backward-compatible alias.
 */
export function getDachPartnersByEffectiveRate(): TransferPartner[] {
  return sortPartnersByEffectiveRate(AMEX_DACH_PARTNERS);
}

/**
 * Get DACH Amex airline partners.
 * Backward-compatible alias.
 */
export function getDachAirlinePartners(): TransferPartner[] {
  return getAirlinePartnersIn(AMEX_DACH_PARTNERS);
}

// ============================================
// Prompt-injection formatting (DACH Amex specific)
// ============================================

const AMEX_DACH_PROMPT_I18N = {
  header: {
    de: (balance: number) =>
      `### Amex Transfer-Optionen (DACH-Region)\nBei ${balance.toLocaleString('de-DE')} Membership Rewards Punkten:`,
    en: (balance: number) =>
      `### Amex Transfer Options (DACH Region)\nWith ${balance.toLocaleString('en-US')} Membership Rewards points:`,
  },
  warning: {
    de: '**WICHTIG**: Diese Ratios gelten für Deutschland/Österreich/Schweiz. USA/UK haben oft bessere 1:1 Ratios.\nEmirates (2:1) ist stark abgewertet und nicht empfehlenswert.',
    en: '**IMPORTANT**: These ratios apply to Germany/Austria/Switzerland. US/UK often have better 1:1 ratios.\nEmirates (2:1) is significantly devalued and not recommended.',
  },
} as const;

const AMEX_DACH_TOP_AIRLINE_IDS = [
  'flyingBlue',
  'britishAirways',
  'iberia',
  'cathay',
  'singaporeKrisflyer',
] as const;

/**
 * Format Amex DACH transfer options for prompt injection.
 * Returns the empty string when balance is zero or negative.
 *
 * Output is locale-deterministic: numbers are formatted in `de-DE` for `'de'`
 * and `en-US` for `'en'`, regardless of host locale.
 *
 * @param amexBalance - User's Amex DACH MR balance.
 * @param locale - Display locale ('de' or 'en'). Defaults to 'en'.
 */
export function formatAmexDachTransferOptions(
  amexBalance: number,
  locale: TransferLocale = 'en'
): string {
  if (amexBalance <= 0) return '';

  const numberLocale = locale === 'de' ? 'de-DE' : 'en-US';

  const transferOptions = AMEX_DACH_TOP_AIRLINE_IDS.map((id) => {
    const partner = AMEX_DACH_PARTNERS[id];
    const resultMiles = calculatePartnerMilesIn(AMEX_DACH_PARTNERS, id, amexBalance);
    if (resultMiles === null || resultMiles === 0) return null;
    return `- ${partner.name}: ${resultMiles.toLocaleString(numberLocale)} ${partner.currencyUnit[locale]} (${partner.amexPoints}:${partner.partnerMiles} Ratio)`;
  })
    .filter((line): line is string => line !== null)
    .join('\n');

  return `
${AMEX_DACH_PROMPT_I18N.header[locale](amexBalance)}
${transferOptions}

${AMEX_DACH_PROMPT_I18N.warning[locale]}`;
}

// ============================================
// Provider-name lookup (DACH Amex specific)
// ============================================

const DACH_KEYWORD_TO_PARTNER_ID: Record<string, string> = {
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

/**
 * Find a DACH Amex transfer partner by fuzzy keyword match against a provider name.
 * Returns `null` when no keyword matches.
 *
 * @param providerName - Loyalty program display name (e.g. from AwardWallet).
 */
export function findDachTransferPartner(providerName: string): TransferPartner | null {
  if (!providerName) return null;
  const normalized = providerName.toLowerCase();
  for (const [keyword, partnerId] of Object.entries(DACH_KEYWORD_TO_PARTNER_ID)) {
    if (normalized.includes(keyword)) {
      return AMEX_DACH_PARTNERS[partnerId] ?? null;
    }
  }
  return null;
}
