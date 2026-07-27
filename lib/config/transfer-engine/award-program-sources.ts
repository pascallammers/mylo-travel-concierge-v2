/**
 * Resolve a seats.aero award-program slug to the credit-card programs that can
 * transfer points into it (MYLO-22).
 *
 * This module only holds the slug -> partner-id join; ratios, minimums, and
 * localized fields always come from the regional partner maps, so the transfer
 * engine stays the single source of truth.
 */

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

export interface AwardProgramSourceProgram {
  id: SourceProgramId;
  label: LocalizedString;
  partners: PartnerMap;
}

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
 * Create a resolver for seats.aero award-program transfer sources.
 *
 * @param sourcePrograms - Regional source programs and their partner maps.
 * @returns A resolver that lists matching sources best effective rate first.
 */
export function createAwardProgramSourceResolver(
  sourcePrograms: ReadonlyArray<AwardProgramSourceProgram>,
): (slug: string) => AwardProgramTransferSource[] {
  return (slug) => {
    const partnerId = AWARD_PROGRAM_TO_PARTNER_ID[slug];
    if (!partnerId) return [];

    const sources: AwardProgramTransferSource[] = [];
    for (const program of sourcePrograms) {
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
  };
}
