import type { FlightDeal, UserDealPreferences } from '@/lib/db/schema';
import type { PresentableDeal } from './deal-presenter';
import { lookupAirportByName } from '@/lib/utils/airport-database';

export interface DealPreferenceSnapshot {
  originAirports: string[];
  preferredDestinations: string[];
  cabinClass: FlightDeal['cabinClass'] | null;
  maxPrice: number | null;
  emailDigest: 'none' | 'weekly' | 'daily';
}

export interface PersonalizedDealScore {
  score: number;
  reasons: string[];
}

type PersonalizableDeal = Pick<
  FlightDeal,
  'origin' | 'destination' | 'price' | 'currency' | 'cabinClass' | 'source'
> &
  Pick<PresentableDeal, 'dealScore' | 'destinationName'>;

/**
 * Convert the nullable database record into a normalized preference snapshot.
 *
 * @param preferences - Raw persisted user preferences or null.
 * @returns Sanitized preferences with uppercase airport codes and safe defaults.
 */
export function createDealPreferenceSnapshot(
  preferences: UserDealPreferences | null,
): DealPreferenceSnapshot {
  return {
    originAirports: normalizeAirportCodes(preferences?.originAirports ?? []),
    preferredDestinations: normalizeAirportCodes(preferences?.preferredDestinations ?? []),
    cabinClass: preferences?.cabinClass ?? null,
    maxPrice: preferences?.maxPrice ?? null,
    emailDigest: preferences?.emailDigest ?? 'none',
  };
}

/**
 * Decide whether the user has any meaningful deal preferences configured.
 *
 * @param preferences - Normalized preference snapshot.
 * @returns True when at least one personalization signal is available.
 */
export function hasActiveDealPreferences(
  preferences: DealPreferenceSnapshot | null | undefined,
): boolean {
  if (!preferences) {
    return false;
  }

  return (
    preferences.originAirports.length > 0 ||
    preferences.preferredDestinations.length > 0 ||
    preferences.cabinClass !== null ||
    preferences.maxPrice !== null
  );
}

/**
 * Score a deal against the user's saved preferences.
 *
 * @param deal - Deal candidate to personalize.
 * @param preferences - Normalized preference snapshot.
 * @returns Personalized score and short explanation reasons.
 */
export function scoreDealForPreferences(
  deal: PersonalizableDeal,
  preferences: DealPreferenceSnapshot,
): PersonalizedDealScore {
  let score = deal.dealScore;
  const reasons: string[] = [];

  if (
    preferences.originAirports.length > 0 &&
    preferences.originAirports.includes(deal.origin.toUpperCase())
  ) {
    score += 10;
    reasons.push(`Abflug ab ${deal.origin}`);
  }

  if (
    preferences.preferredDestinations.length > 0 &&
    preferences.preferredDestinations.includes(deal.destination.toUpperCase())
  ) {
    score += 14;
    reasons.push(`Ziel ${deal.destination}`);
  }

  if (preferences.cabinClass && deal.cabinClass === preferences.cabinClass) {
    score += 8;
    reasons.push(`passt zu deiner ${formatCabinClassLabel(preferences.cabinClass)}-Präferenz`);
  }

  if (preferences.maxPrice !== null && isCashDeal(deal.currency)) {
    if (deal.price <= preferences.maxPrice) {
      score += 10;
      reasons.push(`liegt unter deinem Preislimit von ${Math.round(preferences.maxPrice)} ${deal.currency}`);
    } else if (deal.price > preferences.maxPrice * 1.15) {
      score -= 35;
    }
  }

  if (isPointsDeal(deal.source) && preferences.cabinClass && isPremiumCabin(preferences.cabinClass)) {
    score += 4;
    reasons.push('starker Punkte-Deal für Premium-Cabin-Fokus');
  }

  return {
    score: clampScore(score),
    reasons: dedupeReasons(reasons),
  };
}

/**
 * Return the best matching deals for a given preference snapshot.
 *
 * @param deals - Available deals to rank.
 * @param preferences - Normalized preference snapshot.
 * @param limit - Maximum number of matches to return.
 * @returns Deals ordered by personalized score and baseline score.
 */
export function selectTopPersonalizedDeals<T extends PersonalizableDeal>(
  deals: T[],
  preferences: DealPreferenceSnapshot,
  limit = 3,
): Array<{ deal: T; personalization: PersonalizedDealScore }> {
  return deals
    .map((deal) => ({
      deal,
      personalization: scoreDealForPreferences(deal, preferences),
    }))
    .filter(({ personalization }) => personalization.reasons.length > 0 || personalization.score >= 85)
    .sort((left, right) => {
      if (right.personalization.score !== left.personalization.score) {
        return right.personalization.score - left.personalization.score;
      }

      if (right.personalization.reasons.length !== left.personalization.reasons.length) {
        return right.personalization.reasons.length - left.personalization.reasons.length;
      }

      return right.deal.dealScore - left.deal.dealScore;
    })
    .slice(0, limit);
}

/**
 * Parse a comma-separated airport list into uppercase IATA codes.
 *
 * @param value - Raw text input from the preferences form.
 * @returns Unique list of normalized airport codes.
 */
export function parseAirportCodeList(value: string): string[] {
  return normalizeAirportCodes(value.split(','));
}

/**
 * Resolve a comma-separated list of airport codes, airport names, or city names.
 *
 * @param value - Raw text input from the preferences form.
 * @returns Unique list of normalized IATA codes.
 */
export async function resolveAirportCodeList(value: string): Promise<string[]> {
  const segments = value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const resolvedCodes = await Promise.all(
    segments.map(async (segment) => {
      if (/^[a-z]{3}$/i.test(segment)) {
        return segment.toUpperCase();
      }

      const resolvedAirport = await lookupAirportByName(segment);
      return resolvedAirport?.iataCode ?? null;
    }),
  );

  return normalizeAirportCodes(resolvedCodes.filter((code): code is string => code !== null));
}

function normalizeAirportCodes(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^[A-Z]{3}$/.test(value)),
    ),
  );
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isCashDeal(currency: string): boolean {
  return currency !== 'PTS' && currency !== 'MIL';
}

function isPointsDeal(source: string): boolean {
  return source.toLowerCase().includes('seats');
}

function isPremiumCabin(cabinClass: FlightDeal['cabinClass']): boolean {
  return cabinClass === 'business' || cabinClass === 'first';
}

function formatCabinClassLabel(cabinClass: FlightDeal['cabinClass']): string {
  if (cabinClass === 'premium_economy') {
    return 'Premium-Economy';
  }

  return cabinClass;
}
