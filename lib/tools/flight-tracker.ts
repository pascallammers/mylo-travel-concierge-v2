import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

type FlightStatus = 'scheduled' | 'active' | 'landed';

const amadeusTokenSchema = z.object({ access_token: z.string().min(1) }).passthrough();

const timingSchema = z
  .object({
    qualifier: z.string().min(1),
    value: z.string().min(1),
  })
  .passthrough();

const flightPointSchema = z
  .object({
    iataCode: z.string().min(3),
    departure: z
      .object({
        timings: z.array(timingSchema).optional(),
        terminal: z.unknown().optional(),
        gate: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    arrival: z
      .object({
        timings: z.array(timingSchema).optional(),
        terminal: z.unknown().optional(),
        gate: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const amadeusFlightSchema = z
  .object({
    scheduledDepartureDate: z.string().min(1),
    flightPoints: z.array(flightPointSchema).min(2),
    legs: z
      .array(
        z
          .object({
            scheduledLegDuration: z.string().optional(),
            aircraftEquipment: z.object({ aircraftType: z.string().optional() }).passthrough().optional(),
          })
          .passthrough()
      )
      .optional(),
    segments: z
      .array(
        z
          .object({
            partnership: z
              .object({
                operatingFlight: z
                  .object({
                    carrierCode: z.string().min(1),
                    flightNumber: z.number(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough()
              .optional(),
            scheduledSegmentDuration: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

const amadeusScheduleResponseSchema = z
  .object({
    data: z.array(amadeusFlightSchema).optional(),
  })
  .passthrough();

function getAmadeusBaseUrl(): string {
  return serverEnv.AMADEUS_ENV === 'prod' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractCodeLike(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (!isRecord(value)) return null;

  const candidates: Array<unknown> = [
    value.code,
    value.name,
    value.value,
    value.terminal,
    value.gate,
    value.mainGate,
    value.number,
  ];

  for (const candidate of candidates) {
    const extracted = extractCodeLike(candidate);
    if (extracted) return extracted;
  }

  return null;
}

function pickTimingValue(
  timings: Array<{ qualifier: string; value: string }>,
  preferredQualifiers: readonly string[],
  options?: { fallbackToFirst?: boolean }
): string | null {
  for (const qualifier of preferredQualifiers) {
    const match = timings.find((t) => t.qualifier === qualifier);
    if (match?.value) return match.value;
  }
  if (options?.fallbackToFirst === false) return null;
  return timings[0]?.value ?? null;
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffMinutes(later: Date | null, earlier: Date | null): number | null {
  if (!later || !earlier) return null;
  const diff = Math.round((later.getTime() - earlier.getTime()) / 60000);
  return Number.isFinite(diff) ? diff : null;
}

function extractTimezoneOffset(iso: string | null): string {
  if (!iso) return 'UTC';
  const match = iso.match(/([+-]\d{2}:\d{2})$/);
  return match?.[1] ?? 'UTC';
}

function deriveFlightStatus(params: {
  now: Date;
  departureBest: Date | null;
  arrivalBest: Date | null;
  arrivalActual: Date | null;
}): FlightStatus {
  const { now, departureBest, arrivalBest, arrivalActual } = params;

  if (arrivalActual) return 'landed';

  if (departureBest && arrivalBest) {
    if (now >= departureBest && now <= arrivalBest) return 'active';
    if (now > arrivalBest) return 'landed';
  }

  if (departureBest && now >= departureBest) return 'active';

  return 'scheduled';
}

export const flightTrackerTool = tool({
  description: 'Track flight information and status using airline code and flight number',
  inputSchema: z.object({
    carrierCode: z.string().describe('The 2-letter airline carrier code (e.g., UL for SriLankan Airlines)'),
    flightNumber: z.string().describe('The flight number without carrier code (e.g., 604)'),
    scheduledDepartureDate: z.string().describe('The scheduled departure date in YYYY-MM-DD format (e.g., 2025-07-01)'),
  }),
  execute: async ({
    carrierCode,
    flightNumber,
    scheduledDepartureDate,
  }: {
    carrierCode: string;
    flightNumber: string;
    scheduledDepartureDate: string;
  }) => {
    const baseUrl = getAmadeusBaseUrl();

    const tokenResponse = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: serverEnv.AMADEUS_API_KEY,
        client_secret: serverEnv.AMADEUS_API_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Amadeus token request failed: ${text}`);
    }

    const tokenJson: unknown = await tokenResponse.json();
    const tokenData = amadeusTokenSchema.parse(tokenJson);
    const accessToken = tokenData.access_token;

    try {
      const response = await fetch(
        `${baseUrl}/v2/schedule/flights?carrierCode=${carrierCode}&flightNumber=${flightNumber}&scheduledDepartureDate=${scheduledDepartureDate}`,
        {
          headers: {
            Accept: 'application/vnd.amadeus+json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Amadeus API error: ${response.status} ${response.statusText}`);
      }

      const responseJson: unknown = await response.json();
      const parsed = amadeusScheduleResponseSchema.parse(responseJson);
      const flights = parsed.data ?? [];

      if (flights.length > 0) {
        const flight = flights[0];
        const points = flight.flightPoints;
        const departurePoint = points[0];
        const arrivalPoint = points[points.length - 1];

        const depTimings = departurePoint.departure?.timings ?? [];
        const arrTimings = arrivalPoint.arrival?.timings ?? [];

        const depScheduled = pickTimingValue(depTimings, ['STD']);
        const depEstimatedOrActual = pickTimingValue(depTimings, ['ATD', 'ETD'], { fallbackToFirst: false });
        const depBest = depEstimatedOrActual ?? depScheduled ?? null;

        const arrScheduled = pickTimingValue(arrTimings, ['STA']);
        const arrActual = pickTimingValue(arrTimings, ['ATA'], { fallbackToFirst: false });
        const arrEstimated = pickTimingValue(arrTimings, ['ETA'], { fallbackToFirst: false });
        const arrBest = arrActual ?? arrEstimated ?? arrScheduled ?? null;

        const depDelay = diffMinutes(safeDate(depEstimatedOrActual), safeDate(depScheduled));
        const arrDelay = diffMinutes(safeDate(arrEstimated ?? arrActual), safeDate(arrScheduled));

        const now = new Date(Date.now());
        const flightStatus = deriveFlightStatus({
          now,
          departureBest: safeDate(depBest),
          arrivalBest: safeDate(arrBest),
          arrivalActual: safeDate(arrActual),
        });

        return {
          data: [
            {
              flight_date: flight.scheduledDepartureDate,
              flight_status: flightStatus,
              departure: {
                airport: departurePoint.iataCode,
                timezone: extractTimezoneOffset(depBest),
                iata: departurePoint.iataCode,
                terminal: extractCodeLike(departurePoint.departure?.terminal),
                gate: extractCodeLike(departurePoint.departure?.gate),
                delay: depDelay,
                // Use best-known time (ATD/ETD/STD) so the UI reflects live updates
                scheduled: depBest ?? depScheduled ?? scheduledDepartureDate,
              },
              arrival: {
                airport: arrivalPoint.iataCode,
                timezone: extractTimezoneOffset(arrBest),
                iata: arrivalPoint.iataCode,
                terminal: extractCodeLike(arrivalPoint.arrival?.terminal),
                gate: extractCodeLike(arrivalPoint.arrival?.gate),
                delay: arrDelay,
                // Use best-known time (ATA/ETA/STA) so the UI reflects live updates
                scheduled: arrBest ?? arrScheduled ?? scheduledDepartureDate,
              },
              airline: {
                name: carrierCode,
                iata: carrierCode,
              },
              flight: {
                number: flightNumber,
                iata: `${carrierCode}${flightNumber}`,
                duration: flight.legs?.[0]?.scheduledLegDuration
                  ? (() => {
                      const duration = flight.legs?.[0]?.scheduledLegDuration;
                      if (!duration) return null;
                      const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
                      if (matches) {
                        const hours = parseInt(matches[1] || '0');
                        const minutes = parseInt(matches[2] || '0');
                        return hours * 60 + minutes;
                      }
                      return null;
                    })()
                  : null,
              },
              amadeus_data: {
                aircraft_type: flight.legs?.[0]?.aircraftEquipment?.aircraftType,
                operating_flight: flight.segments?.[0]?.partnership?.operatingFlight,
                segment_duration: flight.segments?.[0]?.scheduledSegmentDuration,
              },
            },
          ],
          amadeus_response: parsed,
        };
      }

      return { data: [], error: 'No flight data found' };
    } catch (error) {
      console.error('Flight tracking error:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Flight tracking failed',
      };
    }
  },
});
