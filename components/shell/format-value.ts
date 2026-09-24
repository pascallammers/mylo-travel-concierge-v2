/**
 * Format the shared approximate travel value without marking an exact zero as approximate.
 * @param eur - Travel value in euros.
 * @param locale - Active locale used for currency and thousands separators.
 * @returns The localized whole-euro value with an approximation prefix when nonzero.
 */
export function formatValue(eur: number, locale: string): string {
  const euro = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  return `${eur === 0 ? '' : '~'}${euro.format(eur)}`;
}
