import { Calendar, Plane } from 'lucide-react';
import type {
  FlexibleDateFlight,
  FlexibleDateResultsResponse,
} from '@/lib/types';

type FlexibleDateResultData = Partial<FlexibleDateResultsResponse> & {
  dateRange: { start: string; end: string };
  flights?: FlexibleDateFlight[];
};

interface FlexibleDateResultsProps {
  data: FlexibleDateResultData;
}

/**
 * Identify award results, including persisted legacy entries without a source.
 *
 * @param flight - Flexible-date flight to classify.
 * @returns True when the flight uses an award price.
 */
export function isFlexibleAwardFlight(flight: FlexibleDateFlight): boolean {
  return (
    flight.source === 'seats.aero' ||
    (flight.source !== 'duffel' && typeof flight.price === 'string')
  );
}

/**
 * Format a calendar date for the flexible-date result UI.
 *
 * @param value - ISO calendar date.
 * @param locale - Result locale.
 * @param options - Additional display options.
 * @returns Localized calendar date.
 */
export function formatFlexibleCalendarDate(
  value: string,
  locale: 'de' | 'en',
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Date(value).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'de-DE',
    { ...options, timeZone: 'UTC' },
  );
}

function formatTime(value: string | undefined, locale: 'de' | 'en'): string {
  if (!value) return 'N/A';
  return new Date(value).toLocaleTimeString(
    locale === 'en' ? 'en-US' : 'de-DE',
    { hour: '2-digit', minute: '2-digit' },
  );
}

function FlexibleDateFlightCard({
  flight,
  locale,
}: {
  flight: FlexibleDateFlight;
  locale: 'de' | 'en';
}) {
  const isAward = isFlexibleAwardFlight(flight);
  const awardPrice = typeof flight.price === 'string' ? flight.price : undefined;
  const cashPrice =
    typeof flight.price === 'object' && flight.price !== null
      ? flight.price
      : undefined;
  const priceDisplay = isAward
    ? awardPrice || 'N/A'
    : cashPrice?.total
      ? `${cashPrice.total} ${cashPrice.currency || 'EUR'}`
      : 'N/A';
  const departureAirport = isAward
    ? flight.outbound?.departure?.airport || flight.origin || 'N/A'
    : flight.departure?.airport || 'N/A';
  const arrivalAirport = isAward
    ? flight.outbound?.arrival?.airport || flight.destination || 'N/A'
    : flight.arrival?.airport || 'N/A';
  const departureTime = formatTime(
    isAward
      ? flight.outbound?.departure?.time
      : flight.departure?.time,
    locale,
  );
  const arrivalTime = formatTime(
    isAward ? flight.outbound?.arrival?.time : flight.arrival?.time,
    locale,
  );
  const airline = flight.airline || 'Unknown';
  const duration = isAward ? flight.outbound?.duration : flight.duration;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {flight.searchedDate && (
            <p className="mb-1 text-sm font-medium text-primary">
              {formatFlexibleCalendarDate(flight.searchedDate, locale, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{departureAirport}</span>
            <span className="text-muted-foreground">{departureTime}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{arrivalAirport}</span>
            <span className="text-muted-foreground">{arrivalTime}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Plane className="h-3 w-3" />
            <span>{airline}</span>
            {duration && <span>• {duration}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {flight.dateLabel && (
            <span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {flight.dateLabel}
            </span>
          )}
          <span
            className={`text-sm font-semibold ${
              isAward
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {priceDisplay}
          </span>
          <span className="text-xs text-muted-foreground">
            {isAward ? (locale === 'en' ? 'Miles' : 'Meilen') : 'Cash'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Render flexible-date award and cash results in separate ranked groups.
 *
 * @param props - Structured flexible-date response, including legacy results.
 * @returns Localized flexible-date result cards.
 */
export function FlexibleDateResults({ data }: FlexibleDateResultsProps) {
  const awardFlights = data.awardFlights ?? [];
  const cashFlights = data.cashFlights ?? [];
  const legacyFlights = data.flights ?? [];
  const locale: 'de' | 'en' = data.locale === 'en' ? 'en' : 'de';
  const labels = data.labels ?? {
    dateRangePrefix: 'Ergebnisse vom',
    dateRangeSeparator: 'bis',
    awardFlights: 'Flüge mit Meilen/Punkten',
    cashFlights: 'Flüge mit Barzahlung',
    truncated: 'Top 5 Ergebnisse pro Kategorie angezeigt (sortiert nach Preis)',
  };
  const renderGroup = (
    flights: FlexibleDateFlight[],
    keyPrefix: string,
  ) =>
    flights.map((flight, index) => (
      <FlexibleDateFlightCard
        key={flight.id || `${keyPrefix}-${index}`}
        flight={flight}
        locale={locale}
      />
    ));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>
          {labels.dateRangePrefix}{' '}
          {formatFlexibleCalendarDate(data.dateRange.start, locale)}{' '}
          {labels.dateRangeSeparator}{' '}
          {formatFlexibleCalendarDate(data.dateRange.end, locale)}
        </span>
      </div>
      {awardFlights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{labels.awardFlights}</h4>
          {renderGroup(awardFlights, 'award-flight')}
        </div>
      )}
      {cashFlights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{labels.cashFlights}</h4>
          {renderGroup(cashFlights, 'cash-flight')}
        </div>
      )}
      {legacyFlights.length > 0 && (
        <div className="space-y-3">
          {renderGroup(legacyFlights, 'flight')}
        </div>
      )}
      {(data.awardFlightsTruncated === true ||
        data.cashFlightsTruncated === true) && (
        <p className="text-center text-xs text-muted-foreground">
          {labels.truncated}
        </p>
      )}
    </div>
  );
}
