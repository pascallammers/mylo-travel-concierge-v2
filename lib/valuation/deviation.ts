export const MAX_RELATIVE_RATE_DEVIATION = 0.25;

/** A replacement requires the administrator's explicit deviation confirmation. */
export class ValuationDeviationError extends Error {
  /**
   * Describe the two compared EUR-cent values without exposing database details.
   * @param previous - Current value under the transaction lock.
   * @param next - Proposed successor value.
   * @returns A conflict suitable for an HTTP 409 response.
   */
  constructor(previous: number, next: number) {
    const format = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
    super(
      `Der neue Bewertungssatz ${format(next)} ct weicht um mehr als 25 % vom bisherigen Wert ${format(previous)} ct ab. Bitte die Abweichung bestätigen.`,
    );
    this.name = 'ValuationDeviationError';
  }
}

/**
 * Require confirmation for changes greater than 25 percent, using integer thousandths.
 * @param previous - Current rate, if this key already exists.
 * @param next - Proposed EUR-cent value.
 * @param confirmed - Explicit administrator confirmation.
 * @returns Completion unless a deviation conflict is thrown.
 */
export function assertRateDeviation(previous: number | undefined, next: number, confirmed = false): void {
  if (previous === undefined || confirmed) return;
  const before = Math.round(previous * 1000);
  const after = Math.round(next * 1000);
  if (Math.abs(after - before) > before * MAX_RELATIVE_RATE_DEVIATION) {
    throw new ValuationDeviationError(previous, next);
  }
}
