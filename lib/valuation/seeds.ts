import { defaultReviewDue } from './dates';
import type { Anchor, Cabin, NewRate } from './types';

const airlineUrl = 'https://reisetopia.de/guides/wert-meilen-vielfliegerprogramme/';
const sourceUrls: Record<string, string> = {
  lufthansa: 'https://reisetopia.de/guides/wert-einer-miles-and-more-meile/',
  'amex-mr': 'https://reisetopia.de/guides/amex-punkte-wert/',
  marriott: 'https://reisetopia.de/deals/marriott-punkte-kaufen/',
  hilton: 'https://reisetopia.de/deals/hilton-honors-punkte-kaufen/',
};

function seed(
  programId: string,
  centsPerUnit: number,
  anchor: Anchor = 'travel',
  cabin: Cabin = 'all',
  note: string | null = null,
): NewRate {
  const sourceAsOf = new Date('2026-09-01T00:00:00Z');
  return {
    programId,
    anchor,
    cabin,
    centsPerUnit,
    source: 'reisetopia',
    sourceUrl: sourceUrls[programId] ?? airlineUrl,
    sourceAsOf,
    reviewDue: defaultReviewDue(sourceAsOf),
    note,
    createdBy: null,
  };
}

export const VALUATION_SEEDS: readonly NewRate[] = [
  seed('lufthansa', 1.7),
  seed('amex-mr', 1.7),
  seed('payback', 1.8),
  seed('marriott', 0.7),
  seed('emirates', 1.1),
  seed('hilton', 0.5),
  seed('qatar', 1.6),
  seed('cathay', 1.5),
  seed('british', 1.5),
  seed('flyingblue', 1.4),
  seed('iberia', 1.5),
  seed('singapore', 1.5),
  seed('aeroplan', 1.7),
  seed('united', 1.3),
  seed('delta', 1.1),
  seed('turkish', 1.1),
  seed('eurobonus', 1.7),
  seed('etihad', 1.0),
  seed('lufthansa', 0.7, 'travel', 'economy'),
  seed('lufthansa', 1.1, 'travel', 'premium_economy'),
  seed('lufthansa', 1.7, 'travel', 'business'),
  seed('lufthansa', 2.3, 'travel', 'first'),
  seed('lufthansa', 0.3, 'no_plan', 'all', 'Worldshop'),
  seed('amex-mr', 0.4, 'no_plan', 'all', 'Zahlungen mit Punkten begleichen'),
  seed('payback', 1.0, 'no_plan', 'all', 'Einkauf'),
];

/**
 * Produce isolated seed values for persistence or a read fallback.
 * @returns All 25 dated initial values, including independent Date objects.
 */
export function seedRows(): NewRate[] {
  return structuredClone(VALUATION_SEEDS) as NewRate[];
}
