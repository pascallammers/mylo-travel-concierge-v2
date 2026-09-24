import type {
  getNearbyAirports,
  mapCabinClass,
  searchDuffel,
  searchDuffelFlexibleDates,
} from '@/lib/api/duffel-client';
import type { AwardSearchDeps } from '@/lib/flights/award-search';
import type { applyAwardFilters } from '@/lib/api/award-search/award-filters';
import type {
  getProgramBookingUrl,
  getProgramCaveat,
  getProgramDisplayName,
} from '@/lib/api/award-search/program-registry';
import type {
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
} from '@/lib/config/transfer-engine';
import type { mergeSessionState } from '@/lib/db/queries';
import type { logFailedSearch } from '@/lib/db/queries/failed-search';
import type {
  resolveAirportCodesWithLLM,
  resolveIATACode,
} from '@/lib/utils/airport-codes';
import type { createDuffelBookingSession } from '@/lib/utils/duffel-links';

export interface FlightSearchToolDependencies {
  searchAwardTrips: AwardSearchDeps['searchTrips'];
  searchDuffel: typeof searchDuffel;
  searchDuffelFlexibleDates: typeof searchDuffelFlexibleDates;
  mapCabinClass: typeof mapCabinClass;
  getNearbyAirports: typeof getNearbyAirports;
  mergeSessionState: typeof mergeSessionState;
  resolveIATACode: typeof resolveIATACode;
  resolveAirportCodesWithLLM: typeof resolveAirportCodesWithLLM;
  createDuffelBookingSession: typeof createDuffelBookingSession;
  logFailedSearch: typeof logFailedSearch;
  /** @deprecated Filters are owned by the award core; retained for structural mock compatibility. */
  applyAwardFilters?: typeof applyAwardFilters;
  getProgramDisplayName: typeof getProgramDisplayName;
  getProgramBookingUrl: typeof getProgramBookingUrl;
  getProgramCaveat: typeof getProgramCaveat;
  formatTransferRatio: typeof formatTransferRatio;
  getTransferSourcesForAwardProgram: typeof getTransferSourcesForAwardProgram;
  loadTransferSourceResolver?: () => Promise<typeof getTransferSourcesForAwardProgram>;
}
