/**
 * Multi-region transfer-engine types.
 *
 * Used to model loyalty-points transfer partners across regions and source programs.
 * - DACH region: Amex Membership Rewards Germany.
 * - US region: Chase Ultimate Rewards, Amex Membership Rewards US, Bilt Rewards,
 *   Capital One Miles, Citi ThankYou Points.
 */

/**
 * Localized string with German and English translations.
 */
export interface LocalizedString {
  de: string;
  en: string;
}

/**
 * Supported display locales.
 */
export type TransferLocale = 'de' | 'en';

/**
 * Airline alliance memberships. Use `null` for non-aligned carriers and hotels.
 */
export type Alliance = 'Star Alliance' | 'Oneworld' | 'SkyTeam' | null;

/**
 * Loyalty-program category. `other` is reserved for indirect routes (e.g. PAYBACK -> Miles & More).
 */
export type PartnerType = 'airline' | 'hotel' | 'other';

/**
 * A single transfer partner. Field names are kept compatible with the legacy
 * `AmexTransferPartner` type so that DACH consumers keep working unchanged.
 *
 * - `amexPoints` is the source-program numerator (renamed semantically to "source points"
 *   for US programs, but kept for backward compat).
 * - `partnerMiles` is the partner-program denominator.
 * - `effectiveRate` is the percentage value of the ratio (partnerMiles / amexPoints * 100).
 */
export interface TransferPartner {
  /** Display name of the loyalty program */
  name: string;
  /** Airline or hotel brand */
  brand: string;
  /** Source-program points required (numerator). Named `amexPoints` for backward compat. */
  amexPoints: number;
  /** Partner-program points/miles received (denominator). */
  partnerMiles: number;
  /** Effective transfer rate as percentage (partnerMiles / amexPoints * 100). */
  effectiveRate: number;
  /** Minimum source points required per transfer. */
  minTransfer: number;
  /** Source points must be transferred in multiples of this number. */
  transferIncrement: number;
  /** Estimated transfer duration (localized). */
  transferDuration: LocalizedString;
  /** Alliance membership for airlines, `null` otherwise. */
  alliance?: Alliance;
  /** Loyalty-program category. */
  type: PartnerType;
  /** Currency unit name (localized), e.g. "Meilen" / "Miles". */
  currencyUnit: LocalizedString;
  /** Optional notes about the program (sweet spots, devaluations, etc.). */
  notes?: LocalizedString;
}

/**
 * Map of partner-id -> TransferPartner. Partner IDs are short keys
 * (e.g. `flyingBlue`, `unitedMileagePlus`).
 */
export type PartnerMap = Record<string, TransferPartner>;

/**
 * Backward-compatible alias for the legacy AmexTransferPartner type.
 * @deprecated Use `TransferPartner` directly.
 */
export type AmexTransferPartner = TransferPartner;
