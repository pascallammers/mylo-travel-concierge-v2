import {
  buildDealInsight,
  buildPriceHistoryBar,
  classifyDealBucket,
  sortPresentedDeals,
  type DealBucket,
  type DealSortOption,
  type PresentableDeal,
  type PriceHistoryBar,
  type PriceHistoryStats,
} from './deal-presenter';

export interface DealsPageModelDeal extends PresentableDeal {
  id: string;
  affiliateLink: string | null;
  stops: number | null;
  tripType: 'roundtrip' | 'oneway';
  updatedAt: Date;
  routeDistanceKm?: number | null;
  priceHistoryStats?: PriceHistoryStats | null;
}

export interface DealsPageFilters {
  origin?: string;
  stops?: number;
  tripType?: 'roundtrip' | 'oneway';
  bucket?: DealBucket | 'all';
  sort?: DealSortOption;
}

export interface PresentedDeal extends DealsPageModelDeal {
  bucket: DealBucket;
  insight: ReturnType<typeof buildDealInsight>;
  priceHistoryBar: PriceHistoryBar;
}

export interface DealsPageModel {
  activeBucket: DealBucket | 'all';
  bucketCounts: Record<DealBucket, number>;
  visibleBuckets: Record<DealBucket, PresentedDeal[]>;
  featuredDeal: PresentedDeal | null;
  hasPersonalization: boolean;
  staleHours: number | null;
}

export interface BuildDealsPageModelInput {
  deals: DealsPageModelDeal[];
  filters: DealsPageFilters;
  now: Date;
}

/**
 * Build the server-side page model for the deals experience.
 *
 * @param input - Raw deals, active filters, and current time.
 * @returns Grouped, filtered, and presentation-ready deal data.
 */
export function buildDealsPageModel(
  input: BuildDealsPageModelInput,
): DealsPageModel {
  const activeBucket = input.filters.bucket ?? 'all';
  const sort = input.filters.sort ?? 'score';
  const presentableDeals = input.deals.map((deal) => presentDeal(deal));
  const filteredDeals = filterDeals(presentableDeals, input.filters);
  const bucketCounts = countDealsByBucket(filteredDeals);
  const visibleBuckets = createEmptyDealBuckets();

  for (const bucket of getOrderedBuckets()) {
    if (activeBucket !== 'all' && activeBucket !== bucket) {
      visibleBuckets[bucket] = [];
      continue;
    }

    visibleBuckets[bucket] = sortPresentedDeals(
      filteredDeals.filter((deal) => deal.bucket === bucket),
      sort,
    ) as PresentedDeal[];
  }

  return {
    activeBucket,
    bucketCounts,
    visibleBuckets,
    featuredDeal: getFeaturedDeal(filteredDeals),
    hasPersonalization: filteredDeals.some((deal) => deal.personalizationReasons.length > 0),
    staleHours: getStaleHours(input.deals, input.now),
  };
}

function presentDeal(deal: DealsPageModelDeal): PresentedDeal {
  const bucket = classifyDealBucket(deal, {
    routeDistanceKm: deal.routeDistanceKm ?? null,
  });

  return {
    ...deal,
    bucket,
    insight: buildDealInsight(deal, bucket),
    priceHistoryBar: buildPriceHistoryBar(
      deal.price,
      deal.priceHistoryStats ?? {
        min: deal.price,
        max: deal.price,
        count: 0,
      },
    ),
  };
}

function filterDeals(
  deals: PresentedDeal[],
  filters: DealsPageFilters,
): PresentedDeal[] {
  return deals.filter((deal) => {
    if (filters.origin && deal.origin !== filters.origin) {
      return false;
    }

    if (filters.tripType && deal.tripType !== filters.tripType) {
      return false;
    }

    if (filters.stops !== undefined && (deal.stops ?? 0) > filters.stops) {
      return false;
    }

    return true;
  });
}

function countDealsByBucket(
  deals: PresentedDeal[],
): Record<DealBucket, number> {
  const counts = createEmptyBucketCounts();

  for (const deal of deals) {
    counts[deal.bucket] += 1;
  }

  return counts;
}

function createEmptyDealBuckets(): Record<DealBucket, PresentedDeal[]> {
  return {
    weekend_escape: [],
    long_haul: [],
    points: [],
  };
}

function getOrderedBuckets(): DealBucket[] {
  return ['weekend_escape', 'long_haul', 'points'];
}

function getFeaturedDeal(deals: PresentedDeal[]): PresentedDeal | null {
  if (deals.length === 0) {
    return null;
  }

  const sorted = sortPresentedDeals(deals, 'score') as PresentedDeal[];
  return sorted[0] ?? null;
}

function createEmptyBucketCounts(): Record<DealBucket, number> {
  return {
    weekend_escape: 0,
    long_haul: 0,
    points: 0,
  };
}

function getStaleHours(
  deals: DealsPageModelDeal[],
  now: Date,
): number | null {
  if (deals.length === 0) {
    return null;
  }

  const latestUpdateMs = deals.reduce((latest, deal) => {
    const updatedAtMs = deal.updatedAt.getTime();
    return updatedAtMs > latest ? updatedAtMs : latest;
  }, 0);

  const diffMs = now.getTime() - latestUpdateMs;

  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
}
