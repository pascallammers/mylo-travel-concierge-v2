import { AMEX_DACH_PARTNERS, PAYBACK_DACH_PARTNERS } from '../config/transfer-engine/dach';
import type { PartnerMap } from '../config/transfer-engine/types';
import type { CurrentRate, Observation, SourceProgramId } from './types';

export const TRANSFER_SEEDS: Record<SourceProgramId, PartnerMap> = {
  amex_dach: AMEX_DACH_PARTNERS,
  payback: PAYBACK_DACH_PARTNERS,
};
export const SOURCE_URLS: Record<SourceProgramId, string> = {
  amex_dach: 'https://www.americanexpress.com/de-de/rewards/membership-rewards/travel/all',
  payback: 'https://www.payback.de/partner/miles-and-more',
};

/**
 * Convert seed metadata into database rate values.
 * @param partners - Source's seed map.
 * @returns Accepted initial values without persistence fields.
 */
export function seedRows(partners: PartnerMap): CurrentRate[] {
  return Object.entries(partners).map(([partnerKey, partner]) => ({
    partnerKey,
    sourcePoints: partner.amexPoints,
    partnerUnits: partner.partnerMiles,
    minTransfer: partner.minTransfer,
    transferIncrement: partner.transferIncrement,
    transferDurationDe: partner.transferDuration.de,
  }));
}

/**
 * Find metadata for a parsed partner, including a newly supplemented seed.
 * @param observation - Parsed identity.
 * @param partners - Source's seed metadata.
 * @returns A seed key when its metadata exists.
 */
export function findSeedKey(observation: Observation, partners: PartnerMap): string | undefined {
  if (observation.partnerKey && Object.hasOwn(partners, observation.partnerKey)) return observation.partnerKey;
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[®™]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return Object.keys(partners).find((key) => normalize(partners[key].name) === normalize(observation.sourceName));
}
