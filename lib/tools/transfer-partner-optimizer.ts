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
    .positive()
    .describe('How many source-program points the user wants to transfer.'),
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
  milesOut: number;
  minTransfer: number;
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
    const ranked = rankByMilesOut(filtered, input.sourcePoints);
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

function rankByMilesOut(
  entries: Array<[string, TransferPartner]>,
  sourcePoints: number,
): Array<[string, TransferPartner]> {
  return entries
    .slice()
    .sort(([idA, a], [idB, b]) => {
      // milesOut = floor(sourcePoints * partnerMiles / amexPoints) — same denominator,
      // so equivalent to sorting by effectiveRate desc.
      const aMiles = (sourcePoints * a.partnerMiles) / a.amexPoints;
      const bMiles = (sourcePoints * b.partnerMiles) / b.amexPoints;
      return bMiles - aMiles;
    });
}

function formatEntry(
  [partnerId, partner]: [string, TransferPartner],
  partnerMap: PartnerMap,
  sourcePoints: number,
  locale: TransferLocale,
): PartnerEntry {
  const milesOut = calculatePartnerMilesIn(partnerMap, partnerId, sourcePoints) ?? 0;
  return {
    partnerId,
    partnerName: partner.name,
    brand: partner.brand,
    ratio: formatTransferRatio(partner),
    effectiveRate: partner.effectiveRate,
    milesOut,
    minTransfer: partner.minTransfer,
    transferDuration: getLocalizedValue(partner.transferDuration, locale),
    alliance: partner.alliance ?? null,
    type: partner.type,
    notes: partner.notes ? getLocalizedValue(partner.notes, locale) : null,
  };
}

// Re-exports kept for tests/consumers that want to inspect the source-program map.
export { sortPartnersByEffectiveRate };
