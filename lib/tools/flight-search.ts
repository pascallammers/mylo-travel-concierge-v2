import {
  getNearbyAirports,
  mapCabinClass,
  searchDuffel,
  searchDuffelFlexibleDates,
} from '@/lib/api/duffel-client';
import { searchSeatsAeroTrips } from '@/lib/api/seats-aero-client';
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
import { loadAwardProgramSourceResolver } from '@/lib/transfer-table/award-sources';
import { readDachPartnerMaps } from '@/lib/transfer-table/runtime';
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
  searchAwardTrips: searchSeatsAeroTrips,
  searchDuffel,
  searchDuffelFlexibleDates,
  mapCabinClass,
  getNearbyAirports,
  mergeSessionState,
  resolveIATACode,
  resolveAirportCodesWithLLM,
  createDuffelBookingSession,
  logFailedSearch,
  getProgramDisplayName,
  getProgramBookingUrl,
  getProgramCaveat,
  formatTransferRatio,
  getTransferSourcesForAwardProgram,
  loadTransferSourceResolver: () => loadAwardProgramSourceResolver(readDachPartnerMaps),
});
