// lib/tools/transfer-partner-optimizer.ts
//
// AI SDK tool that wraps the multi-region transfer-engine. The agent calls
// this when a user asks "I have N points, where can I transfer them?" or
// "what's the best way to get to airline X with my Amex MR?".
//
// Wraps the 6 source-program partner maps (Amex DACH, Amex US, Chase UR, Bilt,
// Capital One, Citi TY). targetAirline does fuzzy substring matching against
// partner brand/name.

import { tool } from 'ai';
import { z } from 'zod';
import {
  AMEX_DACH_PARTNERS,
  AMEX_US_PARTNERS,
  BILT_PARTNERS,
  CAPITAL_ONE_PARTNERS,
  CHASE_PARTNERS,
  CITI_PARTNERS,
  calculatePartnerMilesIn,
  formatTransferRatio,
  getLocalizedValue,
  sortPartnersByEffectiveRate,
  type PartnerMap,
  type TransferLocale,
  type TransferPartner,
} from '@/lib/config/transfer-engine';

const SOURCE_PROGRAM_MAP: Record<string, PartnerMap> = {
  amex_dach: AMEX_DACH_PARTNERS,
  amex_us: AMEX_US_PARTNERS,
  chase_ur: CHASE_PARTNERS,
  bilt: BILT_PARTNERS,
  capital_one: CAPITAL_ONE_PARTNERS,
  citi_ty: CITI_PARTNERS,
};

const inputSchema = z.object({
  sourceProgram: z
    .enum(['amex_dach', 'amex_us', 'chase_ur', 'bilt', 'capital_one', 'citi_ty'])
    .describe(
      'Which credit-card source program the user holds points in. amex_dach for German Amex MR (different ratios than US), amex_us for US Amex MR.',
    ),
  sourcePoints: z
    .number()
    .int()
    .positive()
    .describe('How many source-program points the user wants to transfer (integer).'),
  targetAirline: z
    .string()
    .optional()
    .describe(
      'Optional: airline or hotel brand name (e.g. "Singapore Airlines", "Lufthansa", "Marriott"). Case-insensitive substring match. Omit to list top airline partners overall.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe('Max number of partners to return. Default 5.'),
  locale: z
    .enum(['de', 'en'])
    .optional()
    .default('en')
    .describe('Locale for transferDuration display strings.'),
});

interface PartnerEntry {
  partnerId: string;
  partnerName: string;
  brand: string;
  ratio: string;
  effectiveRate: number;
  /** Partner-program miles received for `pointsUsed` source points (not the user's full balance). */
  milesOut: number;
  /** Source points actually transferred — aligned to transferIncrement and ≥ minTransfer.
   *  Differs from input.sourcePoints when the user's balance has leftovers. */
  pointsUsed: number;
  minTransfer: number;
  transferIncrement: number;
  transferDuration: string;
  alliance: string | null;
  type: 'airline' | 'hotel' | 'other';
  notes: string | null;
}

type Result =
  | { success: true; sourceProgram: string; sourcePoints: number; partners: PartnerEntry[] }
  | { success: false; error: string };

export const transferPartnerOptimizerTool = tool({
  description:
    'Find the best transfer partners for a credit-card points balance, optionally filtered by airline/hotel. Returns ratios, partner-program miles received, alliance, transfer duration, and minimum transfer amounts. Use when the user asks where to redeem their points or how many miles they get at a specific airline.',
  inputSchema,
  execute: async (input): Promise<Result> => {
    const partnerMap = SOURCE_PROGRAM_MAP[input.sourceProgram];
    if (!partnerMap) {
      return {
        success: false,
        error: `Unknown sourceProgram "${input.sourceProgram}".`,
      };
    }

    const filtered = filterByAirline(partnerMap, input.targetAirline);
    // Drop partners the user cannot actually transfer to with this balance:
    // either below minTransfer, or no aligned multiple of transferIncrement
    // exists at-or-below sourcePoints. Without this, Codex finding shows e.g.
    // "500 DACH Amex → Flying Blue" even though Flying Blue requires 625 min.
    const transferable = filtered.filter(
      ([, p]) => effectiveTransferable(p, input.sourcePoints) > 0,
    );
    const ranked = rankByMilesOut(transferable, input.sourcePoints);
    const topN = ranked.slice(0, input.limit);

    return {
      success: true,
      sourceProgram: input.sourceProgram,
      sourcePoints: input.sourcePoints,
      partners: topN.map((entry) => formatEntry(entry, partnerMap, input.sourcePoints, input.locale)),
    };
  },
});

function filterByAirline(
  partners: PartnerMap,
  targetAirline: string | undefined,
): Array<[string, TransferPartner]> {
  const entries = Object.entries(partners);
  if (!targetAirline) {
    // Default: airline partners only when listing without a specific target.
    return entries.filter(([, p]) => p.type === 'airline');
  }
  const needle = targetAirline.toLowerCase();
  return entries.filter(([, p]) => {
    const haystack = `${p.name} ${p.brand}`.toLowerCase();
    return haystack.includes(needle);
  });
}

// Largest source-points amount that can actually be transferred to this
// partner: aligned down to transferIncrement, gated by minTransfer. Returns 0
// if no valid transfer is possible (balance too small or doesn't align).
function effectiveTransferable(partner: TransferPartner, sourcePoints: number): number {
  const aligned =
    Math.floor(sourcePoints / partner.transferIncrement) * partner.transferIncrement;
  return aligned >= partner.minTransfer ? aligned : 0;
}

function rankByMilesOut(
  entries: Array<[string, TransferPartner]>,
  sourcePoints: number,
): Array<[string, TransferPartner]> {
  return entries
    .slice()
    .sort(([idA, a], [idB, b]) => {
      // Rank by miles obtainable from the *transferable* portion, not the raw
      // balance — otherwise a partner with a too-high minimum could outrank
      // valid partners purely on effectiveRate.
      const aUsable = effectiveTransferable(a, sourcePoints);
      const bUsable = effectiveTransferable(b, sourcePoints);
      const aMiles = (aUsable * a.partnerMiles) / a.amexPoints;
      const bMiles = (bUsable * b.partnerMiles) / b.amexPoints;
      return bMiles - aMiles;
    });
}

function formatEntry(
  [partnerId, partner]: [string, TransferPartner],
  partnerMap: PartnerMap,
  sourcePoints: number,
  locale: TransferLocale,
): PartnerEntry {
  const pointsUsed = effectiveTransferable(partner, sourcePoints);
  // calculatePartnerMilesIn floors the result so milesOut stays integer.
  const milesOut = calculatePartnerMilesIn(partnerMap, partnerId, pointsUsed) ?? 0;
  return {
    partnerId,
    partnerName: partner.name,
    brand: partner.brand,
    ratio: formatTransferRatio(partner),
    effectiveRate: partner.effectiveRate,
    milesOut,
    pointsUsed,
    minTransfer: partner.minTransfer,
    transferIncrement: partner.transferIncrement,
    transferDuration: getLocalizedValue(partner.transferDuration, locale),
    alliance: partner.alliance ?? null,
    type: partner.type,
    notes: partner.notes ? getLocalizedValue(partner.notes, locale) : null,
  };
}

// Re-exports kept for tests/consumers that want to inspect the source-program map.
export { sortPartnersByEffectiveRate };
