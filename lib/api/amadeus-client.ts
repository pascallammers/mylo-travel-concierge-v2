import { getAmadeusToken } from './amadeus-token';

const AMADEUS_BASE_URL =
  process.env.AMADEUS_ENV === 'prod'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

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
 * @param params - Search parameters
 * @returns List of flight offers
 */
export async function searchAmadeus(
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
  try {
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
        throw new Error('Amadeus token expired');
      }

      const error = await response.text();
      throw new Error(`Amadeus API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // 4. Process results
    const offers = Array.isArray(data.data) ? data.data : [];
    console.log(`[Amadeus] Found ${offers.length} offers`);

    return offers.map((offer: any) => formatAmadeusOffer(offer));
  } catch (error) {
    console.error('[Amadeus] Search failed:', error);
    throw error;
  }
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
