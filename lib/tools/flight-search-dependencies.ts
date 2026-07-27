import type {
  getNearbyAirports,
  mapCabinClass,
  searchDuffel,
  searchDuffelFlexibleDates,
} from '@/lib/api/duffel-client';
import type { searchSeatsAero } from '@/lib/api/seats-aero-client';
import type { mergeSessionState } from '@/lib/db/queries';
import type { logFailedSearch } from '@/lib/db/queries/failed-search';
import type {
  resolveAirportCodesWithLLM,
  resolveIATACode,
} from '@/lib/utils/airport-codes';
import type { createDuffelBookingSession } from '@/lib/utils/duffel-links';

export interface FlightSearchToolDependencies {
  searchSeatsAero: typeof searchSeatsAero;
  searchDuffel: typeof searchDuffel;
  searchDuffelFlexibleDates: typeof searchDuffelFlexibleDates;
  mapCabinClass: typeof mapCabinClass;
  getNearbyAirports: typeof getNearbyAirports;
  mergeSessionState: typeof mergeSessionState;
  resolveIATACode: typeof resolveIATACode;
  resolveAirportCodesWithLLM: typeof resolveAirportCodesWithLLM;
  createDuffelBookingSession: typeof createDuffelBookingSession;
  logFailedSearch: typeof logFailedSearch;
}
