import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchAmadeus } from '@/lib/api/amadeus-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries';
import { mergeSessionState } from '@/lib/db/queries';
import { resolveIATACode } from '@/lib/utils/airport-codes';

/**
 * Flight Search Tool - Searches both award flights (Seats.aero) and cash flights (Amadeus)
 */
export const flightSearchTool = tool({
  description: `Search for flights between any two cities or airports worldwide.

This tool automatically:
- Searches BOTH award flights (bookable with miles/points via Seats.aero) AND cash flights (via Amadeus)
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
      console.log('[Flight Search] 🔄 Calling Amadeus with:', { origin, destination, departDate: params.departDate, returnDate: params.returnDate, cabin: params.cabin });
      
      // 2. Parallel API calls
      const [seatsResult, amadeusResult] = await Promise.all([
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

        // Amadeus: Cash flights (skip if awardOnly)
        params.awardOnly
          ? Promise.resolve(null)
          : searchAmadeus({
              origin,
              destination,
              departureDate: params.departDate,
              returnDate: params.returnDate,
              travelClass: params.cabin,
              passengers: params.passengers,
              nonStop: params.nonStop,
            }).then((result) => {
              console.log('[Flight Search] Amadeus SUCCESS:', result ? `${result.length} flights` : 'null');
              return result;
            }).catch((err) => {
              console.error('[Flight Search] Amadeus FAILED:', err.message, err);
              return null;
            }),
      ]);

      // 3. Check if we have results
      const hasSeats = seatsResult && seatsResult.length > 0;
      const hasAmadeus = amadeusResult && amadeusResult.length > 0;

      if (!hasSeats && !hasAmadeus) {
        throw new Error(
          'Keine Flüge gefunden. Bitte versuchen Sie andere Daten oder Routen.'
        );
      }

      const result = {
        seats: {
          flights: seatsResult || [],
          count: seatsResult?.length || 0,
        },
        amadeus: {
          flights: amadeusResult || [],
          count: amadeusResult?.length || 0,
        },
        searchParams: params,
      };

      console.log('[Flight Search] Results:', {
        seatsCount: result.seats.count,
        amadeusCount: result.amadeus.count,
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
      return formatFlightResults(result, params);
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
function formatFlightResults(result: any, params: any): string {
  const sections: string[] = [];

  // Award Flights Section
  if (result.seats.count > 0) {
    sections.push(`## Award-Flüge (${result.seats.count} Ergebnisse)\n`);

    result.seats.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline} - ${flight.cabin}\n` +
          `**Preis:** ${flight.price}\n` +
          `**Abflug:** ${flight.outbound.departure.airport} um ${flight.outbound.departure.time}\n` +
          `**Ankunft:** ${flight.outbound.arrival.airport} um ${flight.outbound.arrival.time}\n` +
          `**Dauer:** ${flight.outbound.duration}\n` +
          `**Stops:** ${flight.outbound.stops}\n` +
          `**Verfügbare Sitze:** ${flight.seatsLeft || 'Unbekannt'}\n` +
          `**Flugnummern:** ${flight.outbound.flightNumbers}\n\n`
      );
    });
  }

  // Cash Flights Section
  if (result.amadeus.count > 0) {
    sections.push(`## Cash-Flüge (${result.amadeus.count} Ergebnisse)\n`);

    result.amadeus.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline}\n` +
          `**Preis:** ${flight.price.total} ${flight.price.currency}\n` +
          `**Abflug:** ${flight.departure.airport} um ${new Date(
            flight.departure.time
          ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\n` +
          `**Ankunft:** ${flight.arrival.airport} um ${new Date(
            flight.arrival.time
          ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\n` +
          `**Dauer:** ${flight.duration}\n` +
          `**Stops:** ${flight.stops === 0 ? 'Nonstop' : `${flight.stops} Stop(s)`}\n\n`
      );
    });
  }

  // No results
  if (result.seats.count === 0 && result.amadeus.count === 0) {
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
