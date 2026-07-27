/**
 * Pure post-search filters for award results — makes the `loyaltyPrograms`
 * and `maxTaxes` tool parameters effective (MYLO-19).
 *
 * Both filters explain themselves instead of failing silently: an empty
 * program match falls back to all programs plus a note, a tax limit never
 * silently drops flights whose taxes are not in USD/EUR (not comparable to
 * the numeric limit without FX rates).
 */

import type { SeatsAeroFlight } from '../seats-aero-client';
import { getProgramDisplayName, resolveProgramSlugs } from './program-registry';

export type AwardFilterLocale = 'de' | 'en';

export interface AwardFilterOptions {
  loyaltyPrograms?: string[];
  /** Maximum taxes/fees; compared against USD/EUR tax amounts only. */
  maxTaxes?: number;
  locale: AwardFilterLocale;
}

export interface AwardFilterResult {
  flights: SeatsAeroFlight[];
  /** User-facing hints (requested program empty, incomparable currency, ...). */
  notes: string[];
}

/** Currencies treated as directly comparable to the numeric maxTaxes limit. */
const COMPARABLE_CURRENCIES = new Set(['USD', 'EUR']);

const filterI18n = {
  programNoAvailability: {
    de: (requested: string, alternatives: string) =>
      `Im gewünschten Programm (${requested}) wurde keine Verfügbarkeit gefunden. Andere Programme mit Verfügbarkeit: ${alternatives}.`,
    en: (requested: string, alternatives: string) =>
      `No availability found in the requested program (${requested}). Other programs with availability: ${alternatives}.`,
  },
  programUnknown: {
    de: (names: string) =>
      `Treueprogramm nicht erkannt und daher nicht gefiltert: ${names}.`,
    en: (names: string) =>
      `Loyalty program not recognized, so no filter was applied for: ${names}.`,
  },
  taxesIncomparable: {
    de: (currencies: string) =>
      `Einige Flüge weisen Steuern/Gebühren in ${currencies} aus — diese konnten nicht mit dem Steuer-Limit verglichen und daher nicht gefiltert werden.`,
    en: (currencies: string) =>
      `Some flights list taxes/fees in ${currencies} — these could not be compared against the tax limit and were not filtered.`,
  },
  taxesAllFiltered: {
    de: (limit: number) =>
      `Keine Award-Flüge mit Steuern/Gebühren unter ${limit} gefunden — das Limit hat alle Ergebnisse ausgefiltert.`,
    en: (limit: number) =>
      `No award flights with taxes/fees below ${limit} — the limit filtered out every result.`,
  },
} as const;

export function applyAwardFilters(
  flights: SeatsAeroFlight[],
  options: AwardFilterOptions,
): AwardFilterResult {
  if (flights.length === 0) return { flights: [], notes: [] };

  const notes: string[] = [];
  const { locale } = options;

  let current = flights;

  // 1. Loyalty-program filter (mapping via program-registry).
  if (options.loyaltyPrograms && options.loyaltyPrograms.length > 0) {
    const { matched, unmatched } = resolveProgramSlugs(options.loyaltyPrograms);

    if (unmatched.length > 0) {
      notes.push(filterI18n.programUnknown[locale](unmatched.join(', ')));
    }

    if (matched.length > 0) {
      const inPrograms = current.filter((f) => matched.includes(f.program));

      if (inPrograms.length > 0) {
        current = inPrograms;
      } else {
        // Requested program has no availability: keep the alternatives
        // visible and say so — an unexplained empty table is the bug.
        const requested = matched
          .map((slug) => getProgramDisplayName(slug, locale))
          .join(', ');
        const alternatives = [...new Set(current.map((f) => f.program))]
          .map((slug) => getProgramDisplayName(slug, locale))
          .join(', ');
        notes.push(filterI18n.programNoAvailability[locale](requested, alternatives));
      }
    }
  }

  // 2. Tax limit — only USD/EUR amounts are comparable to the numeric limit;
  // anything else is kept and flagged instead of silently dropped.
  const maxTaxes = options.maxTaxes;
  if (maxTaxes !== undefined) {
    const incomparableCurrencies = new Set<string>();
    const beforeCount = current.length;

    current = current.filter((f) => {
      const { amount, currency } = f.taxes;
      if (amount === null || !currency || !COMPARABLE_CURRENCIES.has(currency.toUpperCase())) {
        if (currency && !COMPARABLE_CURRENCIES.has(currency.toUpperCase())) {
          incomparableCurrencies.add(currency.toUpperCase());
        }
        return true;
      }
      return amount <= maxTaxes;
    });

    if (incomparableCurrencies.size > 0) {
      notes.push(
        filterI18n.taxesIncomparable[locale]([...incomparableCurrencies].join(', ')),
      );
    }
    if (current.length === 0 && beforeCount > 0) {
      notes.push(filterI18n.taxesAllFiltered[locale](maxTaxes));
    }
  }

  return { flights: current, notes };
}
