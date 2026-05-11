/**
 * Public barrel for the borski-toolkit adapter.
 *
 * Use this module to consume borski's static travel-hacking data inside MYLO:
 * transfer ratios, sweet spots, points valuations, partner award charts,
 * alliance memberships, and hotel-chain metadata.
 *
 * Schemas live under `./schemas/` and re-validate every load.
 *
 * @module lib/data/borski-toolkit-adapter
 */

export {
  loadTransferPartners,
  loadSweetSpots,
  loadPointsValuations,
  loadAlliances,
  loadPartnerAwards,
  loadHotelChains,
  resetBorskiCaches,
} from './load-from-borski';

export * from './schemas';
