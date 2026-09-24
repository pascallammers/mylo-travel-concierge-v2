import { DACH_SOURCE_PROGRAM_IDS, type AwardProgramTransferSource, type TransferPartner } from '@/lib/config/transfer-engine';
import type { FlightLocale } from './direct-tiering';
export interface TransferHintDependencies {
  getTransferSourcesForAwardProgram: (slug: string) => AwardProgramTransferSource[];
  formatTransferRatio: (partner: TransferPartner) => string;
}
export interface DachTransferHint { readonly programSlug: string; readonly sources: string[] }

/**
 * Collect the MYLO-55 transfer hints using only currencies available to DACH customers.
 * @param programSlugs - Displayed award programs, in first-seen order.
 * @param locale - Hint language.
 * @param deps - Runtime transfer resolver and ratio formatter.
 * @returns One hint per reachable program, excluding US-only sources.
 */
export function collectDachTransferHints(programSlugs: readonly string[], locale: FlightLocale, deps: TransferHintDependencies): DachTransferHint[] {
  return [...new Set(programSlugs)].flatMap((programSlug) => {
    const sources = deps.getTransferSourcesForAwardProgram(programSlug)
      .filter(({ sourceProgramId }) => DACH_SOURCE_PROGRAM_IDS.has(sourceProgramId))
      .map(({ sourceProgramLabel, partner }) => {
        const via = partner.type === 'other' ? ` ${locale === 'de' ? 'über' : 'via'} ${partner.name}` : '';
        return `${sourceProgramLabel[locale]}${via} ${deps.formatTransferRatio(partner)}`;
      });
    return sources.length ? [{ programSlug, sources }] : [];
  });
}
