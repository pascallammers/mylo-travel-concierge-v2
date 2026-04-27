/**
 * Zod schema for borski's `data/hotel-chains.json`.
 *
 * Shape: `{ _meta, chains, quick_lookup }`. `chains` is a map of
 * chain-id -> { loyalty_program, total_brands, tiers, transfer_from, ... }.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/hotel-chains
 */

import { z } from 'zod';
import { BorskiMetaSchema } from './transfer-partners';

/**
 * Brand-tier breakdown inside a hotel chain (luxury/premium/select/etc.).
 * Keys vary across chains so we keep it loose.
 */
export const BorskiHotelChainTiersSchema = z.record(z.string(), z.array(z.string()));

export type BorskiHotelChainTiers = z.infer<typeof BorskiHotelChainTiersSchema>;

/**
 * Floor/ceiling cents-per-point valuation for a hotel program.
 */
export const BorskiHotelPointsValueSchema = z.object({
  floor: z.number().nonnegative(),
  ceiling: z.number().nonnegative(),
});

export type BorskiHotelPointsValue = z.infer<typeof BorskiHotelPointsValueSchema>;

/**
 * A single hotel chain (Marriott, Hilton, Hyatt, IHG, etc.).
 */
export const BorskiHotelChainSchema = z
  .object({
    loyalty_program: z.string(),
    total_brands: z.number().int().nonnegative().optional(),
    tiers: BorskiHotelChainTiersSchema.optional(),
    transfer_from: z.array(z.string()).optional(),
    award_perks: z.array(z.string()).optional(),
    points_value_cpp: BorskiHotelPointsValueSchema.optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type BorskiHotelChain = z.infer<typeof BorskiHotelChainSchema>;

/**
 * Top-level schema for `hotel-chains.json`.
 */
export const BorskiHotelChainsFileSchema = z.object({
  _meta: BorskiMetaSchema,
  chains: z.record(z.string(), BorskiHotelChainSchema),
  quick_lookup: z.unknown().optional(),
});

export type BorskiHotelChainsFile = z.infer<typeof BorskiHotelChainsFileSchema>;
