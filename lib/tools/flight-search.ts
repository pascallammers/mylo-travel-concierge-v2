import {
  getNearbyAirports,
  mapCabinClass,
  searchDuffel,
  searchDuffelFlexibleDates,
} from '@/lib/api/duffel-client';
import { searchSeatsAero } from '@/lib/api/seats-aero-client';
import { applyAwardFilters } from '@/lib/api/award-search/award-filters';
import {
  getProgramBookingUrl,
  getProgramCaveat,
  getProgramDisplayName,
} from '@/lib/api/award-search/program-registry';
import {
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
} from '@/lib/config/transfer-engine';
import { mergeSessionState } from '@/lib/db/queries';
import { logFailedSearch } from '@/lib/db/queries/failed-search';
import {
  resolveAirportCodesWithLLM,
  resolveIATACode,
} from '@/lib/utils/airport-codes';
import { createDuffelBookingSession } from '@/lib/utils/duffel-links';
import {
  createFlightSearchTool,
  flightI18n,
  formatFlightResults,
} from './flight-search-tool';

export { createFlightSearchTool, flightI18n, formatFlightResults };
export type {
  FlightLocale,
  FlightSearchToolDependencies,
} from './flight-search-tool';

export const flightSearchTool = createFlightSearchTool({
  searchSeatsAero,
  searchDuffel,
  searchDuffelFlexibleDates,
  mapCabinClass,
  getNearbyAirports,
  mergeSessionState,
  resolveIATACode,
  resolveAirportCodesWithLLM,
  createDuffelBookingSession,
  logFailedSearch,
  applyAwardFilters,
  getProgramDisplayName,
  getProgramBookingUrl,
  getProgramCaveat,
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
});
