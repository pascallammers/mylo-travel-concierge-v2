import { getLoyaltyProgram } from '../loyalty/programs';
import { CABIN_LABELS, formatSourceMonth } from '../valuation/presentation';
import { classifyTravelVerdict } from '../valuation/travel-verdict';
import type { Cabin, ResolvedRate, ValuationTable } from '../valuation/types';

export interface RedemptionInput {
  programId: string;
  cabin?: Cabin;
  pointsRequired: number;
  cashEur: number;
}

export interface RedemptionAssessment {
  centsPerPoint: number;
  travel: ResolvedRate;
  noPlan: ResolvedRate | null;
  verdict: 'below_no_plan' | 'below_travel' | 'above_travel' | 'far_above_travel';
  programName: string;
  summary: string;
}

/** Invalid redemption inputs or a programme outside the current valuation allowlist. */
export class CppCalculatorError extends Error {
  /**
   * Explain why an award cannot be assessed.
   * @param message - German explanation for the user.
   * @returns A typed validation failure suitable for the CPP tool.
   */
  constructor(message: string) {
    super(message);
    this.name = 'CppCalculatorError';
  }
}

/**
 * Compare a redemption's EUR-cent value with its dated travel and no-plan anchors.
 * @param input - Registry programme, optional cabin, points required and EUR cash price.
 * @param table - Injected valuation snapshot.
 * @returns Rounded CPP, resolved anchors, verdict and German quality-seal summary.
 * @throws CppCalculatorError for non-positive/non-finite amounts or an unratable programme.
 */
export function assessRedemption(input: RedemptionInput, table: ValuationTable): RedemptionAssessment {
  if (!Number.isFinite(input.pointsRequired) || input.pointsRequired <= 0) {
    throw new CppCalculatorError('Die benötigte Punktezahl muss eine endliche Zahl größer als null sein.');
  }
  if (!Number.isFinite(input.cashEur) || input.cashEur <= 0) {
    throw new CppCalculatorError('Der Vergleichspreis in EUR muss eine endliche Zahl größer als null sein.');
  }
  const programName = getLoyaltyProgram(input.programId)?.name ?? input.programId;
  const travel = table.rateFor(input.programId, 'travel', input.cabin);
  if (!table.isRatable(input.programId) || !travel) {
    const programs = table
      .programIds()
      .map((id) => `${getLoyaltyProgram(id)?.name ?? id} (${id})`)
      .join(', ');
    throw new CppCalculatorError(`${programName} ist nicht bewertbar; bewertbare Programme: ${programs || 'keine'}.`);
  }
  const centsPerPoint = Math.round(((input.cashEur * 100) / input.pointsRequired) * 100) / 100;
  if (!Number.isFinite(centsPerPoint)) {
    throw new CppCalculatorError('Der Punktwert kann mit diesen Beträgen nicht berechnet werden.');
  }
  const noPlan = table.rateFor(input.programId, 'no_plan') ?? null;
  const verdict: RedemptionAssessment['verdict'] =
    noPlan && centsPerPoint < noPlan.centsPerUnit
      ? 'below_no_plan'
      : classifyTravelVerdict(centsPerPoint, travel.centsPerUnit);
  const format = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
  const labels = {
    below_no_plan: `sogar unter dem Wert ohne Plan (${format(noPlan?.centsPerUnit ?? 0)} ct)`,
    below_travel: 'unter dem üblichen Reisewert',
    above_travel: 'über dem üblichen Reisewert',
    far_above_travel: 'deutlich über dem üblichen Reisewert',
  };
  const summary = `${labels[verdict]} · ${format(centsPerPoint)} ct pro Punkt · üblich ${format(travel.centsPerUnit)} ct (Reisewert ${programName}, ${CABIN_LABELS[travel.cabin]}; ${travel.source}, Stand ${formatSourceMonth(travel.sourceAsOf)})${travel.stale ? ' · Bewertungssatz überfällig' : ''}`;
  return { centsPerPoint, travel, noPlan, verdict, programName, summary };
}
