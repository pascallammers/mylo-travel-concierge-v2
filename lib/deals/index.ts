export {
  buildDealInsight,
  buildPriceHistoryBar,
  classifyDealBucket,
  sortPresentedDeals,
  type DealBucket,
  type DealInsight,
  type DealSortOption,
  type PresentableDeal,
  type PriceHistoryBar,
  type PriceHistoryStats,
} from './deal-presenter';
export {
  buildDealsPageModel,
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
