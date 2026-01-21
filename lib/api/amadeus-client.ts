import { getAmadeusToken } from './amadeus-token';
import { isRetryableError, sleep } from '@/lib/utils/tool-error-response';

const AMADEUS_BASE_URL =
  process.env.AMADEUS_ENV === 'prod'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

/**
 * Search parameters for Amadeus Flight Offers API
 */
export interface AmadeusSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  travelClass: string;
  passengers: number;
  nonStop?: boolean;
  maxResults?: number;
}

/**
 * Formatted flight result from Amadeus
 * Note: provider field removed to hide data source from end users
 */
export interface AmadeusFlight {
  id: string;
  airline: string;
  price: {
    total: string;
    base: string;
    currency: string;
  };
  departure: {
    airport: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: string;
    terminal?: string;
  };
  duration: string;
  stops: number;
  segments: Array<{
    carrierCode: string;
    flightNumber: string;
    departure: { iataCode: string; at: string };
    arrival: { iataCode: string; at: string };
  }>;
}

/**
 * Search for cash flights using Amadeus Flight Offers API
 * Includes automatic retry with exponential backoff for transient errors
 *
 * @param params - Search parameters
 * @returns List of flight offers
 */
export async function searchAmadeus(
  params: AmadeusSearchParams
): Promise<AmadeusFlight[]> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeAmadeusSearch(params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);

      if (shouldRetry) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(
          `[Amadeus] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed, retrying in ${delay}ms...`
        );
        await sleep(delay);
      } else {
        // Don't retry - either max retries reached or non-retryable error
        console.error(
          `[Amadeus] Search failed after ${attempt + 1} attempt(s):`,
          lastError.message
        );
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Amadeus search failed');
}

/**
 * Execute the actual Amadeus API search
 * Separated from retry logic for clarity
 */
async function executeAmadeusSearch(
  params: AmadeusSearchParams
): Promise<AmadeusFlight[]> {
  // 1. Get OAuth token
  const token = await getAmadeusToken(
    (process.env.AMADEUS_ENV as 'test' | 'prod') || 'test'
  );

  // 2. Build search params
  const searchParams = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: String(params.passengers),
    travelClass: params.travelClass, // Amadeus expects uppercase: ECONOMY, BUSINESS, etc.
    currencyCode: 'EUR',
    max: String(params.maxResults || 10),
  });

  if (params.returnDate) {
    searchParams.set('returnDate', params.returnDate);
  }

  if (params.nonStop) {
    searchParams.set('nonStop', 'true');
  }

  console.log(
    '[Amadeus] Searching:',
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`
  );

  // 3. API Call with error handling
  const response = await fetch(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.amadeus+json',
      },
    }
  );

  if (!response.ok) {
    // Handle 401 Unauthorized (token expired)
    if (response.status === 401) {
      console.warn('[Amadeus] Token expired, will retry on next call');
      throw new Error('Amadeus token expired (401)');
    }

    const errorText = await response.text();
    throw new Error(`Amadeus API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // 4. Process results
  const offers = Array.isArray(data.data) ? data.data : [];
  console.log(`[Amadeus] Found ${offers.length} offers`);

  return offers.map((offer: any) => formatAmadeusOffer(offer));
}

/**
 * Format Amadeus API response to standardized flight object
 * @param offer - Raw Amadeus offer
 * @returns Formatted flight
 */
function formatAmadeusOffer(offer: any): AmadeusFlight {
  const firstItinerary = offer.itineraries[0];
  const firstSegment = firstItinerary.segments[0];
  const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];

  return {
    id: offer.id,
    // provider field removed to hide data source from end users
    airline: offer.validatingAirlineCodes?.[0] || 'Unknown',
    price: {
      total: offer.price.grandTotal,
      base: offer.price.base,
      currency: offer.price.currency,
    },
    departure: {
      airport: firstSegment.departure.iataCode,
      time: firstSegment.departure.at,
      terminal: firstSegment.departure.terminal,
    },
    arrival: {
      airport: lastSegment.arrival.iataCode,
      time: lastSegment.arrival.at,
      terminal: lastSegment.arrival.terminal,
    },
    duration: firstItinerary.duration,
    stops: firstItinerary.segments.length - 1,
    segments: firstItinerary.segments.map((seg: any) => ({
      carrierCode: seg.carrierCode,
      flightNumber: seg.number,
      departure: {
        iataCode: seg.departure.iataCode,
        at: seg.departure.at,
      },
      arrival: {
        iataCode: seg.arrival.iataCode,
        at: seg.arrival.at,
      },
    })),
  };
}
