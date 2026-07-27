import {
  applyAwardFilters,
  type AwardFilterLocale,
  type AwardFilterResult,
} from '@/lib/api/award-search/award-filters';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';

export interface FlightSearchAwardFilterParams {
  loyaltyPrograms?: string[];
  maxTaxes?: number;
}

/**
 * Map flight-search parameters to the award-filter contract.
 *
 * @param flights - Award flights returned by seats.aero.
 * @param params - Filter-related parameters from the flight-search tool.
 * @param locale - Locale used for explanatory filter notes.
 * @returns Filtered award flights and any user-facing notes.
 */
export function filterFlightSearchAwards(
  flights: SeatsAeroFlight[],
  params: FlightSearchAwardFilterParams,
  locale: AwardFilterLocale,
): AwardFilterResult {
  return applyAwardFilters(flights, {
    loyaltyPrograms: params.loyaltyPrograms,
    maxTaxes: params.maxTaxes,
    locale,
  });
}
