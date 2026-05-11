// lib/services/cpp-calculator.ts
//
// Pure function for evaluating a points-redemption's cents-per-point (cpp)
// against borski-toolkit valuation thresholds, with a Lufthansa Miles & More
// override for sweet-spot Star Alliance partner awards.
//
// Why M&M override: borski's lufthansa entry sits at floor 1.2¢ / ceiling 1.3¢,
// which reflects average value across the (now dynamic-priced) Lufthansa Group
// awards. Sweet spots live in the Partner Award Chart (Singapore, ANA, Thai,
// Air India, ITA from April 2026) and routinely reach 2-3¢. Treating anything
// ≥1.8¢ as excellent better matches what a DACH user actually books.

import type {
  BorskiPointsValuationsFile,
  BorskiValuationEntry,
} from '@/lib/data/borski-toolkit-adapter';

export type Currency = 'USD' | 'EUR';
export type CppTier = 'poor' | 'fair' | 'good' | 'excellent';
export type CppSource = 'borski' | 'mm-override';

export interface CalculateCppInput {
  programId: string;
  pointsRequired: number;
  cashEquivalent: number;
  currency: Currency;
  valuations: BorskiPointsValuationsFile;
  eurToUsdRate?: number;
}

export interface CppResult {
  cpp: number;
  tier: CppTier;
  threshold: { floor: number; ceiling: number };
  reasoning: string;
  source: CppSource;
  programName: string;
  inputCurrency: Currency;
}

export class CppCalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CppCalculatorError';
  }
}

/** Default EUR→USD rate. Approximate April 2026 spot. Override per call for accuracy. */
export const DEFAULT_EUR_TO_USD = 1.08;

/** Excellent threshold for Lufthansa Miles & More — see file header for rationale. */
export const MM_EXCELLENT_THRESHOLD = 1.8;

/** Borski programIds that trigger the M&M Star-Alliance-partner override. */
const MM_OVERRIDE_IDS = new Set(['lufthansa']);

/**
 * Calculate cpp tier for a points redemption against borski valuation thresholds.
 *
 * @param input - Redemption inputs plus injected borski valuations file.
 * @returns cpp number, tier label, and the thresholds used to assign it.
 * @throws CppCalculatorError on unknown programId, non-positive amounts, or
 *   non-positive eurToUsdRate.
 */
export function calculateCpp(input: CalculateCppInput): CppResult {
  const {
    programId,
    pointsRequired,
    cashEquivalent,
    currency,
    valuations,
    eurToUsdRate = DEFAULT_EUR_TO_USD,
  } = input;

  if (pointsRequired <= 0) {
    throw new CppCalculatorError(`pointsRequired must be > 0, got ${pointsRequired}`);
  }
  if (cashEquivalent <= 0) {
    throw new CppCalculatorError(`cashEquivalent must be > 0, got ${cashEquivalent}`);
  }
  if (eurToUsdRate <= 0) {
    throw new CppCalculatorError(`eurToUsdRate must be > 0, got ${eurToUsdRate}`);
  }

  const entry = findProgram(programId, valuations);
  if (!entry) {
    throw new CppCalculatorError(
      `Unknown programId "${programId}". Not found in borski credit_card_points, airline_miles, or hotel_points.`,
    );
  }

  const cashUsd = currency === 'EUR' ? cashEquivalent * eurToUsdRate : cashEquivalent;
  const cppRaw = (cashUsd * 100) / pointsRequired;
  const cpp = Math.round(cppRaw * 100) / 100;

  const isMmOverride = MM_OVERRIDE_IDS.has(programId);
  const source: CppSource = isMmOverride ? 'mm-override' : 'borski';
  const effectiveFloor = entry.floor;
  const effectiveCeiling = isMmOverride
    ? Math.max(MM_EXCELLENT_THRESHOLD, entry.ceiling)
    : entry.ceiling;
  const midpoint = (effectiveFloor + effectiveCeiling) / 2;

  const tier = pickTier(cpp, effectiveFloor, midpoint, effectiveCeiling);

  return {
    cpp,
    tier,
    threshold: { floor: effectiveFloor, ceiling: effectiveCeiling },
    reasoning: buildReasoning(tier, cpp, effectiveFloor, effectiveCeiling, source),
    source,
    programName: entry.name,
    inputCurrency: currency,
  };
}

function findProgram(
  programId: string,
  valuations: BorskiPointsValuationsFile,
): BorskiValuationEntry | undefined {
  return (
    valuations.credit_card_points[programId] ??
    valuations.airline_miles[programId] ??
    valuations.hotel_points[programId]
  );
}

function pickTier(cpp: number, floor: number, midpoint: number, ceiling: number): CppTier {
  if (cpp < floor) return 'poor';
  if (cpp < midpoint) return 'fair';
  if (cpp < ceiling) return 'good';
  return 'excellent';
}

function buildReasoning(
  tier: CppTier,
  cpp: number,
  floor: number,
  ceiling: number,
  source: CppSource,
): string {
  const note = source === 'mm-override' ? 'M&M sweet spot override' : 'borski';
  return `${tier}: ${cpp}¢ vs ${floor}-${ceiling}¢ (${note})`;
}
