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
 * Parameters for creating a graceful error response
 */
export interface GracefulErrorParams {
  type: ToolErrorType;
  message: string;
  suggestions?: string[];
  searchParams?: FlightSearchLinkParams;
  technicalDetails?: string;
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
    suggestions = getDefaultSuggestions(type),
    searchParams,
    technicalDetails,
  } = params;

  const sections: string[] = [];

  // Header based on error type
  sections.push(getErrorHeader(type));

  // User-friendly message
  sections.push(`\n${message}\n`);

  // Suggestions
  if (suggestions.length > 0) {
    sections.push('\n**Was Sie tun können:**');
    suggestions.forEach((s) => sections.push(`- ${s}`));
  }

  // Fallback links if search params available
  if (searchParams) {
    const googleUrl = buildGoogleFlightsUrl(searchParams);
    const skyscannerUrl = buildSkyscannerUrl(searchParams);

    sections.push('\n**Alternative Suchoptionen:**');
    sections.push(`- [Google Flights öffnen](${googleUrl})`);
    sections.push(`- [Skyscanner öffnen](${skyscannerUrl})`);
  }

  // Technical details for debugging (hidden from user but visible in logs)
  if (technicalDetails) {
    console.warn(`[Tool Error] Technical details: ${technicalDetails}`);
  }

  return sections.join('\n');
}

/**
 * Returns appropriate header based on error type
 */
function getErrorHeader(type: ToolErrorType): string {
  switch (type) {
    case 'no_results':
      return '## Keine Flüge gefunden';
    case 'provider_unavailable':
      return '## Flugsuche vorübergehend eingeschränkt';
    case 'partial_failure':
      return '## Teilweise Ergebnisse verfügbar';
    case 'validation_error':
      return '## Ungültige Suchparameter';
    case 'rate_limited':
      return '## Zu viele Anfragen';
    case 'timeout':
      return '## Suche hat zu lange gedauert';
    default:
      return '## Flugsuche nicht möglich';
  }
}

/**
 * Returns default suggestions based on error type
 */
function getDefaultSuggestions(type: ToolErrorType): string[] {
  switch (type) {
    case 'no_results':
      return [
        'Andere Reisedaten ausprobieren',
        'Flexibilität bei den Daten erhöhen',
        'Alternative Flughäfen in der Nähe prüfen',
        'Zwischenstopps erlauben',
      ];
    case 'provider_unavailable':
      return [
        'In einigen Minuten erneut versuchen',
        'Die alternativen Suchlinks unten nutzen',
        'Direkt bei der Airline suchen',
      ];
    case 'partial_failure':
      return [
        'Die verfügbaren Ergebnisse prüfen',
        'Für mehr Optionen die alternativen Links nutzen',
      ];
    case 'validation_error':
      return [
        'Flughafencodes überprüfen (z.B. FRA, JFK)',
        'Datumsformat prüfen (YYYY-MM-DD)',
        'Sicherstellen, dass das Datum in der Zukunft liegt',
      ];
    case 'rate_limited':
      return ['Einige Minuten warten', 'Weniger Suchanfragen gleichzeitig stellen'];
    case 'timeout':
      return [
        'Einfachere Suche versuchen (weniger Flexibilität)',
        'Später erneut versuchen',
        'Alternative Suchlinks nutzen',
      ];
    default:
      return ['Suche erneut versuchen', 'Alternative Suchlinks nutzen'];
  }
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
