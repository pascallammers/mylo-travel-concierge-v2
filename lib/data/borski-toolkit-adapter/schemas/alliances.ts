/**
 * Zod schema for borski's `data/alliances.json`.
 *
 * Shape: `{ _meta, star_alliance, oneworld, skyteam }` with each alliance
 * holding a `members[]` list of airline objects.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/alliances
 */

import { z } from 'zod';
import { BorskiMetaSchema } from './transfer-partners';

/**
 * One member airline within an alliance.
 */
export const BorskiAllianceMemberSchema = z
  .object({
    airline: z.string(),
    iata: z.string().length(2).optional(),
    country: z.string().optional(),
    loyalty_program: z.string().optional(),
    hubs: z.array(z.string()).optional(),
    founding_member: z.boolean().optional(),
  })
  .passthrough();

export type BorskiAllianceMember = z.infer<typeof BorskiAllianceMemberSchema>;

/**
 * One alliance entry: founding year + members[].
 */
export const BorskiAllianceEntrySchema = z.object({
  founded: z.number().int(),
  members: z.array(BorskiAllianceMemberSchema),
});

export type BorskiAllianceEntry = z.infer<typeof BorskiAllianceEntrySchema>;

/**
 * Top-level schema for `alliances.json`.
 *
 * `passthrough()` preserves extra top-level keys borski ships
 * (`key_booking_relationships`, `non_alliance_notable`) instead of
 * silently dropping them on load.
 */
export const BorskiAlliancesFileSchema = z
  .object({
    _meta: BorskiMetaSchema,
    star_alliance: BorskiAllianceEntrySchema,
    oneworld: BorskiAllianceEntrySchema,
    skyteam: BorskiAllianceEntrySchema,
  })
  .passthrough();

export type BorskiAlliancesFile = z.infer<typeof BorskiAlliancesFileSchema>;
