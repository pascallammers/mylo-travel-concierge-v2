import { applyAwardFilters } from '@/lib/api/award-search/award-filters';
import type { SeatsAeroFlight, SeatsAeroSearchParams } from '@/lib/api/seats-aero-client';
import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import { tierAwardTrips, type DirectTiering, type FlightLocale } from './direct-tiering';
import { searchWindowBounds, type ResolvedFlightSearch, type SearchWindow } from './search-input';

export type AwardOption = SeatsAeroFlight;
export interface AwardSearchDeps {
  searchTrips(params: SeatsAeroSearchParams, signal?: AbortSignal): Promise<AwardOption[]>;
}
export type AwardFailure =
  | { readonly kind: 'rate_limited'; readonly resetsAt: Date | null }
  | { readonly kind: 'provider_unavailable' };
export type AwardLeg =
  | { readonly status: 'ok'; readonly options: AwardOption[]; readonly foundCount: number; readonly tiering: DirectTiering | null }
  | { readonly status: 'failed'; readonly failure: AwardFailure };
export type InboundLeg = AwardLeg | { readonly status: 'skipped'; readonly reason: 'one_way' };
export interface AwardSearchResult {
  readonly outbound: AwardLeg;
  readonly inbound: InboundLeg;
  readonly filterNotes: string[];
}
/** Legacy renderer failure metadata (chat wire format stays unchanged). */
export interface AwardSearchFailure {
  errorType?: AwardFailure['kind'];
  resetsAt?: Date | null;
}

/**
 * Search one or two award legs, ranking before filters and preserving typed failures.
 * @param search - Validated route and independent date windows.
 * @param deps - Ungrouped provider search; the core has no other I/O.
 * @param options - Notice language and optional cancellation signal.
 * @returns Per-leg outcomes and deduplicated filter notes.
 */
export async function searchAwards(
  search: ResolvedFlightSearch, deps: AwardSearchDeps,
  options: { locale: FlightLocale; signal?: AbortSignal },
): Promise<AwardSearchResult> {
  async function leg(window: SearchWindow, reverse: boolean): Promise<{ leg: AwardLeg; notes: string[] }> {
    const month = window.kind === 'month';
    const params: SeatsAeroSearchParams = {
      origin: reverse ? search.destination : search.origin,
      destination: reverse ? search.origin : search.destination,
      departureDate: month ? searchWindowBounds(window, search.today).start : window.date,
      travelClass: search.cabin,
      flexibility: month ? 0 : window.flexDays,
      maxResults: month || window.flexDays > 0 ? 100 : 60,
      ...(month ? { endDate: searchWindowBounds(window, search.today).end } : {}),
    };
    let trips: AwardOption[];
    try {
      options.signal?.throwIfAborted();
      trips = await deps.searchTrips(params, options.signal);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      console.error('[Award Search] Provider search failed:', error);
      return { leg: { status: 'failed', failure: error instanceof SeatsAeroQuotaExhaustedError
        ? { kind: 'rate_limited', resetsAt: error.resetsAt }
        : { kind: 'provider_unavailable' } }, notes: [] };
    }
    const ranked = tierAwardTrips(trips, search.nonStop ? 'direct' : 'any');
    const filtered = applyAwardFilters(ranked.options, {
      loyaltyPrograms: search.loyaltyPrograms, maxTaxes: search.maxTaxes, locale: options.locale,
    });
    return { leg: { status: 'ok', options: filtered.flights, foundCount: ranked.options.length, tiering: ranked.tiering }, notes: filtered.notes };
  }
  const [outbound, inbound] = await Promise.all([
    leg(search.outbound, false), search.inbound ? leg(search.inbound, true) : null,
  ]);
  return {
    outbound: outbound.leg,
    inbound: inbound?.leg ?? { status: 'skipped', reason: 'one_way' },
    filterNotes: [...new Set([...outbound.notes, ...(inbound?.notes ?? [])])],
  };
}

/**
 * Describe an exhausted daily award budget without exposing the provider.
 * @param resetsAt - Reported reset time, if known.
 * @param locale - Language for the notice.
 * @returns A daily-quota notice with the reset time in Europe/Berlin.
 */
export function formatAwardQuotaNotice(resetsAt: Date | null | undefined, locale: 'de' | 'en'): string {
  const time = resetsAt
    ? new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(resetsAt)
    : null;
  if (locale === 'de') {
    return `Die Prämiensuche ist für heute ausgelastet. ${time ? `Ab ${time} Uhr ist sie wieder verfügbar.` : 'Nach dem täglichen Zurücksetzen ist sie wieder verfügbar.'}`;
  }
  return `Award search has reached its daily limit. ${time ? `It will be available again at ${time} (Berlin time).` : 'It will be available again after the daily reset.'}`;
}
