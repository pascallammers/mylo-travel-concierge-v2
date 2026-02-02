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

  console.log('=== [DUFFEL API CALL] === Starting flight search via Duffel SDK:', {
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    cabinClass: params.cabinClass,
    passengers: params.passengers,
    timestamp: new Date().toISOString(),
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
    console.log('=== [DUFFEL API CALL] === Request completed - Offer Request ID:', response.data.id);

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

/**
 * Validate IATA code format and basic sanity check
 * @param code - IATA code to validate
 * @returns true if valid IATA code format (3 uppercase letters)
 */
export async function validateIATACode(code: string): Promise<boolean> {
  // Basic format validation: exactly 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(code)) {
    console.warn('[IATA Validation] Invalid format:', code);
    return false;
  }

  // For low-confidence extractions, we validate format only
  // Full validation would require Duffel API call which is not available in current SDK version
  console.log('[IATA Validation] Format check passed:', code);
  return true;
}

/**
 * Nearby airport result with distance and drive time
 */
export interface NearbyAirport {
  code: string;
  name: string;
  city: string;
  country: string;
  distanceMeters: number;
  driveTime: string;  // "~1,5h Fahrt"
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance in meters to German drive time string
 * @param meters - Distance in meters
 * @returns Formatted drive time (e.g., "~1,5h Fahrt")
 */
function formatDriveTime(meters: number): string {
  const kmPerHour = 70; // Average effective speed
  const hours = meters / 1000 / kmPerHour;

  if (hours < 0.5) {
    return '~30min Fahrt';
  } else if (hours <= 1.5) {
    // Round to 0.5 increments, use German decimal comma
    const rounded = Math.round(hours * 2) / 2;
    return `~${rounded.toFixed(1).replace('.', ',')}h Fahrt`;
  } else {
    // Round to whole hours
    const rounded = Math.round(hours);
    return `~${rounded}h Fahrt`;
  }
}

/**
 * Determine search radius based on country code
 * @param countryCode - ISO 2-letter country code
 * @returns Radius in meters
 */
export function getDynamicRadius(countryCode: string): number {
  // Dense regions: smaller radius
  const denseRegions = ['GB', 'DE', 'NL', 'BE', 'CH', 'AT', 'JP', 'KR'];
  if (denseRegions.includes(countryCode)) {
    return 100000; // 100km
  }

  // Sparse regions: larger radius
  const sparseRegions = ['US', 'CA', 'AU', 'BR', 'RU', 'CN', 'IN'];
  if (sparseRegions.includes(countryCode)) {
    return 250000; // 250km
  }

  // Default: medium radius
  return 150000; // 150km
}

/**
 * Find nearby airports using Duffel Places API
 * @param airportCode - Origin airport IATA code
 * @param radiusMeters - Optional search radius (defaults to dynamic based on country)
 * @returns List of up to 3 nearby airports with drive time estimates
 */
export async function getNearbyAirports(
  airportCode: string,
  radiusMeters?: number
): Promise<NearbyAirport[]> {
  const duffel = getDuffelClient();

  try {
    // Step 1: Get origin airport coordinates
    console.log('[Duffel] Searching nearby airports:', { origin: airportCode });

    const originSearch = await duffel.suggestions.list({
      query: airportCode,
    });

    // Step 2: Find origin airport in results
    const originAirport = originSearch.data.find(
      (place: any) => place.type === 'airport' && place.iata_code === airportCode
    );

    if (!originAirport || !originAirport.latitude || !originAirport.longitude) {
      console.warn('[Duffel] Origin airport not found or missing coordinates:', airportCode);
      return [];
    }

    // Step 3: Determine search radius
    const radius = radiusMeters ?? getDynamicRadius(originAirport.iata_country_code || '');

    console.log('[Duffel] Searching nearby airports:', {
      origin: airportCode,
      lat: originAirport.latitude,
      lng: originAirport.longitude,
      radius: `${radius}m (${Math.round(radius / 1000)}km)`,
    });

    // Step 4: Search for nearby airports
    const nearbySearch = await duffel.suggestions.list({
      lat: originAirport.latitude.toString(),
      lng: originAirport.longitude.toString(),
      rad: radius.toString(),
    });

    // Step 5: Filter and process results
    const nearbyAirports = nearbySearch.data
      .filter(
        (place: any) =>
          place.type === 'airport' &&
          place.iata_code &&
          place.iata_code !== airportCode &&
          place.latitude !== null &&
          place.longitude !== null
      )
      .map((place: any) => {
        const distance = calculateHaversineDistance(
          originAirport.latitude,
          originAirport.longitude,
          place.latitude,
          place.longitude
        );

        return {
          code: place.iata_code,
          name: place.name,
          city: place.city_name || place.city?.name || 'Unknown',
          country: place.iata_country_code || '',
          distanceMeters: distance,
          driveTime: formatDriveTime(distance),
        };
      })
      .sort((a: NearbyAirport, b: NearbyAirport) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);

    console.log('[Duffel] Found nearby airports:', nearbyAirports.length);
    return nearbyAirports;
  } catch (error) {
    console.error('[Duffel] Nearby airport search failed:', error);
    return [];
  }
}

/**
 * Search Duffel across flexible date range with batched parallelism
 * @param params - Base search parameters
 * @param flexDays - Days to search before and after (default: 3)
 * @returns Array of flights with searchedDate metadata
 */
export async function searchDuffelFlexibleDates(
  params: DuffelSearchParams,
  flexDays: number = 3
): Promise<(DuffelFlight & { searchedDate: string })[]> {
  const baseDate = new Date(params.departureDate);
  const dates: string[] = [];

  // Generate date range (+/- flexDays, excluding original date already searched)
  for (let offset = -flexDays; offset <= flexDays; offset++) {
    if (offset === 0) continue; // Skip original date
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offset);
    dates.push(date.toISOString().split('T')[0]);
  }

  console.log(`[Duffel] Searching ${dates.length} flexible dates with concurrency limit`);

  const results: (DuffelFlight & { searchedDate: string })[] = [];
  const batchSize = 3; // Max 3 concurrent requests to respect rate limits

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    console.log(`[Duffel] Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

    const promises = batch.map(date =>
      searchDuffel({ ...params, departureDate: date })
        .then(flights => flights.map(f => ({ ...f, searchedDate: date })))
        .catch(err => {
          console.warn(`[Duffel] Date ${date} failed:`, err.message);
          return []; // Return empty array on failure
        })
    );

    const batchResults = await Promise.allSettled(promises);

    // Extract successful results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    });

    // Small delay between batches to be respectful to API
    if (i + batchSize < dates.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[Duffel] Flexible search complete: ${results.length} total flights`);
  return results;
}

export { mapCabinClass };
