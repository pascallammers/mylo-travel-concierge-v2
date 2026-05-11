/**
 * Zod schema for borski's `data/points-valuations.json`.
 *
 * Each program has a `floor`, `ceiling`, and per-source breakdown across
 * 4 valuation publishers (TPG, UpgradedPoints, OneMileAtATime, ViewFromTheWing).
 *
 * Shape: `{ _meta, credit_card_points, airline_miles, hotel_points }`,
 * where each non-meta key maps program ID -> valuation entry.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/points-valuations
 */

import { z } from 'zod';
import { BorskiMetaSchema } from './transfer-partners';

/**
 * Per-source valuation breakdown. All four sources are optional; some
 * smaller programs (Brex, Diners) only have a subset.
 */
export const BorskiValuationSourcesSchema = z
  .object({
    tpg: z.number().nonnegative().optional(),
    up: z.number().nonnegative().optional(),
    omaat: z.number().nonnegative().optional(),
    vftw: z.number().nonnegative().optional(),
  })
  .passthrough();

export type BorskiValuationSources = z.infer<typeof BorskiValuationSourcesSchema>;

/**
 * A single program's valuation: floor (min/conservative) and ceiling
 * (max/optimistic) in cents per point, with per-source breakdown.
 *
 * Refines guard against borski drift: a deprecated/zeroed program with
 * floor=0/ceiling=0 would silently classify every redemption as "excellent"
 * in cpp-calculator (cpp >= ceiling=0 always passes the excellent branch).
 */
export const BorskiValuationEntrySchema = z
  .object({
    name: z.string(),
    floor: z.number().nonnegative(),
    ceiling: z.number().nonnegative(),
    sources: BorskiValuationSourcesSchema,
  })
  .refine((v) => v.ceiling > 0, {
    message: 'ceiling must be > 0 (zeroed valuations break tier classification)',
    path: ['ceiling'],
  })
  .refine((v) => v.floor <= v.ceiling, {
    message: 'floor must be <= ceiling',
    path: ['floor'],
  });

export type BorskiValuationEntry = z.infer<typeof BorskiValuationEntrySchema>;

/**
 * Map of program-id -> valuation entry. Used for credit-card-points,
 * airline-miles, and hotel-points sections.
 */
export const BorskiValuationsMapSchema = z.record(z.string(), BorskiValuationEntrySchema);

export type BorskiValuationsMap = z.infer<typeof BorskiValuationsMapSchema>;

/**
 * Top-level schema for `points-valuations.json`.
 */
export const BorskiPointsValuationsFileSchema = z.object({
  _meta: BorskiMetaSchema,
  credit_card_points: BorskiValuationsMapSchema,
  airline_miles: BorskiValuationsMapSchema,
  hotel_points: BorskiValuationsMapSchema,
});

export type BorskiPointsValuationsFile = z.infer<typeof BorskiPointsValuationsFileSchema>;
