const SEATSAERO_BASE_URL = 'https://seats.aero/partnerapi';

/**
 * Cabin class mapping for Seats.aero API
 */
const CLASS_MAP = {
  ECONOMY: { key: 'Y', cabin: 'Economy', apiValue: 'economy' },
  PREMIUM_ECONOMY: { key: 'W', cabin: 'Premium Economy', apiValue: 'premium' },
  BUSINESS: { key: 'J', cabin: 'Business', apiValue: 'business' },
  FIRST: { key: 'F', cabin: 'First', apiValue: 'first' },
} as const;

export type TravelClass = keyof typeof CLASS_MAP;

/**
 * Search parameters for Seats.aero API
 */
export interface SeatsAeroSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  travelClass: TravelClass;
  flexibility?: number;
  maxResults?: number;
}

/**
 * Formatted flight result from Seats.aero
 */
export interface SeatsAeroFlight {
  id: string;
  provider: 'seatsaero';
  price: string;
  pricePerPerson: string;
  airline: string;
  cabin: string;
  tags: string[];
  totalStops: number;
  miles: number | null;
  taxes: {
    amount: number | null;
    currency: string | null;
  };
  seatsLeft: number | null;
  bookingLinks?: Record<string, string>;
  outbound: {
    departure: { airport: string; time: string };
    arrival: { airport: string; time: string };
    duration: string;
    stops: string;
    flightNumbers: string;
  };
}

/**
 * Search for award flights using Seats.aero Partner API
 * @param params - Search parameters
 * @returns List of available award flights
 */
export async function searchSeatsAero(
  params: SeatsAeroSearchParams
): Promise<SeatsAeroFlight[]> {
  const { key, cabin, apiValue } = CLASS_MAP[params.travelClass];
  const flex = Math.min(params.flexibility || 0, 3);

  // Calculate date range with flexibility
  const baseDate = new Date(params.departureDate);
  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  if (flex > 0) {
    startDate.setDate(startDate.getDate() - flex);
    endDate.setDate(endDate.getDate() + flex);
  }

  // Build search URL
  const searchUrl = new URL(`${SEATSAERO_BASE_URL}/search`);
  searchUrl.searchParams.set('origin_airport', params.origin);
  searchUrl.searchParams.set('destination_airport', params.destination);
  searchUrl.searchParams.set('cabin', apiValue);
  searchUrl.searchParams.set('start_date', formatDate(startDate));
  searchUrl.searchParams.set('end_date', formatDate(endDate));
  searchUrl.searchParams.set('take', String(params.maxResults || 10));
  searchUrl.searchParams.set('include_trips', 'true');

  console.log('[Seats.aero] Searching:', searchUrl.toString());

  // API Call with error handling
  try {
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Partner-Authorization': process.env.SEATSAERO_API_KEY || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Seats.aero API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Process results
    const entries = Array.isArray(data.data) ? data.data : [];
    console.log(`[Seats.aero] Found ${entries.length} results`);

    // Extract and process all trips from all availability entries
    const allTrips: SeatsAeroFlight[] = [];
    
    for (const entry of entries) {
      const trips = entry.AvailabilityTrips || [];
      
      // Filter trips by cabin class
      const cabinTrips = trips.filter((trip: any) => 
        trip.Cabin === CLASS_MAP[params.travelClass].apiValue
      );
      
      // Convert each trip to our format
      for (const trip of cabinTrips) {
        const flight = formatTripToFlight(trip, entry, cabin);
        if (flight) allTrips.push(flight);
      }
    }

    // Sort by miles and limit results
    const sorted = allTrips
      .sort((a, b) => (a.miles || 0) - (b.miles || 0))
      .slice(0, params.maxResults || 10);

    console.log(`[Seats.aero] Returning ${sorted.length} flights`);
    return sorted;
  } catch (error) {
    console.error('[Seats.aero] Search failed:', error);
    throw error;
  }
}

/**
 * Format trip data from AvailabilityTrips array to our SeatsAeroFlight format
 * @param trip - Trip from AvailabilityTrips array
 * @param entry - Parent availability entry
 * @param cabinName - Human-readable cabin name
 * @returns Formatted flight or null
 */
function formatTripToFlight(
  trip: any,
  entry: any,
  cabinName: string
): SeatsAeroFlight | null {
  try {
    // Extract miles and taxes from new API format
    const miles = trip.MileageCost || 0;
    const taxAmount = trip.TotalTaxes || 0;
    const taxCurrency = trip.TaxesCurrency || 'EUR';

    // Format price string
    const priceStr = `${miles.toLocaleString()} miles + ${taxCurrency} ${(taxAmount / 100).toFixed(2)}`;

    // Parse departure and arrival times
    const departTime = trip.DepartsAt ? new Date(trip.DepartsAt).toISOString() : '';
    const arriveTime = trip.ArrivesAt ? new Date(trip.ArrivesAt).toISOString() : '';
    
    // Calculate duration in readable format
    const durationMins = trip.TotalDuration || 0;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationStr = `${hours}h ${mins}m`;

    return {
      id: trip.ID,
      provider: 'seatsaero',
      price: priceStr,
      pricePerPerson: priceStr,
      airline: trip.Carriers?.split(',')[0]?.trim() || 'Unknown',
      cabin: cabinName,
      tags: [],
      totalStops: trip.Stops || 0,
      miles: miles,
      taxes: { amount: taxAmount / 100, currency: taxCurrency },
      seatsLeft: trip.RemainingSeats || null,
      bookingLinks: {},
      outbound: {
        departure: {
          airport: trip.OriginAirport || '',
          time: departTime,
        },
        arrival: {
          airport: trip.DestinationAirport || '',
          time: arriveTime,
        },
        duration: durationStr,
        stops: trip.Stops === 0 ? 'Nonstop' : `${trip.Stops} stop${trip.Stops > 1 ? 's' : ''}`,
        flightNumbers: trip.FlightNumbers || '',
      },
    };
  } catch (error) {
    console.warn(`[Seats.aero] Error formatting trip:`, error);
    return null;
  }
}

/**
 * Check if flight has availability in specified cabin
 * @param entry - Search result entry
 * @param key - Cabin class key
 * @returns True if available
 */
function hasAvailability(entry: any, key: string): boolean {
  const available = entry[`${key.toLowerCase()}Available`];
  const seats = entry[`${key.toLowerCase()}Seats`];
  return Boolean(available || (seats && seats > 0));
}

/**
 * Extract miles cost from entry
 * @param entry - Search result entry
 * @param key - Cabin class key
 * @returns Miles required or Infinity if not available
 */
function getMiles(entry: any, key: string): number {
  const miles = entry[`${key.toLowerCase()}Miles`];
  return typeof miles === 'number' ? miles : Infinity;
}

/**
 * Get seats left in cabin
 * @param entry - Search result entry
 * @param key - Cabin class key
 * @returns Number of seats or null
 */
function getSeatsLeft(entry: any, key: string): number | null {
  const seats = entry[`${key.toLowerCase()}Seats`];
  return typeof seats === 'number' ? seats : null;
}

/**
 * Format date to YYYY-MM-DD
 * @param date - Date object
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format flight segment information
 * @param trip - Trip data from API
 * @returns Formatted segment
 */
function formatSegment(trip: any): SeatsAeroFlight['outbound'] {
  const first = trip.segments?.[0] || {};
  const last = trip.segments?.[trip.segments.length - 1] || {};

  return {
    departure: {
      airport: first.origin || 'N/A',
      time: first.departureTime || 'N/A',
    },
    arrival: {
      airport: last.destination || 'N/A',
      time: last.arrivalTime || 'N/A',
    },
    duration: trip.duration || 'N/A',
    stops:
      trip.segments?.length > 1 ? `${trip.segments.length - 1} stop(s)` : 'Nonstop',
    flightNumbers:
      trip.segments?.map((s: any) => s.flightNumber).join(', ') || 'N/A',
  };
}

/**
 * Extract tags from trip (e.g., "Direct", "Best Value")
 * @param trip - Trip data from API
 * @returns Array of tags
 */
function extractTags(trip: any): string[] {
  const tags: string[] = [];
  if (trip.segments?.length === 1) tags.push('Direct');
  if (trip.bestValue) tags.push('Best Value');
  return tags;
}

/**
 * Extract booking links from trip
 * @param trip - Trip data from API
 * @returns Booking links object
 */
function extractBookingLinks(trip: any): Record<string, string> {
  return trip.bookingLinks || {};
}
