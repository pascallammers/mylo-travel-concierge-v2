/**
 * Pure render layer for the flight-search tool.
 *
 * Split from lib/tools/flight-search.ts so unit tests can exercise the LLM
 * markdown contract (source columns, verbatim links, "direct booking
 * unavailable" hint) without pulling in the server-only DB-queries import
 * graph that the tool entry-point requires.
 */

import {
  buildGoogleFlightsUrl,
  buildSkyscannerUrl,
} from '@/lib/utils/flight-search-links';
import { getProgramDisplayName } from '@/lib/api/award-search/program-registry';
import type {
  AwardProgramTransferSource,
  TransferPartner,
} from '@/lib/config/transfer-engine';

// Booking-session creator is injected to keep the renderer free of the
// server-env import graph. The tool entry-point passes the real
// createDuffelBookingSession; unit tests pass a stub.
export type BookingSessionCreator = (params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  passengers: number;
}) => Promise<{ url: string }>;

export type FlightLocale = 'de' | 'en';

export interface TransferHintDependencies {
  getTransferSourcesForAwardProgram: (
    slug: string,
  ) => AwardProgramTransferSource[];
  formatTransferRatio: (partner: TransferPartner) => string;
}

export const flightI18n = {
  pastDepartDate: {
    de: (date: string, today: string) =>
      `Das Abflugdatum (${date}) liegt in der Vergangenheit. Bitte geben Sie ein zukünftiges Datum an. Heutiges Datum: ${today}`,
    en: (date: string, today: string) =>
      `The departure date (${date}) is in the past. Please provide a future date. Today's date: ${today}`,
  },
  pastReturnDate: {
    de: (date: string) =>
      `Das Rückflugdatum (${date}) liegt in der Vergangenheit. Bitte geben Sie ein zukünftiges Datum an.`,
    en: (date: string) =>
      `The return date (${date}) is in the past. Please provide a future date.`,
  },
  returnBeforeDepart: {
    de: (returnDate: string, departDate: string) =>
      `Das Rückflugdatum (${returnDate}) liegt vor dem Abflugdatum (${departDate}). Bitte überprüfen Sie die Daten.`,
    en: (returnDate: string, departDate: string) =>
      `The return date (${returnDate}) is before the departure date (${departDate}). Please check the dates.`,
  },
  clarification: {
    de: (type: string, message: string) =>
      `Ich brauche eine Klarstellung für ${type === 'origin' ? 'den Abflugort' : type === 'destination' ? 'das Ziel' : 'Abflug- und Zielort'}:\n\n${message}\n\nBitte geben Sie mehr Details an, zum Beispiel das Land oder einen alternativen Flughafennamen.`,
    en: (type: string, message: string) =>
      `I need clarification for ${type === 'origin' ? 'the origin' : type === 'destination' ? 'the destination' : 'origin and destination'}:\n\n${message}\n\nPlease provide more details, such as the country or an alternative airport name.`,
  },
  noResultsFlexOffer: {
    de: (date: string) =>
      `Fuer Ihre Suche am ${date} wurden keine Fluege gefunden. Moechten Sie auch +/- 3 Tage suchen?`,
    en: (date: string) =>
      `No flights found for your search on ${date}. Would you like to search +/- 3 days as well?`,
  },
  noDirectFlights: {
    de: (airport: string) => `Leider keine direkten Flüge ab ${airport}.`,
    en: (airport: string) => `Unfortunately no direct flights from ${airport}.`,
  },
  nearbyAirports: {
    de: 'Diese Flughäfen sind in der Nähe:',
    en: 'These airports are nearby:',
  },
  clickToRepeat: {
    de: 'Klicken Sie auf einen Flughafen, um die Suche zu wiederholen.',
    en: 'Click on an airport to repeat the search.',
  },
  providerUnavailable: {
    de: 'Die Flugsuche konnte keine Ergebnisse laden, da einige unserer Datenquellen vorübergehend nicht erreichbar sind.',
    en: 'The flight search could not load results because some of our data sources are temporarily unavailable.',
  },
  noFlightsShort: {
    de: 'Keine Flüge gefunden. Versuchen Sie andere Daten.',
    en: 'No flights found. Try different dates.',
  },
  noResultsFound: {
    de: 'Fuer Ihre Suchkriterien wurden leider keine Fluege gefunden.',
    en: 'Unfortunately no flights were found for your search criteria.',
  },
  dateLabel: {
    original: { de: 'Originaldatum', en: 'Original date' },
    earlier: {
      de: (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'} frueher`,
      en: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} earlier`,
    },
    later: {
      de: (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'} spaeter`,
      en: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} later`,
    },
  },
  awardHeader: {
    de: (count: number) => `## Flüge mit Meilen/Punkten (${count} Ergebnisse)\n`,
    en: (count: number) => `## Flights with Miles/Points (${count} results)\n`,
  },
  awardTableHeader: {
    de: '| Nr. | Airline | Programm | Klasse | Preis | Abflug | Ankunft | Dauer | Stops | Sitze | Flugnummer |',
    en: '| No. | Airline | Program | Class | Price | Departure | Arrival | Duration | Stops | Seats | Flight No. |',
  },
  cashHeader: {
    de: (count: number) => `## Flüge mit Barzahlung (${count} Ergebnisse)\n`,
    en: (count: number) => `## Flights with Cash (${count} results)\n`,
  },
  cashTableHeader: {
    de: '| Nr. | Airline | Preis | Abflug | Ankunft | Dauer | Stops | Buchen |',
    en: '| No. | Airline | Price | Departure | Arrival | Duration | Stops | Book |',
  },
  directBookingUnavailable: {
    de: 'Keine Direktbuchung verfügbar',
    en: 'Direct booking unavailable',
  },
  nonstop: { de: 'Nonstop', en: 'Nonstop' },
  stops: {
    de: (n: number) => `${n} Stop(s)`,
    en: (n: number) => `${n} stop(s)`,
  },
  partialFailureNote: {
    de: (types: string) =>
      `\n---\n\n_**Hinweis:** ${types} konnten nicht geladen werden. Für weitere Optionen können Sie die folgenden Links nutzen:_\n`,
    en: (types: string) =>
      `\n---\n\n_**Note:** ${types} could not be loaded. For more options you can use the following links:_\n`,
  },
  // The community "Jonas" case: users read the miles column as a balance they
  // must already own and dismiss award options entirely. The hint states the
  // opposite — miles are usually sourced via credit-card/hotel-points transfer
  // when booking (MYLO-22).
  transferHintIntro: {
    de: '_**Hinweis:** Diese Meilen musst du noch nicht haben — der Transfer von Kreditkarten- oder Hotelpunkten ist erst bei der Buchung nötig._',
    en: "_**Note:** You don't need to have these miles yet — transferring credit-card or hotel points is only necessary when you book._",
  },
  transferHintVia: { de: 'über', en: 'via' },
  awardFlightsLabel: { de: 'Meilen/Punkte-Flüge', en: 'Miles/points flights' },
  cashFlightsLabel: { de: 'Cash-Flüge', en: 'Cash flights' },
  noResultsFallback: {
    de: (origin: string, dest: string, date: string, cabin: string) =>
      `Leider wurden keine Flüge für Ihre Suche gefunden.\n\n**Suchparameter:**\n- Route: ${origin} → ${dest}\n- Datum: ${date}\n- Klasse: ${cabin}\n\nVersuchen Sie:\n- Andere Daten wählen\n- Flexibilität erhöhen\n- Alternative Airports prüfen\n`,
    en: (origin: string, dest: string, date: string, cabin: string) =>
      `Unfortunately no flights were found for your search.\n\n**Search parameters:**\n- Route: ${origin} → ${dest}\n- Date: ${date}\n- Class: ${cabin}\n\nTry:\n- Choose different dates\n- Increase flexibility\n- Check alternative airports\n`,
  },
  andConnector: { de: ' und ', en: ' and ' },
} as const;

/**
 * Format time string for table display.
 * Handles both ISO strings and already formatted times.
 */
function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === 'N/A') return '-';

  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;

  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

/**
 * Render "- **<Program>**: <source> <ratio>, ..." lines for every distinct
 * award program in the results that a card program transfers into (MYLO-22).
 *
 * Sources come straight from the transfer-engine config. The DACH Amex source
 * is pinned first (MYLO's home market) even though US programs often transfer
 * at a better rate; the rest follow best-rate-first, capped at 3 in total.
 * Partner entries typed 'other' are indirect routes (PAYBACK -> Miles & More)
 * and get a "via <partner>" marker so they don't read as direct transfers.
 */
function renderTransferSources(
  flights: ReadonlyArray<{ program?: string }>,
  locale: FlightLocale,
  dependencies?: TransferHintDependencies,
): string[] {
  if (!dependencies) return [];

  const slugs = [
    ...new Set(
      flights
        .map(({ program }) => program)
        .filter((program): program is string => Boolean(program)),
    ),
  ];
  const lines: string[] = [];

  for (const slug of slugs) {
    const sources = dependencies.getTransferSourcesForAwardProgram(slug);
    if (sources.length === 0) continue;

    const dach = sources.filter((s) => s.sourceProgramId === 'amex_dach');
    const others = sources.filter((s) => s.sourceProgramId !== 'amex_dach');
    const rendered = [...dach, ...others]
      .slice(0, 3)
      .map((s) => {
        const via =
          s.partner.type === 'other'
            ? ` ${flightI18n.transferHintVia[locale]} ${s.partner.name}`
            : '';
        return `${s.sourceProgramLabel[locale]}${via} ${dependencies.formatTransferRatio(s.partner)}`;
      })
      .join(', ');

    lines.push(`- **${getProgramDisplayName(slug, locale)}**: ${rendered}`);
  }

  return lines;
}

/**
 * Format flight results for LLM response.
 *
 * Internal provider names ("Seats.aero" / "Duffel") must never be rendered to
 * end users. The section heading gives the user-facing category instead.
 *
 * When the Duffel booking session cannot be created (e.g. Duffel Payments
 * disabled), the row emits an explicit "Direct booking unavailable" hint
 * instead of leaving silent space the LLM will pad with a fabricated link
 * (Test 1 produced [Duffel API](https://duffel.com)).
 */
export async function formatFlightResults(
  result: any,
  params: any,
  locale: FlightLocale = 'de',
  createBookingSession?: BookingSessionCreator,
  transferHintDependencies?: TransferHintDependencies,
): Promise<string> {
  const sections: string[] = [];
  const partialFailures: string[] = [];

  // Track partial failures for user notification.
  // result shape: { seats: {...}, cash: {...} }. cash = Duffel; seats = Seats.aero.
  // (Earlier versions had a third Amadeus provider — replaced by Duffel; the
  // partial-failure check still referenced the removed result.amadeus and
  // crashed formatFlightResults whenever search_flights ran.)
  if (result.seats.error && result.cash.count > 0) {
    partialFailures.push(flightI18n.awardFlightsLabel[locale]);
  }
  if (result.cash.error && result.seats.count > 0) {
    partialFailures.push(flightI18n.cashFlightsLabel[locale]);
  }

  // Try to create Duffel booking session for direct booking link.
  // When no creator is injected (or it throws), we skip — the per-row hint
  // path will render "Direct booking unavailable" instead.
  let duffelBookingUrl: string | null = null;
  if (result.cash.count > 0 && createBookingSession) {
    try {
      const session = await createBookingSession({
        origin: result.cash.flights[0].departure.airport,
        destination: result.cash.flights[0].arrival.airport,
        departDate: params.departDate,
        returnDate: params.returnDate,
        passengers: params.passengers,
      });
      duffelBookingUrl = session.url;
    } catch (error) {
      console.warn(
        '[Flight Search] Duffel Links session creation failed (Duffel Payments may not be enabled):',
        error,
      );
      duffelBookingUrl = null;
    }
  }

  // Award Flights Section
  if (result.seats.count > 0) {
    sections.push(flightI18n.awardHeader[locale](result.seats.count));
    sections.push(flightI18n.awardTableHeader[locale]);
    sections.push(`|-----|---------|----------|-------|--------|---------|-------|-------|-------|-------|------------|`);

    result.seats.flights.forEach((flight: any, idx: number) => {
      const departTime = formatTime(flight.outbound.departure.time);
      const arriveTime = formatTime(flight.outbound.arrival.time);
      const seats = flight.seatsLeft || '-';
      // Resolve the seats.aero program slug to a customer-facing brand name.
      // The slug ("aeroplan") is the bookable mileage currency; the operating
      // carrier in `airline` ("LH") is shown separately.
      const program = getProgramDisplayName(flight.program, locale);

      sections.push(
        `| ${idx + 1} | ${flight.airline} | ${program} | ${flight.cabin} | ${flight.price} | ${flight.outbound.departure.airport} ${departTime} | ${flight.outbound.arrival.airport} ${arriveTime} | ${flight.outbound.duration} | ${flight.outbound.stops} | ${seats} | ${flight.outbound.flightNumbers} |`,
      );
    });
    sections.push('');
    sections.push(flightI18n.transferHintIntro[locale]);
    sections.push(
      ...renderTransferSources(
        result.seats.flights,
        locale,
        transferHintDependencies,
      ),
    );
    sections.push('');
  }

  // Cash Flights Section
  if (result.cash.count > 0) {
    sections.push(flightI18n.cashHeader[locale](result.cash.count));
    sections.push(flightI18n.cashTableHeader[locale]);
    sections.push(`|-----|---------|-------|--------|---------|-------|-------|--------|`);

    result.cash.flights.forEach((flight: any, idx: number) => {
      const departureDate = flight.departure.time.split('T')[0];

      const googleFlightsUrl = buildGoogleFlightsUrl({
        origin: flight.departure.airport,
        destination: flight.arrival.airport,
        departDate: departureDate,
        returnDate: params.returnDate,
        cabin: params.cabin,
        passengers: params.passengers,
      });

      const skyscannerUrl = buildSkyscannerUrl({
        origin: flight.departure.airport,
        destination: flight.arrival.airport,
        departDate: departureDate,
        returnDate: params.returnDate,
        cabin: params.cabin,
        passengers: params.passengers,
      });

      const bookingLinks = duffelBookingUrl
        ? `[Google](${googleFlightsUrl}) [Skyscanner](${skyscannerUrl}) [Buchen](${duffelBookingUrl})`
        : `[Google](${googleFlightsUrl}) [Skyscanner](${skyscannerUrl}) — ${flightI18n.directBookingUnavailable[locale]}`;

      const departTime = new Date(flight.departure.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const arriveTime = new Date(flight.arrival.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const stops = flight.stops === 0 ? flightI18n.nonstop[locale] : flightI18n.stops[locale](flight.stops);
      const price = `${flight.price.total} ${flight.price.currency}`;

      sections.push(
        `| ${idx + 1} | ${flight.airline} | ${price} | ${flight.departure.airport} ${departTime} | ${flight.arrival.airport} ${arriveTime} | ${flight.duration} | ${stops} | ${bookingLinks} |`,
      );
    });
    sections.push('');
  }

  // Add partial failure notice if some providers failed
  if (partialFailures.length > 0 && (result.seats.count > 0 || result.cash.count > 0)) {
    const failedTypes = partialFailures.join(flightI18n.andConnector[locale]);
    sections.push(flightI18n.partialFailureNote[locale](failedTypes));

    if (result.searchLinkParams) {
      const googleUrl = buildGoogleFlightsUrl(result.searchLinkParams);
      const skyscannerUrl = buildSkyscannerUrl(result.searchLinkParams);
      sections.push(`- [Google Flights](${googleUrl})`);
      sections.push(`- [Skyscanner](${skyscannerUrl})\n`);
    }
  }

  // Safety fallback (no-results path is normally handled upstream)
  if (result.seats.count === 0 && result.cash.count === 0) {
    sections.push(flightI18n.noResultsFallback[locale](params.origin, params.destination, params.departDate, params.cabin));
  }

  return sections.join('\n');
}
