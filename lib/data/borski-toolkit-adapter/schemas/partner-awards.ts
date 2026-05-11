/**
 * Zod schema for borski's `data/partner-awards.json`.
 *
 * Shape: `{ _meta, programs, cross_alliance_highlights }`. `programs` is a
 * map of program-id -> { display_name, alliance, bookable_airlines, ... }.
 *
 * @module lib/data/borski-toolkit-adapter/schemas/partner-awards
 */

import { z } from 'zod';
import { BorskiMetaSchema } from './transfer-partners';

/**
 * Bookable airline groups for a single program. Keys are alliance names
 * (`star_alliance`, `oneworld`, `skyteam`) plus optional `non_alliance`.
 */
export const BorskiBookableAirlinesSchema = z
  .object({
    star_alliance: z.array(z.string()).optional(),
    oneworld: z.array(z.string()).optional(),
    skyteam: z.array(z.string()).optional(),
    non_alliance: z.array(z.string()).optional(),
  })
  .passthrough();

export type BorskiBookableAirlines = z.infer<typeof BorskiBookableAirlinesSchema>;

/**
 * A single award program (e.g. United MileagePlus, Aeroplan).
 */
export const BorskiPartnerAwardProgramSchema = z
  .object({
    display_name: z.string(),
    alliance: z.string().nullable().optional(),
    bookable_airlines: BorskiBookableAirlinesSchema,
    transfer_from: z.array(z.string()).optional(),
    chart_type: z.enum(['fixed', 'dynamic', 'distance', 'zone']).or(z.string()).optional(),
    search_url: z.string().optional(),
    phone: z.string().optional(),
    online_booking: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type BorskiPartnerAwardProgram = z.infer<typeof BorskiPartnerAwardProgramSchema>;

/**
 * Top-level schema for `partner-awards.json`.
 */
export const BorskiPartnerAwardsFileSchema = z.object({
  _meta: BorskiMetaSchema,
  programs: z.record(z.string(), BorskiPartnerAwardProgramSchema),
  cross_alliance_highlights: z.unknown().optional(),
});

export type BorskiPartnerAwardsFile = z.infer<typeof BorskiPartnerAwardsFileSchema>;
