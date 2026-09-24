import type { DirectTiering } from '@/lib/flights/direct-tiering';
/**
 * Merge/sort/cap path of the flexible date search (MYLO-20).
 *
 * Award flights (miles) and cash flights (EUR) are sorted and capped as
 * separate groups so the two price units never compete numerically.
 */

import { formatAwardQuotaNotice, type AwardSearchFailure } from '@/lib/flights/award-search';
import type { FlightLocale } from './flight-search-format';
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

export interface FlexibleDateResultI18n {
  dateLabel: {
    original: Record<FlightLocale, string>;
    earlier: Record<FlightLocale, (days: number) => string>;
    later: Record<FlightLocale, (days: number) => string>;
  };
  flexibleResultLabels: Record<
    FlightLocale,
    FlexibleDateResultsResponse['labels']
  >;
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
  i18n: FlexibleDateResultI18n,
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
    dateLabel = i18n.dateLabel.original[locale];
  } else if (daysDiff < 0) {
    dateLabel = i18n.dateLabel.earlier[locale](Math.abs(daysDiff));
  } else {
    dateLabel = i18n.dateLabel.later[locale](daysDiff);
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
 * @param i18n - Injected label formatters for the selected locale.
 * @param awardFailure - Failure category and reset time for the award search.
 * @param direct - Optional direct tier and visible fallback notice.
 * @returns Structured flexible-date results with explicit truncation metadata.
 */
export function buildFlexibleDateResults(
  seatsFlights: AwardFlexibleDateInput[] | null,
  duffelFlights: CashFlexibleDateInput[] | null,
  params: { departDate: string },
  locale: FlightLocale,
  i18n: FlexibleDateResultI18n,
  awardFailure?: AwardSearchFailure,
  direct?: { tiering: DirectTiering | null; notice: string | null },
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
        i18n,
      ),
    )
    .sort((a, b) => {
      const tier = direct?.tiering ? Number(a.totalStops !== 0) - Number(b.totalStops !== 0) : 0;
      return tier || milesValue(a) - milesValue(b);
    })
    .slice(0, MAX_AWARD_RESULTS);

  const cashFlights = (duffelFlights ?? [])
    .map((flight) =>
      withDateMetadata(
        { ...flight, source: 'duffel' as const },
        flight.searchedDate || flight.departure?.time?.split('T')[0] || params.departDate,
        params.departDate,
        locale,
        i18n,
      ),
    )
    .sort((a, b) => cashValue(a) - cashValue(b))
    .slice(0, MAX_CASH_RESULTS);

  const awardNotice = [
    awardFailure?.errorType === 'rate_limited' ? formatAwardQuotaNotice(awardFailure.resetsAt, locale) : null,
    direct?.notice,
  ].filter(Boolean).join(' ');
  return {
    type: 'flexible_date_results',
    ...(awardNotice ? { awardNotice } : {}),
    locale,
    labels: i18n.flexibleResultLabels[locale],
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
