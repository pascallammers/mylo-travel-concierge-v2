export type DealBucket = 'weekend_escape' | 'long_haul' | 'points';
export type DealSortOption = 'score' | 'price' | 'savings';

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

export interface DealBucketOptions {
  routeDistanceKm?: number | null;
}

export interface DealInsight {
  why: string;
  forWhom: string;
  recommendation: {
    kind: 'book' | 'watch';
    confidence: number;
  };
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
 * Classify a deal into one of the three product buckets.
 *
 * @param deal - Minimal deal data required for bucket assignment.
 * @param options - Optional route metadata like computed distance.
 * @returns Bucket identifier used for UI grouping and filtering.
 */
export function classifyDealBucket(
  deal: PresentableDeal,
  options: DealBucketOptions = {},
): DealBucket {
  if (isPointsDealSource(deal.source)) {
    return 'points';
  }

  const routeDistanceKm = options.routeDistanceKm ?? null;
  const tripDurationDays = getTripDurationDays(deal.departureDate, deal.returnDate);
  const isShortDistance =
    (routeDistanceKm !== null && routeDistanceKm <= 2500) ||
    (deal.flightDurationMinutes !== null && deal.flightDurationMinutes <= 240);

  if (isShortDistance && (tripDurationDays === null || tripDurationDays <= 5)) {
    return 'weekend_escape';
  }

  return 'long_haul';
}

/**
 * Build the explanatory copy used on deal cards.
 *
 * @param deal - Minimal deal data required for the copy.
 * @param bucket - Resolved bucket for this deal.
 * @returns Why-text, audience-text, and booking recommendation.
 */
export function buildDealInsight(
  deal: PresentableDeal,
  bucket: DealBucket,
): DealInsight {
  const why = isPointsDealSource(deal.source)
    ? `Sweet Spot bei ${deal.airline ?? 'Miles & More'}.`
    : buildCashDealWhy(deal);
  const recommendation =
    deal.dealScore >= 85
      ? { kind: 'book' as const, confidence: clampPercentage(deal.dealScore) }
      : { kind: 'watch' as const, confidence: clampPercentage(100 - deal.dealScore) };

  return {
    why,
    forWhom: buildAudienceText(bucket),
    recommendation,
  };
}

/**
 * Build the compact price-history bar state for the UI.
 *
 * @param price - Current displayed price.
 * @param stats - Historical min/max/count data for the route.
 * @returns Normalized bar visibility, position, and color tone.
 */
export function buildPriceHistoryBar(
  price: number,
  stats: PriceHistoryStats,
): PriceHistoryBar {
  if (stats.count < 5 || stats.max <= stats.min) {
    return {
      visible: false,
      percent: 0,
      tone: 'neutral',
    };
  }

  const rawPercent = ((price - stats.min) / (stats.max - stats.min)) * 100;
  const percent = clampPercentage(Math.round(rawPercent));

  return {
    visible: true,
    percent,
    tone: percent < 25 ? 'good' : percent <= 60 ? 'neutral' : 'high',
  };
}

/**
 * Sort deal arrays for the page-level filters.
 *
 * @param deals - Presentable deals to sort.
 * @param sort - Sort option selected in the UI.
 * @returns A new, sorted array without mutating the input.
 */
export function sortPresentedDeals(
  deals: PresentableDeal[],
  sort: DealSortOption,
): PresentableDeal[] {
  return [...deals].sort((left, right) => {
    const preferredOriginDelta =
      Number(right.preferredOriginMatch === true) - Number(left.preferredOriginMatch === true);
    if (preferredOriginDelta !== 0) {
      return preferredOriginDelta;
    }

    if (sort === 'price') {
      return left.price - right.price;
    }

    if (sort === 'savings') {
      return (right.priceDifference ?? 0) - (left.priceDifference ?? 0);
    }

    const scoreDelta =
      (right.personalizedScore ?? right.dealScore) - (left.personalizedScore ?? left.dealScore);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const personalizationDelta =
      right.personalizationReasons.length - left.personalizationReasons.length;
    if (personalizationDelta !== 0) {
      return personalizationDelta;
    }

    return right.dealScore - left.dealScore;
  });
}

function buildCashDealWhy(deal: PresentableDeal): string {
  if (deal.priceChangePercent !== null && deal.priceChangePercent > 0) {
    return `${Math.round(deal.priceChangePercent)}% günstiger als üblich.`;
  }

  if (deal.averagePrice !== null && deal.averagePrice > deal.price) {
    return 'Deutlich unter dem Durchschnittspreis dieser Route.';
  }

  return 'Aktuell ein auffällig starker Preis für diese Route.';
}

function buildAudienceText(bucket: DealBucket): string {
  if (bucket === 'weekend_escape') {
    return 'Ideal für ein langes Wochenende.';
  }

  if (bucket === 'points') {
    return 'Für Meilensammler mit flexiblem Reisedatum.';
  }

  return 'Perfekt für Fernreise-Entdecker.';
}

function getTripDurationDays(
  departureDate: Date,
  returnDate: Date | null,
): number | null {
  if (!returnDate) {
    return null;
  }

  const diffMs = returnDate.getTime() - departureDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > 0 ? diffDays : null;
}

function isPointsDealSource(source: string): boolean {
  return source.toLowerCase().includes('seats');
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
