import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import type { SeatsAeroFlight, SeatsAeroSearchParams, searchSeatsAero } from '@/lib/api/seats-aero-client';

/** Failure metadata travels with each award leg, independently of cash results. */
export interface AwardSearchFailure {
  errorType?: 'rate_limited' | 'provider_unavailable';
  resetsAt?: Date | null;
}

/**
 * Preserve the award failure category while allowing cash searches to finish.
 * @param params - Award search parameters for one leg.
 * @param search - Injected award provider.
 * @param signal - Optional request cancellation signal.
 * @returns Flights, or a typed failure with the quota reset time when known.
 */
export async function searchAwardFlights(
  params: SeatsAeroSearchParams,
  search: typeof searchSeatsAero,
  signal?: AbortSignal,
): Promise<AwardSearchFailure & { flights: SeatsAeroFlight[] | null }> {
  try {
    return { flights: await search(params, signal) };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error('[Flight Search] Award search failed:', error);
    return error instanceof SeatsAeroQuotaExhaustedError
      ? { flights: null, errorType: 'rate_limited', resetsAt: error.resetsAt }
      : { flights: null, errorType: 'provider_unavailable' };
  }
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
