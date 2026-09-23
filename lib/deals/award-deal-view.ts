import { classifyTravelVerdict, type TravelVerdict } from '../valuation/travel-verdict';

export type AwardReachability = 'transfer' | 'own_balance' | 'unreachable';

export interface AwardTransferRoute {
  label: string;
}

export interface AwardSeal {
  /** Full precision; round to one decimal only when formatting for display. */
  achievedCents: number;
  typicalCents: number;
  verdict: TravelVerdict;
  /** Legacy rows can have a rate without its effective date. */
  rateValidFrom: Date | null;
}

export interface AwardDealView {
  programId: string | null;
  programName: string | null;
  miles: number;
  taxesEur: number | null;
  seatsLeft: number | null;
  cashReferenceEur: number | null;
  reachability: AwardReachability;
  transferRoute: AwardTransferRoute | null;
  seal: AwardSeal | null;
}

export interface AwardDealFields {
  price: number;
  programId: string | null;
  programReachableDach: boolean | null;
  taxesEur: number | null;
  seatsLeft: number | null;
  cashReferencePrice: number | null;
  cashReferenceSamples: number | null;
  valuationRateCt: number | null;
  valuationRateValidFrom: Date | null;
}

export interface AwardDealContext {
  ownBalanceProgramIds: ReadonlySet<string>;
  resolveProgramName: (programId: string) => string;
  resolveDachRoute: (programId: string) => AwardTransferRoute | null;
}

/**
 * Present an award using its stored EUR references and the current user's access.
 * @param deal - Award fields; price is the one-way mileage cost.
 * @param context - Injected names, transfer routes and programs with a positive balance.
 * @returns Award details and a seal only when both access and valuation inputs permit it.
 */
export function buildAwardDealView(deal: AwardDealFields, context: AwardDealContext): AwardDealView {
  const programId = deal.programId;
  const reachability: AwardReachability = programId === null
    ? 'unreachable'
    : deal.programReachableDach === true
      ? 'transfer'
      : context.ownBalanceProgramIds.has(programId) ? 'own_balance' : 'unreachable';
  const cashReferenceEur = (deal.cashReferenceSamples ?? 0) >= 3
    ? deal.cashReferencePrice : null;
  let seal: AwardSeal | null = null;
  if (
    reachability !== 'unreachable' && cashReferenceEur !== null &&
    deal.taxesEur !== null && cashReferenceEur > deal.taxesEur &&
    deal.valuationRateCt !== null && deal.price > 0
  ) {
    const achievedCents = ((cashReferenceEur - deal.taxesEur) / deal.price) * 100;
    if (Number.isFinite(achievedCents) && Number.isFinite(deal.valuationRateCt) && deal.valuationRateCt > 0) {
      seal = {
        achievedCents,
        typicalCents: deal.valuationRateCt,
        verdict: classifyTravelVerdict(achievedCents, deal.valuationRateCt),
        rateValidFrom: deal.valuationRateValidFrom,
      };
    }
  }

  return {
    programId,
    programName: programId === null ? null : context.resolveProgramName(programId),
    miles: deal.price,
    taxesEur: deal.taxesEur,
    seatsLeft: deal.seatsLeft,
    cashReferenceEur,
    reachability,
    transferRoute: programId === null ? null : context.resolveDachRoute(programId),
    seal,
  };
}
