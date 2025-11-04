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
        'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
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

    // Filter and sort by miles
    const filtered = entries
      .filter((entry) => hasAvailability(entry, key))
      .sort((a, b) => getMiles(a, key) - getMiles(b, key))
      .slice(0, params.maxResults || 10);

    // Load trip details for each flight
    const flights: SeatsAeroFlight[] = [];
    for (const entry of filtered) {
      const flight = await loadFlightDetails(entry, key, cabin);
      if (flight) flights.push(flight);
    }

    console.log(`[Seats.aero] Returning ${flights.length} flights`);
    return flights;
  } catch (error) {
    console.error('[Seats.aero] Search failed:', error);
    throw error;
  }
}

/**
 * Load detailed flight information from trip endpoint
 * @param entry - Search result entry
 * @param cabinKey - Cabin class key (Y/W/J/F)
 * @param cabinName - Human-readable cabin name
 * @returns Formatted flight or null
 */
async function loadFlightDetails(
  entry: any,
  cabinKey: string,
  cabinName: string
): Promise<SeatsAeroFlight | null> {
  const tripId = entry[`${cabinKey.toLowerCase()}TripId`];
  if (!tripId) return null;

  try {
    const tripUrl = `${SEATSAERO_BASE_URL}/trip/${tripId}`;
    const response = await fetch(tripUrl, {
      headers: {
        'Partner-Authorization': `Bearer ${process.env.SEATSAERO_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`[Seats.aero] Failed to load trip ${tripId}`);
      return null;
    }

    const trip = await response.json();

    // Extract miles and taxes
    const miles = getMiles(entry, cabinKey);
    const taxAmount = trip.taxes?.amount || null;
    const taxCurrency = trip.taxes?.currency || null;

    // Format price string
    const priceStr =
      miles !== null && miles < Infinity
        ? `${miles.toLocaleString()} miles${taxAmount ? ` + ${taxCurrency}${taxAmount}` : ''}`
        : 'N/A';

    return {
      id: tripId,
      provider: 'seatsaero',
      price: priceStr,
      pricePerPerson: priceStr,
      airline: trip.airline || 'Unknown',
      cabin: cabinName,
      tags: extractTags(trip),
      totalStops: trip.segments?.length - 1 || 0,
      miles: miles !== Infinity ? miles : null,
      taxes: { amount: taxAmount, currency: taxCurrency },
      seatsLeft: getSeatsLeft(entry, cabinKey),
      bookingLinks: extractBookingLinks(trip),
      outbound: formatSegment(trip),
    };
  } catch (error) {
    console.warn(`[Seats.aero] Error loading trip ${tripId}:`, error);
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
