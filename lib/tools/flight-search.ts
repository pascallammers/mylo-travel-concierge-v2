import { tool } from 'ai';
import { z } from 'zod';
import { searchSeatsAero, TravelClass } from '@/lib/api/seats-aero-client';
import { searchAmadeus } from '@/lib/api/amadeus-client';
import { recordToolCall, updateToolCall } from '@/lib/db/queries';
import { mergeSessionState } from '@/lib/db/queries';

/**
 * Flight Search Tool - Searches both award flights (Seats.aero) and cash flights (Amadeus)
 */
export const flightSearchTool = tool({
  description: `Search for flights using Seats.aero (award flights) and Amadeus (cash flights).
  
This tool searches both:
- Seats.aero: Award flights bookable with miles/points
- Amadeus: Regular cash flights

Results include pricing, availability, and booking details.`,

  inputSchema: z.object({
    origin: z
      .string()
      .length(3)
      .toUpperCase()
      .describe('Origin airport IATA code (3 letters, e.g., FRA)'),
    destination: z
      .string()
      .length(3)
      .toUpperCase()
      .describe('Destination airport IATA code (3 letters, e.g., JFK)'),
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
      .default(true)
      .describe('Search only award flights (true) or include cash flights (false)'),
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

    // 1. Record tool call
    const { id: toolCallId } = await recordToolCall({
      chatId,
      toolName: 'search_flights',
      request: params,
    });

    await updateToolCall(toolCallId, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // 2. Parallel API calls
      const [seatsResult, amadeusResult] = await Promise.all([
        // Seats.aero: Award flights
        searchSeatsAero({
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departDate,
          travelClass: params.cabin as TravelClass,
          flexibility: params.flexibility,
          maxResults: 5,
        }).catch((err) => {
          console.warn('[Flight Search] Seats.aero failed:', err.message);
          return null;
        }),

        // Amadeus: Cash flights (skip if awardOnly)
        params.awardOnly
          ? Promise.resolve(null)
          : searchAmadeus({
              origin: params.origin,
              destination: params.destination,
              departureDate: params.departDate,
              returnDate: params.returnDate,
              travelClass: params.cabin,
              passengers: params.passengers,
              nonStop: params.nonStop,
            }).catch((err) => {
              console.warn('[Flight Search] Amadeus failed:', err.message);
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

      // 4. Update tool call status
      await updateToolCall(toolCallId, {
        status: 'succeeded',
        response: result,
        finishedAt: new Date(),
      });

      // 5. Update session state
      await mergeSessionState(chatId, {
        last_flight_request: {
          origin: params.origin,
          destination: params.destination,
          departDate: params.departDate,
          returnDate: params.returnDate,
          cabin: params.cabin,
          passengers: params.passengers,
          awardOnly: params.awardOnly,
          loyaltyPrograms: params.loyaltyPrograms,
        },
        pending_flight_request: null,
      });

      // 6. Format response for LLM
      return formatFlightResults(result, params);
    } catch (error) {
      console.error('[Flight Search] Error:', error);

      await updateToolCall(toolCallId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      });

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
