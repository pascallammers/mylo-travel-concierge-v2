/**
 * Duffel Links Utility
 *
 * Creates Duffel booking session links that allow users to complete
 * flight purchases directly through Duffel's hosted booking interface.
 */

import { Duffel } from '@duffel/api';
import { serverEnv } from '@/env/server';

/**
 * Parameters for creating a Duffel booking session link
 */
export interface DuffelLinkParams {
  /** Origin airport IATA code (e.g., "FRA") */
  origin: string;
  /** Destination airport IATA code (e.g., "HKT") */
  destination: string;
  /** Departure date in YYYY-MM-DD format */
  departDate: string;
  /** Return date in YYYY-MM-DD format (optional for one-way) */
  returnDate?: string | null;
  /** Number of passengers */
  passengers: number;
  /** Optional reference ID for tracking */
  reference?: string;
}

/**
 * Duffel session response with booking URL
 */
export interface DuffelSessionResult {
  /** Booking URL for the user */
  url: string;
}

/**
 * Get Duffel SDK client instance
 * @returns Configured Duffel client
 */
function getDuffelClient(): Duffel {
  const apiKey = serverEnv.DUFFEL_API_KEY;

  if (!apiKey) {
    throw new Error(
      'DUFFEL_API_KEY is not configured. Please add it to your environment variables.'
    );
  }

  return new Duffel({
    token: apiKey,
  });
}

/**
 * Create a Duffel Links booking session
 *
 * This generates a unique URL that allows users to search and book flights
 * directly through Duffel's hosted booking interface. The session is valid
 * for 24 hours after creation and 20 minutes after first use.
 *
 * @param params - Booking session parameters
 * @returns Session result with booking URL
 *
 * @example
 * ```typescript
 * const session = await createDuffelBookingSession({
 *   origin: 'FRA',
 *   destination: 'HKT',
 *   departDate: '2025-12-15',
 *   returnDate: '2025-12-22',
 *   passengers: 2,
 * });
 * // Returns: { url: 'https://links.duffel.com?token=...', sessionId: '...', expiresAt: '...' }
 * ```
 */
export async function createDuffelBookingSession(
  params: DuffelLinkParams
): Promise<DuffelSessionResult> {
  const duffel = getDuffelClient();

  console.log('[Duffel Links] Creating booking session:', {
    origin: params.origin,
    destination: params.destination,
    departDate: params.departDate,
    returnDate: params.returnDate,
    passengers: params.passengers,
  });

  try {
    const response = await duffel.links.create({
      reference: params.reference || `mylo-${Date.now()}`,
      success_url: 'https://mylo.app/booking/success',
      failure_url: 'https://mylo.app/booking/failure',
      abandonment_url: 'https://mylo.app/booking/abandoned',
    });

    const result: DuffelSessionResult = {
      url: response.data.url,
    };

    console.log('[Duffel Links] Session created:', { url: result.url });

    return result;
  } catch (error) {
    console.error('[Duffel Links] Failed to create session:', error);
    throw error;
  }
}

/**
 * Build a simple Duffel booking URL (fallback without session)
 *
 * This creates a URL that links directly to Duffel's public booking page.
 * Use this as a fallback when session creation is not available.
 *
 * @param params - Booking parameters
 * @returns Duffel booking URL
 */
export function buildDuffelFallbackUrl(params: DuffelLinkParams): string {
  const baseUrl = 'https://book.duffel.com';

  const searchParams = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    departure_date: params.departDate,
    adults: params.passengers.toString(),
  });

  if (params.returnDate) {
    searchParams.set('return_date', params.returnDate);
  }

  return `${baseUrl}?${searchParams.toString()}`;
}
