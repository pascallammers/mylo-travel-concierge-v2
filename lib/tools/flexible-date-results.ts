/**
 * Merge/sort/cap path of the flexible date search (MYLO-20).
 *
 * Award flights (miles) and cash flights (EUR) are sorted and capped as
 * separate groups so the two price units never compete numerically.
 */

import { flightI18n, type FlightLocale } from './flight-search-format';

const MAX_AWARD_RESULTS = 5;
const MAX_CASH_RESULTS = 5;

const UNPRICED = Number.MAX_SAFE_INTEGER;

function milesValue(flight: any): number {
  if (!flight.price) return UNPRICED;
  // Seats.aero prices are strings like "15,000 Miles" or "18,750 miles + USD 328.33"
  const match = String(flight.price)
    .replace(/,/g, '')
    .match(/[\d.]+/);
  return match ? parseFloat(match[0]) : UNPRICED;
}

function cashValue(flight: any): number {
  // Duffel prices are objects like { total: "414.76", currency: "EUR" }
  const total = parseFloat(flight.price?.total);
  return Number.isFinite(total) ? total : UNPRICED;
}

function withDateMetadata(flight: any, searchedDate: string, originalDate: string, locale: FlightLocale) {
  const daysDiff = Math.round(
    (new Date(searchedDate).getTime() - new Date(originalDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  let dateLabel: string;
  if (daysDiff === 0) {
    dateLabel = flightI18n.dateLabel.original[locale];
  } else if (daysDiff < 0) {
    dateLabel = flightI18n.dateLabel.earlier[locale](Math.abs(daysDiff));
  } else {
    dateLabel = flightI18n.dateLabel.later[locale](daysDiff);
  }

  return { ...flight, searchedDate, dateOffset: daysDiff, dateLabel };
}

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function buildFlexibleDateResults(
  seatsFlights: any[] | null,
  duffelFlights: any[] | null,
  params: { departDate: string },
  locale: FlightLocale,
) {
  const awardFlights = (seatsFlights ?? [])
    .map((flight) =>
      withDateMetadata(
        { ...flight, source: 'seats.aero' },
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
        { ...flight, source: 'duffel' },
        flight.searchedDate || flight.departure?.time?.split('T')[0] || params.departDate,
        params.departDate,
        locale,
      ),
    )
    .sort((a, b) => cashValue(a) - cashValue(b))
    .slice(0, MAX_CASH_RESULTS);

  return {
    type: 'flexible_date_results' as const,
    awardFlights,
    cashFlights,
    originalDate: params.departDate,
    dateRange: {
      start: shiftDate(params.departDate, -3),
      end: shiftDate(params.departDate, 3),
    },
  };
}
