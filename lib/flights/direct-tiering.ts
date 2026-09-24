import { groupByProgram } from '@/lib/api/award-search/program-grouping';
import type { TravelClass } from '@/lib/api/seats-aero-client';

export type FlightLocale = 'de' | 'en';
export type DirectTiering =
  | { readonly kind: 'direct_first' }
  | { readonly kind: 'no_direct'; readonly fallbackStops: number };
export interface RankableTrip {
  readonly program: string;
  readonly miles: number | null;
  readonly totalStops: number;
}

/**
 * Rank direct awards before the fewest-stops tier, limiting each tier per program.
 * @param trips - Ungrouped provider trips.
 * @param preference - Direct priority or the historical program grouping.
 * @returns Options and the reason for falling back to connections.
 */
export function tierAwardTrips<T extends RankableTrip>(
  trips: readonly T[], preference: 'any' | 'direct',
): { options: T[]; tiering: DirectTiering | null } {
  if (preference === 'any' || !trips.length) {
    return { options: groupByProgram(trips), tiering: null };
  }
  const direct = trips.filter((trip) => trip.totalStops === 0);
  const fallbackStops = Math.min(...trips.filter((trip) => trip.totalStops > 0).map((trip) => trip.totalStops));
  const connecting = trips.filter((trip) => trip.totalStops === fallbackStops);
  return {
    options: [...groupByProgram(direct), ...groupByProgram(connecting)],
    tiering: direct.length ? { kind: 'direct_first' } : { kind: 'no_direct', fallbackStops },
  };
}

/**
 * Explain a route's lack of direct awards consistently in chat and the mask.
 * @param tiering - Selection metadata before program and tax filters.
 * @param context - Cabin, optional leg prefix and output language.
 * @returns Localized fallback notice, or null when there is no fallback.
 */
export function describeDirectTiering(
  tiering: DirectTiering | null,
  context: { cabin: TravelClass; leg: 'outbound' | 'inbound' | null; locale: FlightLocale },
): string | null {
  if (tiering?.kind !== 'no_direct') return null;
  const cabin = { ECONOMY: 'Economy', PREMIUM_ECONOMY: 'Premium Economy', BUSINESS: 'Business', FIRST: 'First' }[context.cabin];
  const stops = tiering.fallbackStops;
  const prefix = context.leg ? (context.locale === 'de'
    ? { outbound: 'Hinflug: ', inbound: 'Rückflug: ' }
    : { outbound: 'Outbound: ', inbound: 'Return: ' })[context.leg] : '';
  return context.locale === 'de'
    ? `${prefix}Mit Meilen gibt es auf dieser Strecke keine Direktflüge in ${cabin}. Das sind die besten Optionen mit ${stops} ${stops === 1 ? 'Zwischenstopp' : 'Zwischenstopps'}.`
    : `${prefix}With miles there are no direct flights in ${cabin} on this route. These are the best options with ${stops} ${stops === 1 ? 'stop' : 'stops'}.`;
}
