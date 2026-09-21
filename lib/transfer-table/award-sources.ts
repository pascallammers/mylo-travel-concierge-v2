import { createAwardProgramSourceResolver, SOURCE_PROGRAMS } from '../config/transfer-engine';
import type { DachPartnerMaps } from './reader';

/**
 * Create transfer hints using one DACH snapshot and the unchanged US maps.
 * @param loadPartners - Injected DACH reader.
 * @returns Resolver scoped to this search's accepted transfer values.
 */
export async function loadAwardProgramSourceResolver(loadPartners: () => Promise<DachPartnerMaps>) {
  const maps = await loadPartners();
  return createAwardProgramSourceResolver(
    SOURCE_PROGRAMS.map((source) => ({
      ...source,
      partners: source.id === 'amex_dach' ? maps.amex : source.id === 'payback' ? maps.payback : source.partners,
    })),
  );
}
