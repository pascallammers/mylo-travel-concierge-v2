import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchDuffel, searchDuffelFlexibleDates, mapCabinClass, getNearbyAirports, NearbyAirport } from '@/lib/api/duffel-client';
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
import { flightI18n, formatFlightResults, type FlightLocale } from './flight-search-format';

// Re-export for legacy callers and tests that import these from flight-search.
export { flightI18n, formatFlightResults };
export type { FlightLocale };

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

  execute: async (params, { abortSignal, experimental_context }) => {
    // Per-request context injected by streamText({ experimental_context }) in
    // app/api/search/route.ts. chatId is required for session-state tracking
    // and failed-search logging; tool_calls persistence itself lives in the
    // route's onStepFinish (centralized in commit 7e0305b).
    const ctx = (experimental_context ?? {}) as { chatId?: string; userId?: string };
    const chatId = ctx.chatId;
    const userId = ctx.userId ?? 'anonymous';

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

        // Log the failed search for monitoring (non-blocking, requires chatId).
        if (chatId) {
          try {
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

      // Update session state for follow-up turns ("noch günstiger?", "andere
      // Daten?"). Non-blocking — a missing chatId or transient DB error must
      // not fail the tool. tool_calls persistence is handled centrally by
      // onStepFinish in app/api/search/route.ts.
      if (chatId) {
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
      }

      // Format response for LLM (inject real booking-session creator;
      // flight-search-format keeps the renderer free of the server env graph)
      return await formatFlightResults(result, params, locale, createDuffelBookingSession);
    } catch (error) {
      console.error('[Flight Search] ❌ Error:', error);

      // Log failed search for monitoring (non-blocking). Catches exceptions
      // that bypass the normal no-results logging path. tool_calls failure
      // status is recorded centrally in onStepFinish.
      if (chatId) {
        try {
          await logFailedSearch({
            chatId,
            userId,
            queryText: `${params.origin} nach ${params.destination}`,
            extractedOrigin: params.origin, // raw — resolution may have failed
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
      }

      throw error;
    }
  },
});
