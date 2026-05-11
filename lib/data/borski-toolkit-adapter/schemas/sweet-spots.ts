/**
 * Zod schema for borski's `data/sweet-spots.json`.
 *
 * Shape: `{ _meta, booking_windows, flights[], hotels[], surcharge_guide }`.
 * Sweet spots are high-value redemptions with route-keyed mileage costs.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/sweet-spots
 */

import { z } from 'zod';
import { BorskiMetaSchema } from './transfer-partners';

/**
 * Per-airline booking-window entry inside `booking_windows.by_airline`.
 */
export const BorskiBookingWindowEntrySchema = z.object({
  days: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export type BorskiBookingWindowEntry = z.infer<typeof BorskiBookingWindowEntrySchema>;

/**
 * Booking-windows block: how far in advance airlines release award space.
 */
export const BorskiBookingWindowsSchema = z
  .object({
    _description: z.string().optional(),
    general_rule: z.string().optional(),
    by_airline: z.record(z.string(), BorskiBookingWindowEntrySchema).optional(),
  })
  .passthrough();

/**
 * A single route inside a sweet-spot's `routes` map.
 *
 * Keys vary (e.g. `us_east_to_japan`, `europe_to_japan`). We model values only.
 */
export const BorskiSweetSpotRouteSchema = z.object({
  miles: z.number().nonnegative(),
  direction: z.enum(['one-way', 'round-trip']).optional(),
});

export type BorskiSweetSpotRoute = z.infer<typeof BorskiSweetSpotRouteSchema>;

/**
 * Booking instructions/tips for a sweet spot.
 */
export const BorskiSweetSpotBookingSchema = z
  .object({
    search_availability: z.string().optional(),
    book_via: z.string().optional(),
    online_booking: z.boolean().optional(),
    hold_policy: z.string().optional(),
    tips: z.array(z.string()).optional(),
  })
  .passthrough();

/**
 * A flight sweet spot: program, airline, cabin, route-keyed mileage cost,
 * surcharge estimate, and which credit-card programs can transfer in.
 */
export const BorskiFlightSweetSpotSchema = z.object({
  name: z.string(),
  tier: z.enum(['legendary', 'excellent', 'good']).or(z.string()),
  program: z.string(),
  airline: z.string(),
  alliance: z.string().nullable().optional(),
  cabin: z.string(),
  routes: z.record(z.string(), BorskiSweetSpotRouteSchema),
  surcharges: z.string().optional(),
  surcharge_estimate: z.string().optional(),
  why: z.string().optional(),
  transfer_partners: z.array(z.string()).optional(),
  capital_one_note: z.string().optional(),
  booking: BorskiSweetSpotBookingSchema.optional(),
});

export type BorskiFlightSweetSpot = z.infer<typeof BorskiFlightSweetSpotSchema>;

/**
 * A hotel sweet spot. Hotel-specific fields kept loose since not all entries
 * are present in every hotel sweet spot.
 */
export const BorskiHotelSweetSpotSchema = z
  .object({
    name: z.string(),
    program: z.string().optional(),
    chain: z.string().optional(),
    why: z.string().optional(),
  })
  .passthrough();

export type BorskiHotelSweetSpot = z.infer<typeof BorskiHotelSweetSpotSchema>;

/**
 * Top-level schema for `sweet-spots.json`.
 */
export const BorskiSweetSpotsFileSchema = z
  .object({
    _meta: BorskiMetaSchema,
    booking_windows: BorskiBookingWindowsSchema.optional(),
    flights: z.array(BorskiFlightSweetSpotSchema),
    hotels: z.array(BorskiHotelSweetSpotSchema).optional(),
    surcharge_guide: z.unknown().optional(),
  })
  .passthrough();

export type BorskiSweetSpotsFile = z.infer<typeof BorskiSweetSpotsFileSchema>;
