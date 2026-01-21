import { Duffel } from '@duffel/api';
import { serverEnv } from '@/env/server';

/**
 * Get Duffel SDK client instance with verbose debugging enabled
 * @returns Configured Duffel client
 */
function getDuffelClient(): Duffel {
  const apiKey = serverEnv.DUFFEL_API_KEY;

  if (!apiKey) {
    throw new Error('DUFFEL_API_KEY is not configured. Please add it to your environment variables.');
  }

  return new Duffel({
    token: apiKey,
    debug: { verbose: true },
  });
}

/**
 * Search parameters for Duffel Flight Offers API
 */
export interface DuffelSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  passengers: number;
  maxConnections?: number;
  maxResults?: number;
}

/**
 * Formatted flight result from Duffel
 */
export interface DuffelFlight {
  id: string;
  airline: string;
  airlineLogo?: string;
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
    aircraft?: string;
  }>;
  emissionsKg?: number;
}

/**
 * Map uppercase cabin class to Duffel format
 */
function mapCabinClass(cabin: string): DuffelSearchParams['cabinClass'] {
  const mapping: Record<string, DuffelSearchParams['cabinClass']> = {
    ECONOMY: 'economy',
    PREMIUM_ECONOMY: 'premium_economy',
    BUSINESS: 'business',
    FIRST: 'first',
  };
  return mapping[cabin] || 'economy';
}

/**
 * Search for cash flights using Duffel Flight Offers API (SDK with verbose debugging)
 * @param params - Search parameters
 * @returns List of flight offers
 */
export async function searchDuffel(
  params: DuffelSearchParams
): Promise<DuffelFlight[]> {
  const duffel = getDuffelClient();

  // Build slices (journey legs)
  const slices: Array<{
    origin: string;
    destination: string;
    departure_date: string;
  }> = [
    {
      origin: params.origin,
      destination: params.destination,
      departure_date: params.departureDate,
    },
  ];

  // Add return slice if round-trip
  if (params.returnDate) {
    slices.push({
      origin: params.destination,
      destination: params.origin,
      departure_date: params.returnDate,
    });
  }

  // Build passengers array
  const passengers: Array<{ type: 'adult' }> = Array.from(
    { length: params.passengers },
    () => ({ type: 'adult' })
  );

  console.log('[Duffel] Starting search with SDK (verbose mode enabled):', {
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    cabinClass: params.cabinClass,
    passengers: params.passengers,
  });

  try {
    // Type assertion needed due to SDK type constraints
    const maxConn = Math.min(params.maxConnections ?? 1, 2) as 0 | 1 | 2;
    
    const response = await duffel.offerRequests.create({
      slices: slices as any, // SDK types are overly strict
      passengers,
      cabin_class: params.cabinClass,
      max_connections: maxConn,
      return_offers: true,
    });

    // Log request ID for debugging/tracking in Duffel Dashboard
    console.log('[Duffel] Request completed - Offer Request ID:', response.data.id);

    // Extract offers from response
    const offers = response.data.offers || [];
    console.log(`[Duffel] Found ${offers.length} offers`);

    // Format and limit results
    const maxResults = params.maxResults || 10;
    return offers
      .slice(0, maxResults)
      .map((offer) => formatDuffelOffer(offer));
  } catch (error) {
    console.error('[Duffel] Search failed:', error);
    throw error;
  }
}

/**
 * Format Duffel API response to standardized flight object
 * @param offer - Raw Duffel offer
 * @returns Formatted flight
 */
function formatDuffelOffer(offer: any): DuffelFlight {
  const firstSlice = offer.slices[0];
  const firstSegment = firstSlice.segments[0];
  const lastSegment = firstSlice.segments[firstSlice.segments.length - 1];

  // Calculate total duration from all segments in the slice
  const totalDuration = firstSlice.duration || calculateTotalDuration(firstSlice.segments);

  return {
    id: offer.id,
    airline: offer.owner?.name || offer.owner?.iata_code || 'Unknown',
    airlineLogo: offer.owner?.logo_symbol_url,
    price: {
      total: offer.total_amount,
      base: offer.base_amount,
      currency: offer.total_currency,
    },
    departure: {
      airport: firstSegment.origin.iata_code,
      time: firstSegment.departing_at,
      terminal: firstSegment.origin_terminal,
    },
    arrival: {
      airport: lastSegment.destination.iata_code,
      time: lastSegment.arriving_at,
      terminal: lastSegment.destination_terminal,
    },
    duration: totalDuration,
    stops: firstSlice.segments.length - 1,
    segments: firstSlice.segments.map((seg: any) => ({
      carrierCode: seg.operating_carrier?.iata_code || seg.marketing_carrier?.iata_code,
      flightNumber: seg.operating_carrier_flight_number || seg.marketing_carrier_flight_number,
      departure: {
        iataCode: seg.origin.iata_code,
        at: seg.departing_at,
      },
      arrival: {
        iataCode: seg.destination.iata_code,
        at: seg.arriving_at,
      },
      aircraft: seg.aircraft?.name,
    })),
    emissionsKg: offer.total_emissions_kg ? Number(offer.total_emissions_kg) : undefined,
  };
}

/**
 * Calculate total duration from segments (fallback if not provided)
 */
function calculateTotalDuration(segments: any[]): string {
  if (!segments.length) return 'PT0H0M';

  const firstDeparture = new Date(segments[0].departing_at);
  const lastArrival = new Date(segments[segments.length - 1].arriving_at);
  const diffMs = lastArrival.getTime() - firstDeparture.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `PT${hours}H${minutes}M`;
}

export { mapCabinClass };
