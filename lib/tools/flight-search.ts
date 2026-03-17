import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchDuffel, searchDuffelFlexibleDates, mapCabinClass, getNearbyAirports, NearbyAirport } from '@/lib/api/duffel-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries';
import { mergeSessionState } from '@/lib/db/queries';
import { resolveIATACode, resolveAirportCodesWithLLM, type AirportResolutionResult } from '@/lib/utils/airport-codes';
import {
  buildGoogleFlightsUrl,
  buildSkyscannerUrl,
  FlightSearchLinkParams,
} from '@/lib/utils/flight-search-links';
import { createDuffelBookingSession } from '@/lib/utils/duffel-links';
import { formatGracefulFlightError, formatFlightErrorWithAlternatives, AlternativeAirport } from '@/lib/utils/tool-error-response';
import { logFailedSearch } from '@/lib/db/queries/failed-search';

type FlightLocale = 'de' | 'en';

const flightI18n = {
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
    de: '| Nr. | Airline | Klasse | Preis | Abflug | Ankunft | Dauer | Stops | Sitze | Flugnummer |',
    en: '| No. | Airline | Class | Price | Departure | Arrival | Duration | Stops | Seats | Flight No. |',
  },
  cashHeader: {
    de: (count: number) => `## Flüge mit Barzahlung (${count} Ergebnisse)\n`,
    en: (count: number) => `## Flights with Cash (${count} results)\n`,
  },
  cashTableHeader: {
    de: '| Nr. | Airline | Preis | Abflug | Ankunft | Dauer | Stops | Buchen |',
    en: '| No. | Airline | Price | Departure | Arrival | Duration | Stops | Book |',
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
 * Flight Search Tool - Searches both award flights (Seats.aero) and cash flights (Duffel)
 */
export const flightSearchTool = tool({
  description: `Search for flights between any two cities or airports worldwide.

This tool automatically:
- Searches BOTH award flights (bookable with miles/points via Seats.aero) AND cash flights (via Duffel)
- Converts city names to airport codes (e.g., "Frankfurt" → "FRA", "Phuket" → "HKT", "New York" → "JFK")
- Handles flexible date ranges and cabin class preferences
- Returns comprehensive pricing in both points/miles and cash

Call this tool immediately when the user asks about:
- Flight prices or availability between cities
- Business/First class travel or upgrades
- Award bookings with miles or points
- Comparing flight options
- Travel planning queries

You do NOT need to know IATA airport codes - just pass city names and the tool will handle conversion automatically.

Examples of queries that should trigger this tool:
- "Flights from Frankfurt to Phuket in Business Class"
- "How many miles do I need to fly to Tokyo?"
- "Show me the cheapest flights to Bangkok"
- "Find award flights from Berlin to New York"`,

  inputSchema: z.object({
    origin: z
      .string()
      .min(3)
      .describe('Origin city or airport (e.g., "Frankfurt", "Berlin", "FRA", or "New York"). City names will be auto-converted to airport codes.'),
    destination: z
      .string()
      .min(3)
      .describe('Destination city or airport (e.g., "Phuket", "Tokyo", "JFK", or "Bangkok"). City names will be auto-converted to airport codes.'),
    departDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Departure date in YYYY-MM-DD format'),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable()
      .describe('Return date in YYYY-MM-DD format (optional for round trip)'),
    cabin: z
      .enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
      .describe('Cabin class'),
    passengers: z
      .number()
      .int()
      .min(1)
      .max(9)
      .default(1)
      .describe('Number of passengers'),
    awardOnly: z
      .boolean()
      .default(false)
      .describe('Set to false (default) to search BOTH award and cash flights. Set to true ONLY when user explicitly asks for miles/points flights only.'),
    loyaltyPrograms: z
      .array(z.string())
      .optional()
      .describe('Preferred loyalty programs for award bookings'),
    flexibility: z
      .number()
      .int()
      .min(0)
      .max(3)
      .default(0)
      .describe('Date flexibility in days (0-3)'),
    nonStop: z.boolean().default(false).describe('Search only non-stop flights'),
    maxTaxes: z
      .number()
      .optional()
      .describe('Maximum taxes/fees for award flights (in USD)'),
  }),

  execute: async (params, { abortSignal, messages }) => {
    // Extract chatId from messages context
    const chatId = (messages as any)?.[0]?.chatId || 'unknown';

    console.log('[Flight Search] Starting search:', params);

    // Validate dates are not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for fair comparison
    
    // Detect locale from system prompt / message context (default: 'de' for backward compatibility)
    const locale: FlightLocale = 'de';

    const departDate = new Date(params.departDate);
    if (departDate < today) {
      throw new Error(
        flightI18n.pastDepartDate[locale](params.departDate, today.toISOString().split('T')[0])
      );
    }

    if (params.returnDate) {
      const returnDate = new Date(params.returnDate);
      if (returnDate < today) {
        throw new Error(flightI18n.pastReturnDate[locale](params.returnDate));
      }
      if (returnDate < departDate) {
        throw new Error(flightI18n.returnBeforeDepart[locale](params.returnDate, params.departDate));
      }
    }

    // Build full query for context-aware extraction
    const fullQuery = `${params.origin} nach ${params.destination}`;
    console.log('[Flight Search] Resolving airports from query:', fullQuery);

    const resolution = await resolveAirportCodesWithLLM(fullQuery);

    // Handle clarification needed
    if (resolution.needsClarification) {
      const clarifyType = resolution.needsClarification.type;
      const clarifyMessage = resolution.needsClarification.message;
      return flightI18n.clarification[locale](clarifyType, clarifyMessage);
    }

    // Extract codes or fall back to async database resolver
    const origin = resolution.origin?.code || await resolveIATACode(params.origin);
    const destination = resolution.destination?.code || await resolveIATACode(params.destination);

    if (!origin || !destination) {
      throw new Error(
        `Could not resolve airport codes. Origin: "${params.origin}" → ${origin}, Destination: "${params.destination}" → ${destination}`
      );
    }

    // Display extracted airports to user (per CONTEXT.md decision)
    const originDisplay = resolution.origin
      ? `${resolution.origin.name} (${resolution.origin.code})`
      : origin;
    const destinationDisplay = resolution.destination
      ? `${resolution.destination.name} (${resolution.destination.code})`
      : destination;

    console.log(`[Flight Search] Suche Fluege: ${originDisplay} -> ${destinationDisplay}`);

    // 1. Record tool call (non-blocking, don't let DB failures stop execution)
    let toolCallId: string | null = null;
    try {
      const result = await recordToolCall({
        chatId,
        toolName: 'search_flights',
        request: { ...params, origin, destination },
      });
      toolCallId = result.id;

      await updateToolCall(toolCallId, {
        status: 'running',
        startedAt: new Date(),
      });
      console.log('[Flight Search] ✓ DB logging enabled');
    } catch (dbError) {
      console.warn('[Flight Search] ⚠️ DB logging failed (continuing anyway):', dbError instanceof Error ? dbError.message : dbError);
      // Continue execution even if DB fails
    }

    try {
      // Detect flexible date search from query text (user clicked "Mit flexiblen Daten suchen")
      const isFlexibleDateSearch = fullQuery.includes('flexiblen Daten') || (params.flexibility && params.flexibility > 0);

      console.log('[Flight Search] 🔄 Calling Seats.aero with:', { origin, destination, departDate: params.departDate, cabin: params.cabin, isFlexible: isFlexibleDateSearch });
      console.log('[Flight Search] 🔄 Calling Duffel with:', { origin, destination, departDate: params.departDate, returnDate: params.returnDate, cabin: params.cabin, isFlexible: isFlexibleDateSearch });

      // 2. Parallel API calls
      const [seatsResult, duffelResult] = await Promise.all([
        // Seats.aero: Award flights (use flexibility: 3 for flexible date search)
        searchSeatsAero({
          origin,
          destination,
          departureDate: params.departDate,
          travelClass: params.cabin as TravelClass,
          flexibility: isFlexibleDateSearch ? 3 : params.flexibility,
          maxResults: isFlexibleDateSearch ? 15 : 5, // More results for flexible search
        }).then((result) => {
          console.log('[Flight Search] Seats.aero SUCCESS:', result ? `${result.length} flights` : 'null');
          return result;
        }).catch((err) => {
          console.error('[Flight Search] Seats.aero FAILED:', err.message, err);
          return null;
        }),

        // Duffel: Cash flights (use flexible date search for +/- 3 days)
        params.awardOnly
          ? Promise.resolve(null)
          : isFlexibleDateSearch
            ? searchDuffelFlexibleDates({
                origin,
                destination,
                departureDate: params.departDate,
                returnDate: params.returnDate,
                cabinClass: mapCabinClass(params.cabin),
                passengers: params.passengers,
                maxConnections: params.nonStop ? 0 : 2,
              }, 3).then((result) => {
                console.log('[Flight Search] Duffel Flexible SUCCESS:', result ? `${result.length} flights` : 'null');
                return result;
              }).catch((err) => {
                console.error('[Flight Search] Duffel Flexible FAILED:', err.message, err);
                return null;
              })
            : searchDuffel({
                origin,
                destination,
                departureDate: params.departDate,
                returnDate: params.returnDate,
                cabinClass: mapCabinClass(params.cabin),
                passengers: params.passengers,
                maxConnections: params.nonStop ? 0 : 2,
              }).then((result) => {
                console.log('[Flight Search] Duffel SUCCESS:', result ? `${result.length} flights` : 'null');
                return result;
              }).catch((err) => {
                console.error('[Flight Search] Duffel FAILED:', err.message, err);
                return null;
              }),
      ]);

      // 3. Check if we have results and track provider failures
      const hasSeats = seatsResult && seatsResult.length > 0;
      const hasDuffel = duffelResult && duffelResult.length > 0;
      
      // Track which providers failed (null means error, empty array means no results)
      const seatsError = seatsResult === null;
      const duffelError = duffelResult === null;

      // Build search params for fallback links
      const searchLinkParams: FlightSearchLinkParams = {
        origin,
        destination,
        departDate: params.departDate,
        returnDate: params.returnDate,
        cabin: params.cabin,
        passengers: params.passengers,
      };

      // Handle complete failure (no results from any provider)
      if (!hasSeats && !hasDuffel) {
        // Determine error type based on what failed
        const errorType = seatsError || duffelError ? 'provider_unavailable' : 'no_results';

        // Log the failed search for monitoring (non-blocking)
        try {
          const userId = (messages as any)?.[0]?.userId || 'anonymous';
          await logFailedSearch({
            chatId,
            userId,
            queryText: fullQuery,
            extractedOrigin: origin,
            extractedDestination: destination,
            departDate: params.departDate,
            returnDate: params.returnDate || undefined,
            cabin: params.cabin,
            resultCount: 0,
            errorType,
            errorMessage: seatsError && duffelError ? 'Both providers failed' : undefined,
          });
          console.log('[Flight Search] Logged failed search to database');
        } catch (logError) {
          console.warn('[Flight Search] Failed to log search failure (non-blocking):', logError);
        }

        // Only search for alternatives if this is a "no_results" case (not provider failure)
        if (errorType === 'no_results') {
          console.log('[Flight Search] No results found, checking fallback chain...');

          // Check if this is already a flexible date search (avoid infinite loop)
          // Detect via query text or flexibility param
          const isFlexibleSearch = fullQuery.includes('flexiblen Daten') || (params.flexibility && params.flexibility > 0);

          if (!isFlexibleSearch) {
            // STEP 1: First attempt - Offer flexible date search to user
            console.log('[Flight Search] Returning flexible date offer to user');

            return JSON.stringify({
              type: 'no_results_offer_flexible',
              message: flightI18n.noResultsFlexOffer[locale](params.departDate),
              originalSearch: {
                origin,
                destination,
                departureDate: params.departDate,
                returnDate: params.returnDate,
                passengers: params.passengers,
                cabinClass: params.cabin,
                originDisplay,
                destinationDisplay,
              },
            });
          }

          // STEP 2: If already flexible search with no results, try alternative airports (Phase 2 functionality)
          console.log('[Flight Search] Flexible search had no results, falling back to alternative airports...');

          // Determine which airport to find alternatives for
          // Heuristic: If origin is a major hub, likely destination had no flights
          // Otherwise, assume origin needs alternatives
          const majorHubs = ['LHR', 'FRA', 'CDG', 'AMS', 'JFK', 'LAX', 'DXB', 'SIN', 'HKG', 'NRT'];
          const emptyAirportCode = majorHubs.includes(origin) ? destination : origin;
          const emptyAirportType: 'origin' | 'destination' = majorHubs.includes(origin) ? 'destination' : 'origin';

          console.log(`[Flight Search] Looking for alternatives to ${emptyAirportType}: ${emptyAirportCode}`);

          // Get nearby alternatives
          const nearbyAirports = await getNearbyAirports(emptyAirportCode);

          console.log(`[Flight Search] Found ${nearbyAirports.length} nearby airports for ${emptyAirportCode}:`,
            nearbyAirports.map(a => `${a.code} (${a.driveTime})`).join(', '));

          if (nearbyAirports.length > 0) {
            // STEP 3: Return alternative airports if found
            const alternatives: AlternativeAirport[] = nearbyAirports.map(apt => ({
              code: apt.code,
              name: apt.name,
              city: apt.city,
              distance: apt.driveTime,
            }));

            // Build display name for the empty airport
            const emptyAirportDisplay = emptyAirportType === 'origin'
              ? originDisplay
              : destinationDisplay;

            // Return BOTH the formatted text AND structured data for UI rendering
            const formattedMessage = formatFlightErrorWithAlternatives({
              type: 'no_results',
              message: flightI18n.noResultsFound[locale],
              locale,
              alternatives,
              emptyAirport: emptyAirportType,
              originalAirportName: emptyAirportDisplay,
              searchParams: searchLinkParams,
            });

            console.log('[Flight Search] Returning alternatives response with interactive UI data');

            // Return structured response that can be rendered as interactive UI
            return JSON.stringify({
              type: 'no_results_with_alternatives',
              message: formattedMessage,
              alternatives: alternatives.map(alt => ({
                ...alt,
                originalAirport: emptyAirportCode,
                replaceType: emptyAirportType,
              })),
              originalSearch: {
                origin,
                destination,
                departureDate: params.departDate,
                returnDate: params.returnDate,
                passengers: params.passengers,
                cabinClass: params.cabin,
              },
            });
          }

          // STEP 4: No alternatives found - fall through to generic error
          console.log('[Flight Search] No nearby airports found, returning generic error');
        }

        // Provider failure or no alternatives - use existing error handling
        const technicalDetails =
          seatsError && duffelError
            ? 'Both Seats.aero and Duffel failed'
            : seatsError
              ? 'Seats.aero failed'
              : duffelError
                ? 'Duffel failed'
                : 'No flights matched search criteria';

        return formatGracefulFlightError({
          type: errorType,
          message:
            errorType === 'provider_unavailable'
              ? flightI18n.providerUnavailable[locale]
              : flightI18n.noFlightsShort[locale],
          searchParams: searchLinkParams,
          technicalDetails,
          locale,
        });
      }

      // Process flexible date results - return special response type for UI rendering
      if (isFlexibleDateSearch && (hasSeats || hasDuffel)) {
        console.log('[Flight Search] Processing flexible date results');

        // Merge all results
        const allFlights: any[] = [];

        // Add Seats.aero results with searchedDate from their departure info
        if (seatsResult) {
          seatsResult.forEach((flight: any) => {
            allFlights.push({
              ...flight,
              source: 'seats.aero',
              searchedDate: flight.outbound?.departure?.date || flight.departureDate || params.departDate,
            });
          });
        }

        // Add Duffel results (already have searchedDate from flexible search)
        if (duffelResult) {
          duffelResult.forEach((flight: any) => {
            allFlights.push({
              ...flight,
              source: 'duffel',
              searchedDate: flight.searchedDate || flight.departure?.time?.split('T')[0] || params.departDate,
            });
          });
        }

        console.log(`[Flight Search] Merged ${allFlights.length} flexible date flights`);

        // Add date metadata to each flight
        const flightsWithDateLabels = allFlights.map(flight => {
          const searchedDate = flight.searchedDate || params.departDate;
          const originalDate = new Date(params.departDate);
          const flightDate = new Date(searchedDate);
          const daysDiff = Math.round((flightDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));

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
            searchedDate,
            dateOffset: daysDiff,
            dateLabel,
          };
        });

        // Sort by price (lowest first) - per CONTEXT.md "Preis-Badge zeigt guenstigere Tage"
        flightsWithDateLabels.sort((a, b) => {
          // For Seats.aero, price is a string like "15,000 Miles"
          // For Duffel, price is an object { total: "123.45", currency: "EUR" }
          const getPriceValue = (flight: any): number => {
            if (flight.source === 'duffel' && flight.price?.total) {
              return parseFloat(flight.price.total);
            }
            if (flight.source === 'seats.aero' && flight.price) {
              // Extract numeric value from "15,000 Miles" format
              const match = String(flight.price).replace(/,/g, '').match(/[\d.]+/);
              return match ? parseFloat(match[0]) : 999999;
            }
            return 999999;
          };

          return getPriceValue(a) - getPriceValue(b);
        });

        // Limit to top 10 per CONTEXT.md
        const top10 = flightsWithDateLabels.slice(0, 10);

        console.log(`[Flight Search] Returning top ${top10.length} flexible date results`);

        // Calculate date range for display
        const startDate = new Date(params.departDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(params.departDate);
        endDate.setDate(endDate.getDate() + 3);

        return JSON.stringify({
          type: 'flexible_date_results',
          flights: top10,
          originalDate: params.departDate,
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
          },
        });
      }

      const result = {
        seats: {
          flights: seatsResult || [],
          count: seatsResult?.length || 0,
          error: seatsError,
        },
        cash: {
          flights: duffelResult || [],
          count: duffelResult?.length || 0,
          error: duffelError,
        },
        searchParams: params,
        searchLinkParams,
      };

      console.log('[Flight Search] Results:', {
        seatsCount: result.seats.count,
        cashCount: result.cash.count,
      });

      // 4. Update tool call status (if DB logging is enabled)
      if (toolCallId) {
        try {
          await updateToolCall(toolCallId, {
            status: 'succeeded',
            response: result,
            finishedAt: new Date(),
          });
        } catch (dbError) {
          console.warn('[Flight Search] ⚠️ Failed to update DB status (non-critical):', dbError instanceof Error ? dbError.message : dbError);
        }
      }

      // 5. Update session state (non-blocking - don't let this fail the tool)
      try {
        await mergeSessionState(chatId, {
          last_flight_request: {
            origin,
            destination,
            departDate: params.departDate,
            returnDate: params.returnDate,
            cabin: params.cabin,
            passengers: params.passengers,
            awardOnly: params.awardOnly,
            loyaltyPrograms: params.loyaltyPrograms,
          },
          pending_flight_request: null,
        });
      } catch (sessionError) {
        console.warn('[Flight Search] ⚠️ Failed to update session state (non-critical):', sessionError instanceof Error ? sessionError.message : sessionError);
      }

      // 6. Format response for LLM
      return await formatFlightResults(result, params, locale);
    } catch (error) {
      console.error('[Flight Search] ❌ Error:', error);

      // Log failed search for monitoring (non-blocking)
      // This catches exceptions that bypass the normal no-results logging
      try {
        const userId = (messages as any)?.[0]?.userId || 'anonymous';
        await logFailedSearch({
          chatId,
          userId,
          queryText: `${params.origin} nach ${params.destination}`,
          extractedOrigin: params.origin, // Use raw params since resolution may have failed
          extractedDestination: params.destination,
          departDate: params.departDate,
          returnDate: params.returnDate || undefined,
          cabin: params.cabin,
          resultCount: 0,
          errorType: 'exception',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        console.log('[Flight Search] 📊 Exception logged to failed_search_logs');
      } catch (logError) {
        console.warn('[Flight Search] ⚠️ Failed to log exception (non-critical):', logError instanceof Error ? logError.message : logError);
      }

      // Update DB status if logging is enabled
      if (toolCallId) {
        try {
          await updateToolCall(toolCallId, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          });
        } catch (dbError) {
          console.warn('[Flight Search] ⚠️ Failed to update DB error status (non-critical):', dbError instanceof Error ? dbError.message : dbError);
        }
      }

      throw error;
    }
  },
});

/**
 * Format flight results for LLM response
 */
async function formatFlightResults(result: any, params: any, locale: FlightLocale = 'de'): Promise<string> {
  const sections: string[] = [];
  const partialFailures: string[] = [];

  // Track partial failures for user notification
  if (result.seats.error && result.amadeus.count > 0) {
    partialFailures.push(flightI18n.awardFlightsLabel[locale]);
  }
  if (result.amadeus.error && result.seats.count > 0) {
    partialFailures.push(flightI18n.cashFlightsLabel[locale]);
  }

  // Try to create Duffel booking session for direct booking link
  let duffelBookingUrl: string | null = null;
  if (result.cash.count > 0) {
    try {
      const session = await createDuffelBookingSession({
        origin: result.cash.flights[0].departure.airport,
        destination: result.cash.flights[0].arrival.airport,
        departDate: params.departDate,
        returnDate: params.returnDate,
        passengers: params.passengers,
      });
      duffelBookingUrl = session.url;
    } catch (error) {
      // Duffel Links requires Duffel Payments to be enabled.
      // If session creation fails, we simply don't show the direct booking link.
      console.warn('[Flight Search] Duffel Links session creation failed (Duffel Payments may not be enabled):', error);
      duffelBookingUrl = null;
    }
  }

  // Award Flights Section - Table format
  if (result.seats.count > 0) {
    sections.push(flightI18n.awardHeader[locale](result.seats.count));
    sections.push(flightI18n.awardTableHeader[locale]);
    sections.push(`|-----|---------|--------|-------|--------|---------|-------|-------|-------|------------|`);

    result.seats.flights.forEach((flight: any, idx: number) => {
      const departTime = formatTime(flight.outbound.departure.time);
      const arriveTime = formatTime(flight.outbound.arrival.time);
      const seats = flight.seatsLeft || '-';
      
      sections.push(
        `| ${idx + 1} | ${flight.airline} | ${flight.cabin} | ${flight.price} | ${flight.outbound.departure.airport} ${departTime} | ${flight.outbound.arrival.airport} ${arriveTime} | ${flight.outbound.duration} | ${flight.outbound.stops} | ${seats} | ${flight.outbound.flightNumbers} |`
      );
    });
    sections.push('');
  }

  // Cash Flights Section - Table format
  if (result.cash.count > 0) {
    sections.push(flightI18n.cashHeader[locale](result.cash.count));
    sections.push(flightI18n.cashTableHeader[locale]);
    sections.push(`|-----|---------|-------|--------|---------|-------|-------|--------|`);

    result.cash.flights.forEach((flight: any, idx: number) => {
      // Extract departure date in YYYY-MM-DD format
      const departureDate = flight.departure.time.split('T')[0];
      
      // Build booking links for this specific flight
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

      // Build booking links string with Duffel as additional option
      const bookingLinks = duffelBookingUrl
        ? `[Google](${googleFlightsUrl}) [Skyscanner](${skyscannerUrl}) [Buchen](${duffelBookingUrl})`
        : `[Google](${googleFlightsUrl}) [Skyscanner](${skyscannerUrl})`;

      const departTime = new Date(flight.departure.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const arriveTime = new Date(flight.arrival.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const stops = flight.stops === 0 ? flightI18n.nonstop[locale] : flightI18n.stops[locale](flight.stops);
      const price = `${flight.price.total} ${flight.price.currency}`;

      sections.push(
        `| ${idx + 1} | ${flight.airline} | ${price} | ${flight.departure.airport} ${departTime} | ${flight.arrival.airport} ${arriveTime} | ${flight.duration} | ${stops} | ${bookingLinks} |`
      );
    });
    sections.push('');
  }

  // Note: External booking links are now included directly with each cash flight result
  // to provide immediate booking options for specific flights

  // Add partial failure notice if some providers failed
  if (partialFailures.length > 0 && (result.seats.count > 0 || result.cash.count > 0)) {
    const failedTypes = partialFailures.join(flightI18n.andConnector[locale]);
    sections.push(flightI18n.partialFailureNote[locale](failedTypes));

    // Add fallback links
    if (result.searchLinkParams) {
      const googleUrl = buildGoogleFlightsUrl(result.searchLinkParams);
      const skyscannerUrl = buildSkyscannerUrl(result.searchLinkParams);
      sections.push(`- [Google Flights](${googleUrl})`);
      sections.push(`- [Skyscanner](${skyscannerUrl})\n`);
    }
  }

  // No results case is now handled by formatGracefulFlightError before this function is called
  // This is kept as a safety fallback
  if (result.seats.count === 0 && result.cash.count === 0) {
    sections.push(flightI18n.noResultsFallback[locale](params.origin, params.destination, params.departDate, params.cabin));
  }

  return sections.join('\n');
}

/**
 * Format time string for table display
 * Handles both ISO strings and already formatted times
 */
function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === 'N/A') return '-';
  
  // If already in HH:MM format, return as is
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  
  // Try to parse as ISO date
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}
