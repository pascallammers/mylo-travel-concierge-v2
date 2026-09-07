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
  | 'payback'
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
 * seats.aero `Source` slug -> partner-map keys. Partner ids are consistent
 * across all regional maps; a slug matches a source program only when that
 * map actually contains one of the ids.
 *
 * `lufthansa` has two DACH routes: `milesAndMore` is the direct PAYBACK ->
 * Miles & More conversion, `payback` the indirect Amex route (MR -> PAYBACK ->
 * Miles & More) whose partner entry carries `type: 'other'` so callers can mark
 * it as indirect. Slugs without any card transfer route (azul, connectmiles,
 * ethiopian, saudia, smiles, velocity) are intentionally absent.
 */
const AWARD_PROGRAM_TO_PARTNER_IDS: Record<string, readonly string[]> = {
  aeroplan: ['airCanadaAeroplan'],
  aeromexico: ['aeromexico'],
  alaska: ['atmos'],
  american: ['americanAirlines'],
  british: ['britishAirways'],
  delta: ['deltaSkyMiles'],
  emirates: ['emiratesSkywards'],
  etihad: ['etihadGuest'],
  eurobonus: ['sasEurobonus'],
  finnair: ['finnair'],
  flyingblue: ['flyingBlue'],
  jetblue: ['jetblueTrueBlue'],
  lifemiles: ['aviancaLifeMiles'],
  lufthansa: ['milesAndMore', 'payback'],
  qantas: ['qantas'],
  qatar: ['qatarPrivilegeClub'],
  singapore: ['singaporeKrisflyer'],
  united: ['unitedMileagePlus'],
  virginatlantic: ['virginAtlantic'],
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
    const partnerIds = AWARD_PROGRAM_TO_PARTNER_IDS[slug];
    if (!partnerIds) return [];

    const sources: AwardProgramTransferSource[] = [];
    for (const program of sourcePrograms) {
      for (const partnerId of partnerIds) {
        const partner = program.partners[partnerId];
        if (!partner) continue;
        sources.push({
          sourceProgramId: program.id,
          sourceProgramLabel: program.label,
          partnerId,
          partner,
        });
      }
    }

    return sources.sort((a, b) => b.partner.effectiveRate - a.partner.effectiveRate);
  };
}
