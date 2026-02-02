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
    
    const departDate = new Date(params.departDate);
    if (departDate < today) {
      throw new Error(
        `Das Abflugdatum (${params.departDate}) liegt in der Vergangenheit. Bitte geben Sie ein zukünftiges Datum an. Heutiges Datum: ${today.toISOString().split('T')[0]}`
      );
    }

    if (params.returnDate) {
      const returnDate = new Date(params.returnDate);
      if (returnDate < today) {
        throw new Error(
          `Das Rückflugdatum (${params.returnDate}) liegt in der Vergangenheit. Bitte geben Sie ein zukünftiges Datum an.`
        );
      }
      if (returnDate < departDate) {
        throw new Error(
          `Das Rückflugdatum (${params.returnDate}) liegt vor dem Abflugdatum (${params.departDate}). Bitte überprüfen Sie die Daten.`
        );
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

      return `Ich brauche eine Klarstellung für ${clarifyType === 'origin' ? 'den Abflugort' : clarifyType === 'destination' ? 'das Ziel' : 'Abflug- und Zielort'}:

${clarifyMessage}

Bitte geben Sie mehr Details an, zum Beispiel das Land oder einen alternativen Flughafennamen.`;
    }

    // Extract codes or fall back to sync resolver
    const origin = resolution.origin?.code || resolveIATACode(params.origin);
    const destination = resolution.destination?.code || resolveIATACode(params.destination);

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
              message: `Fuer Ihre Suche am ${params.departDate} wurden keine Fluege gefunden. Moechten Sie auch +/- 3 Tage suchen?`,
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
              message: `Fuer Ihre Suchkriterien wurden leider keine Fluege gefunden.`,
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
              ? 'Die Flugsuche konnte keine Ergebnisse laden, da einige unserer Datenquellen vorübergehend nicht erreichbar sind.'
              : 'Keine Flüge gefunden. Versuchen Sie andere Daten.',
          searchParams: searchLinkParams,
          technicalDetails,
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
            dateLabel = 'Originaldatum';
          } else if (daysDiff < 0) {
            dateLabel = `${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? 'Tag' : 'Tage'} frueher`;
          } else {
            dateLabel = `${daysDiff} ${daysDiff === 1 ? 'Tag' : 'Tage'} spaeter`;
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
      return await formatFlightResults(result, params);
    } catch (error) {
      console.error('[Flight Search] ❌ Error:', error);

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
async function formatFlightResults(result: any, params: any): Promise<string> {
  const sections: string[] = [];
  const partialFailures: string[] = [];

  // Track partial failures for user notification
  if (result.seats.error && result.amadeus.count > 0) {
    partialFailures.push('Meilen/Punkte-Flüge');
  }
  if (result.amadeus.error && result.seats.count > 0) {
    partialFailures.push('Cash-Flüge');
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
    sections.push(`## Flüge mit Meilen/Punkten (${result.seats.count} Ergebnisse)\n`);
    sections.push(`| Nr. | Airline | Klasse | Preis | Abflug | Ankunft | Dauer | Stops | Sitze | Flugnummer |`);
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
    sections.push(`## Flüge mit Barzahlung (${result.cash.count} Ergebnisse)\n`);
    sections.push(`| Nr. | Airline | Preis | Abflug | Ankunft | Dauer | Stops | Buchen |`);
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
      const stops = flight.stops === 0 ? 'Nonstop' : `${flight.stops} Stop(s)`;
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
    const failedTypes = partialFailures.join(' und ');
    sections.push(
      `\n---\n\n_**Hinweis:** ${failedTypes} konnten nicht geladen werden. ` +
        `Für weitere Optionen können Sie die folgenden Links nutzen:_\n`
    );

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
    sections.push(
      `Leider wurden keine Flüge für Ihre Suche gefunden.\n\n` +
        `**Suchparameter:**\n` +
        `- Route: ${params.origin} → ${params.destination}\n` +
        `- Datum: ${params.departDate}\n` +
        `- Klasse: ${params.cabin}\n\n` +
        `Versuchen Sie:\n` +
        `- Andere Daten wählen\n` +
        `- Flexibilität erhöhen\n` +
        `- Alternative Airports prüfen\n`
    );
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
