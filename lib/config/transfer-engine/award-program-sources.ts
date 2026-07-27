/**
 * Resolve a seats.aero award-program slug to the credit-card programs that can
 * transfer points into it (MYLO-22).
 *
 * This module only holds the slug -> partner-id join; ratios, minimums, and
 * localized fields always come from the regional partner maps, so the transfer
 * engine stays the single source of truth.
 */

import { AMEX_DACH_PARTNERS } from './dach';
import { AMEX_US_PARTNERS } from './us-amex';
import { BILT_PARTNERS } from './us-bilt';
import { CAPITAL_ONE_PARTNERS } from './us-capital-one';
import { CHASE_PARTNERS } from './us-chase';
import { CITI_PARTNERS } from './us-citi';
import type { LocalizedString, PartnerMap, TransferPartner } from './types';

/** Source-program ids, aligned with the transfer-partner-optimizer tool enum. */
export type SourceProgramId =
  | 'amex_dach'
  | 'amex_us'
  | 'chase_ur'
  | 'bilt'
  | 'capital_one'
  | 'citi_ty';

export interface AwardProgramTransferSource {
  sourceProgramId: SourceProgramId;
  sourceProgramLabel: LocalizedString;
  partnerId: string;
  partner: TransferPartner;
}

const SOURCE_PROGRAMS: Array<{
  id: SourceProgramId;
  label: LocalizedString;
  partners: PartnerMap;
}> = [
  {
    id: 'amex_dach',
    label: { de: 'Amex Membership Rewards (DACH)', en: 'Amex Membership Rewards (DACH)' },
    partners: AMEX_DACH_PARTNERS,
  },
  {
    id: 'amex_us',
    label: { de: 'Amex Membership Rewards (US)', en: 'Amex Membership Rewards (US)' },
    partners: AMEX_US_PARTNERS,
  },
  {
    id: 'chase_ur',
    label: { de: 'Chase Ultimate Rewards', en: 'Chase Ultimate Rewards' },
    partners: CHASE_PARTNERS,
  },
  {
    id: 'bilt',
    label: { de: 'Bilt Rewards', en: 'Bilt Rewards' },
    partners: BILT_PARTNERS,
  },
  {
    id: 'capital_one',
    label: { de: 'Capital One Miles', en: 'Capital One Miles' },
    partners: CAPITAL_ONE_PARTNERS,
  },
  {
    id: 'citi_ty',
    label: { de: 'Citi ThankYou Points', en: 'Citi ThankYou Points' },
    partners: CITI_PARTNERS,
  },
];

/**
 * seats.aero `Source` slug -> partner-map key. Partner ids are consistent
 * across all regional maps, so one id per slug is enough; a slug matches a
 * source program only when that map actually contains the id.
 *
 * `lufthansa: 'payback'` is the indirect DACH route (MR -> PAYBACK -> Miles &
 * More); the partner entry's `type: 'other'` marks it as indirect for callers.
 * Slugs without any card transfer route (azul, connectmiles, ethiopian,
 * saudia, smiles, velocity) are intentionally absent.
 */
const AWARD_PROGRAM_TO_PARTNER_ID: Record<string, string> = {
  aeroplan: 'airCanadaAeroplan',
  aeromexico: 'aeromexico',
  alaska: 'atmos',
  american: 'americanAirlines',
  british: 'britishAirways',
  delta: 'deltaSkyMiles',
  emirates: 'emiratesSkywards',
  etihad: 'etihadGuest',
  eurobonus: 'sasEurobonus',
  finnair: 'finnair',
  flyingblue: 'flyingBlue',
  jetblue: 'jetblueTrueBlue',
  lifemiles: 'aviancaLifeMiles',
  lufthansa: 'payback',
  qantas: 'qantas',
  qatar: 'qatarPrivilegeClub',
  singapore: 'singaporeKrisflyer',
  united: 'unitedMileagePlus',
  virginatlantic: 'virginAtlantic',
};

/**
 * List all card programs that transfer into the given seats.aero award
 * program, best effective rate first. Returns `[]` for unknown slugs or
 * programs without any transfer route.
 */
export function getTransferSourcesForAwardProgram(
  slug: string,
): AwardProgramTransferSource[] {
  const partnerId = AWARD_PROGRAM_TO_PARTNER_ID[slug];
  if (!partnerId) return [];

  const sources: AwardProgramTransferSource[] = [];
  for (const program of SOURCE_PROGRAMS) {
    const partner = program.partners[partnerId];
    if (!partner) continue;
    sources.push({
      sourceProgramId: program.id,
      sourceProgramLabel: program.label,
      partnerId,
      partner,
    });
  }

  return sources.sort((a, b) => b.partner.effectiveRate - a.partner.effectiveRate);
}
