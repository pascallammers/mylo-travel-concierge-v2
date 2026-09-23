import { buildAwardDealView, type AwardDealContext, type AwardDealFields, type AwardDealView } from './award-deal-view';
import {
  buildPriceHistoryBar,
  classifyDealRange,
  getDealKind,
  getLastSeenHours,
  isFreshDeal,
  sortPresentedDeals,
  type DealKind,
  type DealRange,
  type DealSortOption,
  type PresentableDeal,
  type PriceHistoryBar,
  type PriceHistoryStats,
} from './deal-presenter';

export interface DealsPageModelDeal extends PresentableDeal, AwardDealFields {
  id: string;
  affiliateLink: string | null;
  stops: number | null;
  tripType: 'roundtrip' | 'oneway';
  createdAt: Date;
  updatedAt: Date;
  preferredOriginMatch: boolean;
  routeDistanceKm?: number | null;
  priceHistoryStats?: PriceHistoryStats | null;
  savingsPercent: number | null;
}

export interface DealsPageFilters {
  kind: DealKind;
  origins: string[];
  range?: DealRange;
  sort: DealSortOption;
}

export type PresentedDeal = DealsPageModelDeal & {
  range: DealRange | null;
  isFresh: boolean;
  lastSeenHours: number;
  priceHistoryBar: PriceHistoryBar;
} & ({ kind: 'award'; award: AwardDealView } | { kind: 'cash'; award: null });

export interface DealsPageModel {
  activeKind: DealKind;
  kindCounts: Record<DealKind, number>;
  deals: PresentedDeal[];
  unreachableDeals: PresentedDeal[];
  staleHours: number | null;
}

export const MAX_ORIGIN_FILTERS = 10;

export interface BuildDealsPageModelInput {
  deals: DealsPageModelDeal[];
  filters: DealsPageFilters;
  now: Date;
  awardContext: AwardDealContext;
}

/**
 * Parse untrusted URL parameters once at the deals page boundary.
 * @param searchParams - Next.js search parameters; repeated keys use the first value.
 * @param preferredOrigins - Persisted origins used only when origin is absent.
 * @returns Validated filters with award and score as defaults.
 */
export function parseDealsFilters(
  searchParams: Record<string, string | string[] | undefined>,
  preferredOrigins: string[],
): DealsPageFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const origin = first(searchParams.origin);
  const range = first(searchParams.range);
  const sort = first(searchParams.sort);

  return {
    kind: first(searchParams.kind) === 'cash' ? 'cash' : 'award',
    origins: origin === undefined
      ? [...preferredOrigins]
      : origin.trim().toLowerCase() === 'all'
        ? []
        : [...new Set(origin.split(',').map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{3}$/.test(code)))].slice(0, MAX_ORIGIN_FILTERS),
    range: range === 'europe' || range === 'long_haul' ? range : undefined,
    sort: sort === 'price' || sort === 'date' ? sort : 'score',
  };
}

/**
 * Build the server-side page model for the deals experience.
 * @param input - Raw deals, typed filters, current time and injected award context.
 * @returns Reachable and unreachable lists, with counts including both before the kind filter.
 */
export function buildDealsPageModel(input: BuildDealsPageModelInput): DealsPageModel {
  const { filters, now } = input;
  const filteredDeals = input.deals.map((deal) => presentDeal(deal, now, input.awardContext)).filter((deal) => (
    (filters.origins.length === 0 || filters.origins.includes(deal.origin)) &&
    (filters.range === undefined || deal.range === filters.range)
  ));
  const kindCounts: Record<DealKind, number> = { award: 0, cash: 0 };
  for (const deal of filteredDeals) {
    kindCounts[deal.kind] += 1;
  }

  const sortedDeals = sortPresentedDeals(filteredDeals.filter((deal) => deal.kind === filters.kind), filters.sort);
  return {
    activeKind: filters.kind,
    kindCounts,
    deals: sortedDeals.filter((deal) => deal.award?.reachability !== 'unreachable'),
    unreachableDeals: sortedDeals.filter((deal) => deal.award?.reachability === 'unreachable'),
    staleHours: getStaleHours(input.deals, now),
  };
}

function presentDeal(deal: DealsPageModelDeal, now: Date, awardContext: AwardDealContext): PresentedDeal {
  const kind = getDealKind(deal.source);
  return {
    ...deal,
    ...(kind === 'award'
      ? { kind, award: buildAwardDealView(deal, awardContext) }
      : { kind, award: null }),
    range: classifyDealRange({
      routeDistanceKm: deal.routeDistanceKm ?? null,
      flightDurationMinutes: deal.flightDurationMinutes,
    }),
    isFresh: isFreshDeal(deal.createdAt, now),
    lastSeenHours: getLastSeenHours(deal.updatedAt, now),
    priceHistoryBar: buildPriceHistoryBar(
      kind,
      deal.price,
      deal.priceHistoryStats ?? { min: deal.price, max: deal.price, count: 0 },
    ),
  };
}

function getStaleHours(deals: DealsPageModelDeal[], now: Date): number | null {
  if (deals.length === 0) {
    return null;
  }
  const latestUpdate = deals.reduce((latest, deal) => (
    deal.updatedAt > latest ? deal.updatedAt : latest
  ), deals[0].updatedAt);
  return getLastSeenHours(latestUpdate, now);
}
