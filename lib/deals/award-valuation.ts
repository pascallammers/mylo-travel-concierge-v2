/**
 * Pure award-deal valuation (Deals-Spec: Ersparnis = Ø Barpreis − Zuschläge −
 * Reisewert der eingesetzten Punkte). All money is EUR major units; the rate
 * is cents per point.
 */

/** Price-history sources whose EUR rows count as cash measurements (never mileage prices). */
export const CASH_REFERENCE_SOURCES = ['travelpayouts', 'duffel'] as const;

/** Currency conversion into EUR; unknown currencies yield null. */
export interface EurRates {
  /**
   * Convert an amount into EUR.
   * @param amount - Amount in the given currency.
   * @param currency - ISO 4217 code; 'EUR' converts identically.
   * @returns EUR amount, or null when the currency has no rate.
   */
  toEur(amount: number, currency: string): number | null;
}

/**
 * Average measured cash price of a route in one cabin over 90 days.
 * Only exists with at least three samples; a mileage price never counts.
 */
export interface CashReference {
  meanEur: number;
  samples: number;
}

/** One award offer: mileage cost plus the cash surcharge as reported. */
export interface AwardQuote {
  miles: number;
  taxesAmount: number | null;
  taxesCurrency: string | null;
}

/** Point value applied to a quote, including its validity start. */
export interface AwardValuationRate {
  centsPerUnit: number;
  validFrom: Date;
}

/** Materialized valuation of one award offer for the deal row. */
export interface AwardValuation {
  /** Surcharge in EUR; null when the reported currency is unknown. */
  taxesEur: number | null;
  /** Miles at rate plus taxesEur; null without rate or taxes. */
  redemptionCostEur: number | null;
  /** (cashRef − taxes − miles·rate) / cashRef · 100; null without any input. */
  savingsPercent: number | null;
  /** The rate used, echoed for persistence. */
  rate: AwardValuationRate | null;
}

/**
 * Value one award quote against a rate, a cash reference, and FX rates.
 *
 * @param quote - Miles and reported taxes of the award flight.
 * @param rate - Resolved cents-per-point rate, or null/undefined when the program is not ratable.
 * @param cashRef - Route cash reference, or null with fewer than three samples.
 * @param rates - Currency conversion into EUR.
 * @returns Persistable valuation fields; each null marks a missing input.
 */
export function valueAward(
  quote: AwardQuote,
  rate: AwardValuationRate | null | undefined,
  cashRef: CashReference | null,
  rates: EurRates,
): AwardValuation {
  const resolvedRate = rate ?? null;
  const taxesEur =
    quote.taxesAmount === null || !quote.taxesCurrency
      ? null
      : rates.toEur(quote.taxesAmount, quote.taxesCurrency);

  const milesCostEur =
    resolvedRate === null ? null : (quote.miles * resolvedRate.centsPerUnit) / 100;
  const redemptionCostEur =
    milesCostEur === null || taxesEur === null ? null : milesCostEur + taxesEur;

  const savingsPercent =
    cashRef !== null &&
    cashRef.meanEur > 0 &&
    milesCostEur !== null &&
    taxesEur !== null
      ? ((cashRef.meanEur - taxesEur - milesCostEur) / cashRef.meanEur) * 100
      : null;

  return {
    taxesEur,
    redemptionCostEur,
    savingsPercent,
    rate: resolvedRate,
  };
}
