import type {
  AwardFilterLocale,
  AwardFilterOptions,
  AwardFilterResult,
} from '@/lib/api/award-search/award-filters';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';

/** Award-filter fields exposed by the flight-search tool schema. */
export interface FlightSearchAwardFilterParams {
  /** Loyalty programs to restrict award results to. */
  loyaltyPrograms?: string[];
  /** Maximum comparable taxes/fees (USD/EUR only). */
  maxTaxes?: number;
}

export type AwardFilterImplementation = (
  flights: SeatsAeroFlight[],
  options: AwardFilterOptions,
) => AwardFilterResult;

/**
 * Map flight-search parameters to the award-filter contract.
 *
 * @param flights - Award flights returned by seats.aero.
 * @param params - Filter-related parameters from the flight-search tool.
 * @param locale - Locale used for explanatory filter notes.
 * @param filterAwards - Injected award-filter implementation.
 * @returns Filtered award flights and any user-facing notes.
 */
export function filterFlightSearchAwards(
  flights: SeatsAeroFlight[],
  params: FlightSearchAwardFilterParams,
  locale: AwardFilterLocale,
  filterAwards: AwardFilterImplementation,
): AwardFilterResult {
  return filterAwards(flights, {
    loyaltyPrograms: params.loyaltyPrograms,
    maxTaxes: params.maxTaxes,
    locale,
  });
}
