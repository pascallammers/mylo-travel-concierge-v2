export type TravelVerdict = 'below_travel' | 'above_travel' | 'far_above_travel';

/**
 * Compare a redemption's value with its typical travel anchor.
 * @param achievedCents - Finite EUR cents achieved per point, before display rounding.
 * @param typicalCents - Positive, finite travel anchor in EUR cents per point.
 * @returns The travel verdict, with a strong verdict starting at 1.5 times the anchor.
 */
export function classifyTravelVerdict(achievedCents: number, typicalCents: number): TravelVerdict {
  if (achievedCents < typicalCents) return 'below_travel';
  // Integer thousandths preserve the calculator's exact 1.5x boundary behavior.
  return Math.round(achievedCents * 1000) * 2 >= Math.round(typicalCents * 1000) * 3
    ? 'far_above_travel'
    : 'above_travel';
}
