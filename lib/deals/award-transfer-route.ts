import {
  DACH_SOURCE_PROGRAM_IDS,
  type AwardProgramTransferSource,
} from '../config/transfer-engine';
import type { AwardTransferRoute } from './award-deal-view';

/**
 * Format the resolver's first DACH source, preserving its best-rate ordering.
 * @param sources - Transfer sources returned by the loaded award-program resolver.
 * @param locale - Locale for the source program's display name.
 * @returns A direct or indirect transfer label, or null when only foreign routes exist.
 */
export function buildAwardTransferRoute(
  sources: readonly AwardProgramTransferSource[],
  locale: string,
): AwardTransferRoute | null {
  const source = sources.find(({ sourceProgramId }) => DACH_SOURCE_PROGRAM_IDS.has(sourceProgramId));
  if (!source) return null;
  const { partner, sourceProgramLabel } = source;
  const language = locale === 'de' ? 'de' : 'en';
  const via = partner.type === 'other' ? ` ${language === 'de' ? 'über' : 'via'} ${partner.name}` : '';
  return { label: `${sourceProgramLabel[language]}${via} ${partner.amexPoints}:${partner.partnerMiles}` };
}
