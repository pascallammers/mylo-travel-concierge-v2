import {
  getNearbyAirports,
  mapCabinClass,
  searchDuffel,
  searchDuffelFlexibleDates,
} from '@/lib/api/duffel-client';
import { searchSeatsAero } from '@/lib/api/seats-aero-client';
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
});
