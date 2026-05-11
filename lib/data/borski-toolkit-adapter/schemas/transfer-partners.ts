/**
 * Zod schema for borski's `data/transfer-partners.json`.
 *
 * Shape (top-level): `{ _meta, <issuer_id>: { display_name, airlines, hotels } }`.
 * Each partner under `airlines`/`hotels` is `{ program, ratio }` where `ratio`
 * is `points_out per 1 point_in` (e.g. 1.0 = 1:1, 0.8 = 5:4).
 *
 * Issuer IDs observed: `bilt`, `amex_mr`, `chase_ur`, `capital_one`, `citi_ty`, `wells_fargo`.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/transfer-partners
 */

import { z } from 'zod';

/**
 * Metadata block shared by most borski JSON files.
 */
export const BorskiMetaSchema = z
  .object({
    last_updated: z.string().optional(),
    description: z.string().optional(),
    sources: z.unknown().optional(),
    staleness_days: z.number().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

/**
 * A single transfer partner entry. `ratio` is the conversion factor
 * (points_out / point_in). 1.0 = 1:1, 0.8 = 5:4 (you lose 20%).
 *
 * `note` and `transfer_time` are present on a subset of entries (~36 of
 * ~115 partners as of 2026-04-06). `passthrough()` preserves any further
 * fields borski may add upstream so they survive the load step.
 */
export const BorskiTransferPartnerSchema = z
  .object({
    program: z.string(),
    ratio: z.number().nonnegative(),
    note: z.string().optional(),
    transfer_time: z.string().optional(),
  })
  .passthrough();

export type BorskiTransferPartner = z.infer<typeof BorskiTransferPartnerSchema>;

/**
 * One issuer (e.g. Amex MR, Chase UR) and its airline/hotel partners.
 */
export const BorskiTransferIssuerSchema = z.object({
  display_name: z.string(),
  airlines: z.record(z.string(), BorskiTransferPartnerSchema),
  hotels: z.record(z.string(), BorskiTransferPartnerSchema),
});

export type BorskiTransferIssuer = z.infer<typeof BorskiTransferIssuerSchema>;

/**
 * Top-level schema for `transfer-partners.json`.
 *
 * `_meta` is required; every other key is treated as an issuer ID.
 */
export const BorskiTransferPartnersFileSchema = z
  .object({
    _meta: BorskiMetaSchema,
  })
  .catchall(BorskiTransferIssuerSchema);

export type BorskiTransferPartnersFile = z.infer<typeof BorskiTransferPartnersFileSchema>;
