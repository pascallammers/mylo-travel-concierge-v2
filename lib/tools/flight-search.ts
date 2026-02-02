import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchDuffel, mapCabinClass } from '@/lib/api/duffel-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries';
import { mergeSessionState } from '@/lib/db/queries';
import { resolveIATACode } from '@/lib/utils/airport-codes';
import {
  buildGoogleFlightsUrl,
  buildSkyscannerUrl,
  FlightSearchLinkParams,
} from '@/lib/utils/flight-search-links';
import { createDuffelBookingSession } from '@/lib/utils/duffel-links';
import { formatGracefulFlightError } from '@/lib/utils/tool-error-response';

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

    // Resolve city names to IATA codes
    const origin = resolveIATACode(params.origin);
    const destination = resolveIATACode(params.destination);

    if (!origin || !destination) {
      throw new Error(
        `Could not resolve airport codes. Origin: "${params.origin}" → ${origin}, Destination: "${params.destination}" → ${destination}`
      );
    }

    console.log(`[Flight Search] Resolved: ${params.origin} → ${origin}, ${params.destination} → ${destination}`);

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
      console.log('[Flight Search] 🔄 Calling Seats.aero with:', { origin, destination, departDate: params.departDate, cabin: params.cabin });
      console.log('[Flight Search] 🔄 Calling Duffel with:', { origin, destination, departDate: params.departDate, returnDate: params.returnDate, cabin: params.cabin });

      // 2. Parallel API calls
      const [seatsResult, duffelResult] = await Promise.all([
        // Seats.aero: Award flights
        searchSeatsAero({
          origin,
          destination,
          departureDate: params.departDate,
          travelClass: params.cabin as TravelClass,
          flexibility: params.flexibility,
          maxResults: 5,
        }).then((result) => {
          console.log('[Flight Search] Seats.aero SUCCESS:', result ? `${result.length} flights` : 'null');
          return result;
        }).catch((err) => {
          console.error('[Flight Search] Seats.aero FAILED:', err.message, err);
          return null;
        }),

        // Duffel: Cash flights (skip if awardOnly)
        params.awardOnly
          ? Promise.resolve(null)
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
        const technicalDetails =
          seatsError && duffelError
            ? 'Both Seats.aero and Duffel failed'
            : seatsError
              ? 'Seats.aero failed'
              : duffelError
                ? 'Duffel failed'
                : 'No flights matched search criteria';

        // Return graceful error message instead of throwing
        return formatGracefulFlightError({
          type: errorType,
          message:
            errorType === 'provider_unavailable'
              ? 'Die Flugsuche konnte keine Ergebnisse laden, da einige unserer Datenquellen vorübergehend nicht erreichbar sind.'
              : 'Für Ihre Suchkriterien wurden leider keine Flüge gefunden.',
          searchParams: searchLinkParams,
          technicalDetails,
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
