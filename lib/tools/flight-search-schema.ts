import { z } from 'zod';

/** Shared input contract used by the flight-search tool and schema tests. */
export const flightSearchInputSchema = z.object({
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
    .describe('Loyalty programs to filter award results to (e.g. "Aeroplan", "Miles & More"). Award flights from other programs are hidden. If the requested program has no availability, all programs are returned together with a note.'),
  flexibility: z
    .number()
    .int()
    .min(0)
    .max(3)
    .default(0)
    .describe('Date flexibility in days (0-3)'),
  nonStop: z.boolean().default(false).describe('Search only non-stop flights (applied to both award and cash searches)'),
  maxTaxes: z
    .number()
    .min(0)
    .optional()
    .describe('Maximum taxes/fees for award flights, compared against USD/EUR tax amounts. Award flights with taxes in other currencies are kept and flagged in a note instead of being silently dropped.'),
});
