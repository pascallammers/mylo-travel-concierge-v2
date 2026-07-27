/**
 * Merge/sort/cap path of the flexible date search (MYLO-20).
 *
 * Award flights (miles) and cash flights (EUR) are sorted and capped as
 * separate groups so the two price units never compete numerically.
 */

import { flightI18n, type FlightLocale } from './flight-search-format';
import type {
  FlexibleDateFlight,
  FlexibleDateResultsResponse,
} from '@/lib/types';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
import type { DuffelFlight } from '@/lib/api/duffel-client';

const MAX_AWARD_RESULTS = 5;
const MAX_CASH_RESULTS = 5;
const UNPRICED = Number.MAX_SAFE_INTEGER;

interface AwardFlexibleDateInput
  extends Partial<Omit<SeatsAeroFlight, 'outbound'>> {
  departureDate?: string;
  outbound?: {
    departure?: Partial<SeatsAeroFlight['outbound']['departure']> & {
      date?: string;
    };
    arrival?: Partial<SeatsAeroFlight['outbound']['arrival']>;
    duration?: string;
    stops?: string;
    flightNumbers?: string;
  };
}

interface CashFlexibleDateInput
  extends Partial<Omit<DuffelFlight, 'price' | 'departure' | 'arrival'>> {
  price?: Partial<DuffelFlight['price']>;
  searchedDate?: string;
  departure?: Partial<DuffelFlight['departure']>;
  arrival?: Partial<DuffelFlight['arrival']>;
}

function milesValue(flight: AwardFlexibleDateInput): number {
  if (!flight.price) return UNPRICED;
  const match = String(flight.price)
    .replace(/,/g, '')
    .match(/[\d.]+/);
  return match ? parseFloat(match[0]) : UNPRICED;
}

function cashValue(flight: CashFlexibleDateInput): number {
  const total = parseFloat(flight.price?.total ?? '');
  return Number.isFinite(total) ? total : UNPRICED;
}

type FlexibleDateMetadata = Pick<
  FlexibleDateFlight,
  'searchedDate' | 'dateOffset' | 'dateLabel'
>;

function withDateMetadata<T extends object>(
  flight: T,
  searchedDate: string,
  originalDate: string,
  locale: FlightLocale,
): T & FlexibleDateMetadata {
  const searchedTimestamp = new Date(searchedDate).getTime();
  const originalTimestamp = new Date(originalDate).getTime();
  const hasValidSearchedDate = Number.isFinite(searchedTimestamp);
  const daysDiff =
    hasValidSearchedDate && Number.isFinite(originalTimestamp)
      ? Math.round((searchedTimestamp - originalTimestamp) / (1000 * 60 * 60 * 24))
      : 0;

  let dateLabel: string;
  if (daysDiff === 0) {
    dateLabel = flightI18n.dateLabel.original[locale];
  } else if (daysDiff < 0) {
    dateLabel = flightI18n.dateLabel.earlier[locale](Math.abs(daysDiff));
  } else {
    dateLabel = flightI18n.dateLabel.later[locale](daysDiff);
  }

  return {
    ...flight,
    searchedDate: hasValidSearchedDate ? searchedDate : originalDate,
    dateOffset: daysDiff,
    dateLabel,
  };
}

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Build independently sorted and capped award/cash flexible-date groups.
 *
 * @param seatsFlights - Award results returned by seats.aero.
 * @param duffelFlights - Cash results returned by Duffel.
 * @param params - Original flight-search departure date.
 * @param locale - Locale used for relative date labels.
 * @returns Structured flexible-date results with explicit truncation metadata.
 */
export function buildFlexibleDateResults(
  seatsFlights: AwardFlexibleDateInput[] | null,
  duffelFlights: CashFlexibleDateInput[] | null,
  params: { departDate: string },
  locale: FlightLocale,
): FlexibleDateResultsResponse {
  const awardFlightsTruncated = (seatsFlights?.length ?? 0) > MAX_AWARD_RESULTS;
  const cashFlightsTruncated = (duffelFlights?.length ?? 0) > MAX_CASH_RESULTS;
  const awardFlights = (seatsFlights ?? [])
    .map((flight) =>
      withDateMetadata(
        { ...flight, source: 'seats.aero' as const },
        flight.outbound?.departure?.date || flight.departureDate || params.departDate,
        params.departDate,
        locale,
      ),
    )
    .sort((a, b) => milesValue(a) - milesValue(b))
    .slice(0, MAX_AWARD_RESULTS);

  const cashFlights = (duffelFlights ?? [])
    .map((flight) =>
      withDateMetadata(
        { ...flight, source: 'duffel' as const },
        flight.searchedDate || flight.departure?.time?.split('T')[0] || params.departDate,
        params.departDate,
        locale,
      ),
    )
    .sort((a, b) => cashValue(a) - cashValue(b))
    .slice(0, MAX_CASH_RESULTS);

  return {
    type: 'flexible_date_results',
    awardFlights,
    cashFlights,
    awardFlightsTruncated,
    cashFlightsTruncated,
    originalDate: params.departDate,
    dateRange: {
      start: shiftDate(params.departDate, -3),
      end: shiftDate(params.departDate, 3),
    },
  };
}
