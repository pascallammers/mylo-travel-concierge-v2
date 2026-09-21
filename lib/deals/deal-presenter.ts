export type DealKind = 'award' | 'cash';
export type DealRange = 'europe' | 'long_haul';
export type DealSortOption = 'score' | 'price' | 'date';

export const EUROPE_MAX_DISTANCE_KM = 4000;
const EUROPE_MAX_DURATION_MINUTES = 300;
const HOUR_MS = 1000 * 60 * 60;

export interface PresentableDeal {
  origin: string;
  destination: string;
  destinationName: string | null;
  departureDate: Date;
  returnDate: Date | null;
  price: number;
  currency: string;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  averagePrice: number | null;
  priceDifference?: number | null;
  priceChangePercent: number | null;
  dealScore: number;
  personalizedScore: number | null;
  personalizationReasons: string[];
  airline: string | null;
  source: string;
  flightDurationMinutes: number | null;
  preferredOriginMatch?: boolean;
}

export interface PriceHistoryStats {
  min: number;
  max: number;
  count: number;
}

export interface PriceHistoryBar {
  visible: boolean;
  percent: number;
  tone: 'good' | 'neutral' | 'high';
}

/**
 * Identify the deal kind from its source.
 * @param source - Scanner source identifier.
 * @returns Award for seats.aero, otherwise cash.
 */
export function getDealKind(source: string): DealKind {
  return source === 'seats_aero' ? 'award' : 'cash';
}

/**
 * Classify route range, falling back to duration only when distance is unknown.
 * @param input - Route distance and flight duration, if available.
 * @returns Europe, long haul, or null when neither measurement is known.
 */
export function classifyDealRange(input: {
  routeDistanceKm: number | null;
  flightDurationMinutes: number | null;
}): DealRange | null {
  if (input.routeDistanceKm !== null) {
    return input.routeDistanceKm <= EUROPE_MAX_DISTANCE_KM ? 'europe' : 'long_haul';
  }
  if (input.flightDurationMinutes !== null) {
    return input.flightDurationMinutes <= EUROPE_MAX_DURATION_MINUTES ? 'europe' : 'long_haul';
  }
  return null;
}

/**
 * Identify deals in their first 24 hours after discovery.
 * @param createdAt - First discovery timestamp.
 * @param now - Current timestamp supplied by the caller.
 * @returns Whether the deal is less than 24 hours old.
 */
export function isFreshDeal(createdAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= 0 && ageMs < 24 * HOUR_MS;
}

/**
 * Compute whole hours since a scanner last saw a deal.
 * @param updatedAt - Last discovery timestamp.
 * @param now - Current timestamp supplied by the caller.
 * @returns Floored elapsed hours, never negative.
 */
export function getLastSeenHours(updatedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / HOUR_MS));
}

/**
 * Build the compact price-history bar state for cash deals.
 * @param kind - Deal kind whose prices were measured.
 * @param price - Current displayed price.
 * @param stats - Historical min/max/count data for the route.
 * @returns Normalized bar visibility, position, and color tone.
 */
export function buildPriceHistoryBar(
  kind: DealKind,
  price: number,
  stats: PriceHistoryStats,
): PriceHistoryBar {
  if (kind !== 'cash' || stats.count < 3 || stats.max <= stats.min) {
    return { visible: false, percent: 0, tone: 'neutral' };
  }

  const rawPercent = ((price - stats.min) / (stats.max - stats.min)) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));

  return {
    visible: true,
    percent,
    tone: percent < 25 ? 'good' : percent <= 60 ? 'neutral' : 'high',
  };
}

/**
 * Sort deals, prioritizing fresh discoveries only when sorting by score.
 * @param deals - Presented deals with their computed freshness.
 * @param sort - Selected sort option.
 * @returns A new sorted array preserving the input's deal type and contents.
 */
export function sortPresentedDeals<T extends PresentableDeal & { isFresh: boolean }>(
  deals: T[],
  sort: DealSortOption,
): T[] {
  return [...deals].sort((left, right) => {
    if (sort === 'price') {
      return left.price - right.price;
    }
    if (sort === 'date') {
      return left.departureDate.getTime() - right.departureDate.getTime();
    }

    const freshDelta = Number(right.isFresh) - Number(left.isFresh);
    if (freshDelta !== 0) {
      return freshDelta;
    }
    const preferredOriginDelta =
      Number(right.preferredOriginMatch === true) - Number(left.preferredOriginMatch === true);
    if (preferredOriginDelta !== 0) {
      return preferredOriginDelta;
    }

    const scoreDelta =
      (right.personalizedScore ?? right.dealScore) - (left.personalizedScore ?? left.dealScore);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const personalizationDelta =
      right.personalizationReasons.length - left.personalizationReasons.length;
    return personalizationDelta || right.dealScore - left.dealScore;
  });
}
