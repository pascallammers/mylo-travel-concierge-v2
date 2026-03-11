/**
 * Tool Error Response Utility
 *
 * Provides graceful error handling for AI SDK tools.
 * Instead of throwing exceptions that break the chat flow,
 * tools return structured error responses that the LLM can interpret
 * and present to users in a friendly way.
 */

import { buildGoogleFlightsUrl, buildSkyscannerUrl, FlightSearchLinkParams } from './flight-search-links';

/**
 * Error types for categorizing tool failures
 */
export type ToolErrorType =
  | 'no_results' // Search completed but found nothing
  | 'provider_unavailable' // External API is down or erroring
  | 'partial_failure' // Some providers worked, others failed
  | 'validation_error' // Invalid input parameters
  | 'rate_limited' // Too many requests
  | 'timeout'; // Request took too long

/**
 * Structured error response that tools return instead of throwing
 */
export interface ToolErrorResponse {
  success: false;
  errorType: ToolErrorType;
  userMessage: string;
  suggestions: string[];
  fallbackLinks?: {
    googleFlights?: string;
    skyscanner?: string;
  };
  technicalDetails?: string;
}

/**
 * Successful tool response wrapper
 */
export interface ToolSuccessResponse<T> {
  success: true;
  data: T;
  partialFailures?: string[];
}

/**
 * Union type for tool responses
 */
export type ToolResponse<T> = ToolSuccessResponse<T> | ToolErrorResponse;

/**
 * Supported locale for tool error responses.
 */
export type ToolErrorLocale = 'de' | 'en';

/**
 * Parameters for creating a graceful error response
 */
export interface GracefulErrorParams {
  type: ToolErrorType;
  message: string;
  suggestions?: string[];
  searchParams?: FlightSearchLinkParams;
  technicalDetails?: string;
  locale?: ToolErrorLocale;
}

/**
 * Alternative airport for display in error messages
 */
export interface AlternativeAirport {
  code: string;
  name: string;
  city: string;
  distance: string;  // Already formatted as "~1,5h Fahrt"
}

/**
 * Extended error params with alternative airports
 */
export interface GracefulErrorWithAlternatives extends GracefulErrorParams {
  alternatives?: AlternativeAirport[];
  emptyAirport?: 'origin' | 'destination';
  originalAirportName?: string;  // e.g., "Frankfurt (FRA)"
}

/**
 * Creates a user-friendly error response for flight search failures
 *
 * @param params - Error parameters
 * @returns Formatted error string that the LLM can interpret
 */
export function formatGracefulFlightError(params: GracefulErrorParams): string {
  const {
    type,
    message,
    locale = 'de',
    suggestions = getDefaultSuggestions(type, locale),
    searchParams,
    technicalDetails,
  } = params;

  const sections: string[] = [];

  sections.push(getErrorHeader(type, locale));

  sections.push(`\n${message}\n`);

  if (suggestions.length > 0) {
    sections.push(`\n**${locale === 'de' ? 'Was Sie tun können' : 'What you can do'}:**`);
    suggestions.forEach((s) => sections.push(`- ${s}`));
  }

  if (searchParams) {
    const googleUrl = buildGoogleFlightsUrl(searchParams);
    const skyscannerUrl = buildSkyscannerUrl(searchParams);

    sections.push(`\n**${locale === 'de' ? 'Alternative Suchoptionen' : 'Alternative search options'}:**`);
    sections.push(`- [Google Flights ${locale === 'de' ? 'öffnen' : 'open'}](${googleUrl})`);
    sections.push(`- [Skyscanner ${locale === 'de' ? 'öffnen' : 'open'}](${skyscannerUrl})`);
  }

  if (technicalDetails) {
    console.warn(`[Tool Error] Technical details: ${technicalDetails}`);
  }

  return sections.join('\n');
}

/**
 * Returns appropriate header based on error type and locale
 */
function getErrorHeader(type: ToolErrorType, locale: ToolErrorLocale = 'de'): string {
  const headers: Record<ToolErrorType, Record<ToolErrorLocale, string>> = {
    no_results: { de: '## Keine Flüge gefunden', en: '## No flights found' },
    provider_unavailable: { de: '## Flugsuche vorübergehend eingeschränkt', en: '## Flight search temporarily limited' },
    partial_failure: { de: '## Teilweise Ergebnisse verfügbar', en: '## Partial results available' },
    validation_error: { de: '## Ungültige Suchparameter', en: '## Invalid search parameters' },
    rate_limited: { de: '## Zu viele Anfragen', en: '## Too many requests' },
    timeout: { de: '## Suche hat zu lange gedauert', en: '## Search took too long' },
  };
  return headers[type]?.[locale] ?? (locale === 'de' ? '## Flugsuche nicht möglich' : '## Flight search unavailable');
}

/**
 * Returns default suggestions based on error type and locale
 */
function getDefaultSuggestions(type: ToolErrorType, locale: ToolErrorLocale = 'de'): string[] {
  const suggestions: Record<ToolErrorType, Record<ToolErrorLocale, string[]>> = {
    no_results: {
      de: [
        'Andere Reisedaten ausprobieren',
        'Flexibilität bei den Daten erhöhen',
        'Alternative Flughäfen in der Nähe prüfen',
        'Zwischenstopps erlauben',
      ],
      en: [
        'Try different travel dates',
        'Increase date flexibility',
        'Check alternative nearby airports',
        'Allow stopovers',
      ],
    },
    provider_unavailable: {
      de: [
        'In einigen Minuten erneut versuchen',
        'Die alternativen Suchlinks unten nutzen',
        'Direkt bei der Airline suchen',
      ],
      en: [
        'Try again in a few minutes',
        'Use the alternative search links below',
        'Search directly on the airline website',
      ],
    },
    partial_failure: {
      de: [
        'Die verfügbaren Ergebnisse prüfen',
        'Für mehr Optionen die alternativen Links nutzen',
      ],
      en: [
        'Check the available results',
        'Use the alternative links for more options',
      ],
    },
    validation_error: {
      de: [
        'Flughafencodes überprüfen (z.B. FRA, JFK)',
        'Datumsformat prüfen (YYYY-MM-DD)',
        'Sicherstellen, dass das Datum in der Zukunft liegt',
      ],
      en: [
        'Check airport codes (e.g., FRA, JFK)',
        'Verify date format (YYYY-MM-DD)',
        'Make sure the date is in the future',
      ],
    },
    rate_limited: {
      de: ['Einige Minuten warten', 'Weniger Suchanfragen gleichzeitig stellen'],
      en: ['Wait a few minutes', 'Make fewer concurrent search requests'],
    },
    timeout: {
      de: [
        'Einfachere Suche versuchen (weniger Flexibilität)',
        'Später erneut versuchen',
        'Alternative Suchlinks nutzen',
      ],
      en: [
        'Try a simpler search (less flexibility)',
        'Try again later',
        'Use alternative search links',
      ],
    },
  };
  return suggestions[type]?.[locale] ?? (locale === 'de' ? ['Suche erneut versuchen', 'Alternative Suchlinks nutzen'] : ['Try searching again', 'Use alternative search links']);
}

/**
 * Checks if an error is retryable (e.g., network issues, 5xx errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, and server errors
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
  return false;
}

/**
 * Sleep utility for retry backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry
 *
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay in milliseconds (doubles each retry)
 * @returns Function result or throws after all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw lastError;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(
          `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Format flight error with alternative airport suggestions
 *
 * @param params - Error parameters with alternatives
 * @returns Formatted error string with alternative airports inline
 */
export function formatFlightErrorWithAlternatives(
  params: GracefulErrorWithAlternatives
): string {
  if (!params.alternatives || params.alternatives.length === 0) {
    return formatGracefulFlightError(params);
  }

  const locale = params.locale ?? 'de';
  const sections: string[] = [];

  sections.push(locale === 'de' ? '## Keine Flüge gefunden\n' : '## No flights found\n');

  const airportReference = params.originalAirportName || params.searchParams?.origin || (locale === 'de' ? 'diesem Flughafen' : 'this airport');
  sections.push(locale === 'de'
    ? `Leider keine direkten Flüge ab ${airportReference}.\n`
    : `Unfortunately no direct flights from ${airportReference}.\n`);

  sections.push(locale === 'de'
    ? '**Diese Flughäfen sind in der Nähe:**\n'
    : '**These airports are nearby:**\n');

  params.alternatives.slice(0, 3).forEach((alt) => {
    sections.push(`- **${alt.city}** — ${alt.name} (${alt.code}) — ${alt.distance}`);
  });

  sections.push(locale === 'de'
    ? '\nKlicken Sie auf einen Flughafen, um die Suche zu wiederholen.'
    : '\nClick on an airport to repeat the search.');

  if (params.searchParams) {
    const googleUrl = buildGoogleFlightsUrl(params.searchParams);
    const skyscannerUrl = buildSkyscannerUrl(params.searchParams);

    sections.push(locale === 'de'
      ? '\n**Oder nutzen Sie alternative Suchen:**'
      : '\n**Or use alternative searches:**');
    sections.push(`- [Google Flights](${googleUrl})`);
    sections.push(`- [Skyscanner](${skyscannerUrl})`);
  }

  return sections.join('\n');
}
