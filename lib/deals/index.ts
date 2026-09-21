export {
  buildPriceHistoryBar,
  classifyDealRange,
  EUROPE_MAX_DISTANCE_KM,
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
export {
  MAX_ORIGIN_FILTERS,
  buildDealsPageModel,
  parseDealsFilters,
  type BuildDealsPageModelInput,
  type DealsPageFilters,
  type DealsPageModel,
  type DealsPageModelDeal,
  type PresentedDeal,
} from './deals-page-model';
export { buildDealsPageData } from './deals-page-data';
export {
  createDealPreferenceSnapshot,
  hasActiveDealPreferences,
  parseAirportCodeList,
  resolveAirportCodeList,
  scoreDealForPreferences,
  selectTopPersonalizedDeals,
  type DealPreferenceSnapshot,
  type PersonalizedDealScore,
} from './deal-personalization';
