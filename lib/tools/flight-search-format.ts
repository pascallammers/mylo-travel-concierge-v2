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

/** Route/date/cabin context passed to award-program booking URL resolvers. */
export type AwardBookingContext = {
  origin: string;
  destination: string;
  /** YYYY-MM-DD */
  departDate: string;
  cabin: string;
};

/** Injected award-program resolvers keep the renderer free of the registry import graph. */
export type AwardProgramResolvers = {
  getProgramDisplayName: (slug: string, locale: FlightLocale) => string;
  getProgramBookingUrl: (slug: string, ctx: AwardBookingContext) => string | null;
  getProgramCaveat: (slug: string, locale: FlightLocale) => string | null;
};

export interface TransferHintDependencies {
  getTransferSourcesForAwardProgram: (
    slug: string,
  ) => AwardProgramTransferSource[];
  formatTransferRatio: (partner: TransferPartner) => string;
}

export type FormatFlightResultsDeps = AwardProgramResolvers & {
  createBookingSession?: BookingSessionCreator;
  transferHints?: TransferHintDependencies;
};

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
  flexibleResultLabels: {
    de: {
      dateRangePrefix: 'Ergebnisse vom',
      dateRangeSeparator: 'bis',
      awardFlights: 'Flüge mit Meilen/Punkten',
      cashFlights: 'Flüge mit Barzahlung',
      truncated: 'Top 5 Ergebnisse pro Kategorie angezeigt (sortiert nach Preis)',
    },
    en: {
      dateRangePrefix: 'Results from',
      dateRangeSeparator: 'to',
      awardFlights: 'Flights with Miles/Points',
      cashFlights: 'Flights with Cash',
      truncated: 'Top 5 results per category shown (sorted by price)',
    },
  },
  awardHeader: {
    de: (count: number) => `## Flüge mit Meilen/Punkten (${count} Ergebnisse)\n`,
    en: (count: number) => `## Flights with Miles/Points (${count} results)\n`,
  },
  awardTableHeader: {
    de: '| Nr. | Airline | Programm | Klasse | Preis | Abflug | Ankunft | Dauer | Stops | Sitze | Flugnummer | Buchen |',
    en: '| No. | Airline | Program | Class | Price | Departure | Arrival | Duration | Stops | Seats | Flight No. | Book |',
  },
  awardOneWayNotice: {
    de: '_**Hinweis:** Die Meilenpreise gelten pro Strecke (nur Hinflug). Der Rückflug ist darin nicht enthalten._\n',
    en: '_**Note:** Mileage prices are per direction (outbound only). The return flight is not included._\n',
  },
  awardPerLegNotice: {
    de: '_**Hinweis:** Die Meilenpreise gelten jeweils pro Strecke._\n',
    en: '_**Note:** Mileage prices apply per leg._\n',
  },
  awardOutboundLegHeader: {
    de: (count: number) => `### Hinflug (${count} Ergebnisse)`,
    en: (count: number) => `### Outbound (${count} results)`,
  },
  awardReturnLegHeader: {
    de: (count: number) => `### Rückflug (${count} Ergebnisse)`,
    en: (count: number) => `### Return (${count} results)`,
  },
  awardNoOutboundAvailability: {
    de: '_Für den Hinflug wurde keine Award-Verfügbarkeit gefunden._',
    en: '_No award availability was found for the outbound leg._',
  },
  awardOutboundProviderUnavailable: {
    de: '_Die Award-Verfügbarkeit für den Hinflug konnte wegen einer vorübergehend nicht erreichbaren Datenquelle nicht geladen werden._',
    en: '_Award availability for the outbound leg could not be loaded because a data source is temporarily unavailable._',
  },
  bookLinkLabel: { de: 'Buchen', en: 'Book' },
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
 * Render an award table with booking links for one direction.
 *
 * @param flights - Award flights for a single direction.
 * @param locale - Locale for labels and program names.
 * @param params - Search parameters used as a date fallback.
 * @param resolvers - Injected program-name and booking-link resolvers.
 * @returns Markdown table lines.
 */
function renderAwardTable(
  flights: any[],
  locale: FlightLocale,
  params: any,
  resolvers: Pick<
    AwardProgramResolvers,
    'getProgramDisplayName' | 'getProgramBookingUrl'
  >,
): string[] {
  const rows = [
    flightI18n.awardTableHeader[locale],
    '|-----|---------|----------|-------|--------|---------|-------|-------|-------|-------|------------|--------|',
  ];

  flights.forEach((flight: any, index: number) => {
    const departTime = formatTime(flight.outbound.departure.time);
    const arriveTime = formatTime(flight.outbound.arrival.time);
    const seats = flight.seatsLeft || '-';
    const program = resolvers.getProgramDisplayName(flight.program, locale);
    const flightDate =
      (flight.outbound.departure.time || '').split('T')[0] || params.departDate;
    const bookingUrl = resolvers.getProgramBookingUrl(flight.program, {
      origin: flight.outbound.departure.airport,
      destination: flight.outbound.arrival.airport,
      departDate: flightDate,
      cabin: flight.cabin,
    });
    const bookCell = bookingUrl
      ? `[${flightI18n.bookLinkLabel[locale]}](${bookingUrl})`
      : '-';

    rows.push(
      `| ${index + 1} | ${flight.airline} | ${program} | ${flight.cabin} | ${flight.price} | ${flight.outbound.departure.airport} ${departTime} | ${flight.outbound.arrival.airport} ${arriveTime} | ${flight.outbound.duration} | ${flight.outbound.stops} | ${seats} | ${flight.outbound.flightNumbers} | ${bookCell} |`,
    );
  });

  return rows;
}

/**
 * Render transfer sources for every distinct award program.
 *
 * @param flights - Award flights from all rendered legs.
 * @param locale - Locale for labels and program names.
 * @param getProgramDisplayName - Injected program-name resolver.
 * @param dependencies - Transfer-engine helpers.
 * @returns Markdown list lines.
 */
function renderTransferSources(
  flights: ReadonlyArray<{ program?: string }>,
  locale: FlightLocale,
  getProgramDisplayName: AwardProgramResolvers['getProgramDisplayName'],
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

  return slugs.flatMap((slug) => {
    const sources = dependencies.getTransferSourcesForAwardProgram(slug);
    if (sources.length === 0) return [];

    const dach = sources.filter(
      ({ sourceProgramId }) => sourceProgramId === 'amex_dach',
    );
    const others = sources.filter(
      ({ sourceProgramId }) => sourceProgramId !== 'amex_dach',
    );
    const renderedSources = [...dach, ...others]
      .slice(0, 3)
      .map(({ sourceProgramLabel, partner }) => {
        const via =
          partner.type === 'other'
            ? ` ${flightI18n.transferHintVia[locale]} ${partner.name}`
            : '';
        return `${sourceProgramLabel[locale]}${via} ${dependencies.formatTransferRatio(partner)}`;
      })
      .join(', ');

    return [
      `- **${getProgramDisplayName(slug, locale)}**: ${renderedSources}`,
    ];
  });
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
 *
 * @param result - Combined award and cash search results.
 * @param params - Original flight-search parameters.
 * @param locale - Output locale.
 * @param deps - Injected booking, program, caveat, and transfer resolvers.
 * @returns LLM-facing Markdown.
 */
export async function formatFlightResults(
  result: any,
  params: any,
  locale: FlightLocale = 'de',
  deps: FormatFlightResultsDeps,
): Promise<string> {
  const {
    createBookingSession,
    getProgramDisplayName,
    getProgramBookingUrl,
    getProgramCaveat,
    transferHints,
  } = deps;
  const sections: string[] = [];
  const partialFailures: string[] = [];
  const returnAwardCount = result.seatsReturn?.count ?? 0;

  // Track partial failures for user notification.
  // result shape: { seats: {...}, cash: {...} }. cash = Duffel; seats = Seats.aero.
  // (Earlier versions had a third Amadeus provider — replaced by Duffel; the
  // partial-failure check still referenced the removed result.amadeus and
  // crashed formatFlightResults whenever search_flights ran.)
  if (result.seats.error && (result.cash.count > 0 || returnAwardCount > 0)) {
    partialFailures.push(flightI18n.awardFlightsLabel[locale]);
  }
  if (result.cash.error && (result.seats.count > 0 || returnAwardCount > 0)) {
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
  if (result.seats.count > 0 || returnAwardCount > 0) {
    sections.push(
      flightI18n.awardHeader[locale](result.seats.count + returnAwardCount),
    );

    if (returnAwardCount > 0) {
      sections.push(flightI18n.awardPerLegNotice[locale]);
      sections.push(flightI18n.awardOutboundLegHeader[locale](result.seats.count));
      if (result.seats.count > 0) {
        sections.push(
          ...renderAwardTable(result.seats.flights, locale, params, {
            getProgramDisplayName,
            getProgramBookingUrl,
          }),
        );
      } else {
        sections.push(
          result.seats.error
            ? flightI18n.awardOutboundProviderUnavailable[locale]
            : flightI18n.awardNoOutboundAvailability[locale],
        );
      }
      sections.push('');
      sections.push(flightI18n.awardReturnLegHeader[locale](returnAwardCount));
      sections.push(
        ...renderAwardTable(result.seatsReturn.flights, locale, params, {
          getProgramDisplayName,
          getProgramBookingUrl,
        }),
      );
    } else {
      if (params.returnDate) {
        sections.push(flightI18n.awardOneWayNotice[locale]);
      }
      sections.push(
        ...renderAwardTable(result.seats.flights, locale, params, {
          getProgramDisplayName,
          getProgramBookingUrl,
        }),
      );
    }
    sections.push('');

    // Website-hurdle footnotes (MYLO-17): only for programs that actually
    // appear in the result, one line per program, below the award table.
    const caveatPrograms = [
      ...new Set<string>(
        [
          ...result.seats.flights,
          ...(result.seatsReturn?.flights ?? []),
        ].map((flight: any) => flight.program),
      ),
    ];
    const caveatLines = caveatPrograms.flatMap((slug) => {
      const caveat = getProgramCaveat(slug, locale);
      return caveat
        ? [`_⚠️ **${getProgramDisplayName(slug, locale)}:** ${caveat}_`]
        : [];
    });
    if (caveatLines.length > 0) {
      sections.push(...caveatLines);
      sections.push('');
    }

    const awardFlights = [
      ...result.seats.flights,
      ...(result.seatsReturn?.flights ?? []),
    ];
    sections.push(flightI18n.transferHintIntro[locale]);
    sections.push(
      ...renderTransferSources(
        awardFlights,
        locale,
        getProgramDisplayName,
        transferHints,
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
  if (
    partialFailures.length > 0 &&
    (result.seats.count > 0 || result.cash.count > 0 || returnAwardCount > 0)
  ) {
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
  if (
    result.seats.count === 0 &&
    result.cash.count === 0 &&
    returnAwardCount === 0
  ) {
    sections.push(flightI18n.noResultsFallback[locale](params.origin, params.destination, params.departDate, params.cabin));
  }

  return sections.join('\n');
}
