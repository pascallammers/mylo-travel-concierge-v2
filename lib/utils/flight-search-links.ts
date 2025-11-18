/**
 * Flight Search External Links Utility
 * 
 * Builds pre-filled search URLs for external flight search platforms
 * (Google Flights, Skyscanner) with user's search parameters.
 */

/**
 * Cabin class mapping for external platforms
 */
const CABIN_CLASS_MAP = {
  ECONOMY: {
    google: 'economy',
    skyscanner: 'economy',
  },
  PREMIUM_ECONOMY: {
    google: 'premium_economy',
    skyscanner: 'premiumeconomy',
  },
  BUSINESS: {
    google: 'business',
    skyscanner: 'business',
  },
  FIRST: {
    google: 'first',
    skyscanner: 'first',
  },
} as const;

type CabinClass = keyof typeof CABIN_CLASS_MAP;

/**
 * Flight search parameters for external links
 */
export interface FlightSearchLinkParams {
  /** Origin airport IATA code (e.g., "FRA") */
  origin: string;
  /** Destination airport IATA code (e.g., "HKT") */
  destination: string;
  /** Departure date in YYYY-MM-DD format */
  departDate: string;
  /** Return date in YYYY-MM-DD format (optional for one-way) */
  returnDate?: string | null;
  /** Cabin class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST) */
  cabin: string;
  /** Number of passengers */
  passengers: number;
}

/**
 * Build Google Flights search URL with pre-filled parameters
 * 
 * Uses Google Flights' query-based search format for reliable parameter passing.
 * This format is more robust than path-based URLs and ensures all search
 * parameters are properly transmitted to Google Flights.
 * 
 * @param params - Flight search parameters
 * @returns Complete Google Flights URL with query parameters
 * 
 * @example
 * ```typescript
 * buildGoogleFlightsUrl({
 *   origin: 'FRA',
 *   destination: 'HKT',
 *   departDate: '2025-12-15',
 *   returnDate: '2025-12-22',
 *   cabin: 'BUSINESS',
 *   passengers: 2
 * });
 * // Returns: https://www.google.com/travel/flights?q=Flights+to+HKT+from+FRA+on+2025-12-15+through+2025-12-22&adults=2
 * ```
 */
export function buildGoogleFlightsUrl(params: FlightSearchLinkParams): string {
  const { origin, destination, departDate, returnDate, cabin, passengers } = params;

  // Base URL
  const baseUrl = 'https://www.google.com/travel/flights';

  // Build natural language search query (Google's preferred format)
  let query = `Flights to ${destination} from ${origin} on ${departDate}`;
  
  if (returnDate) {
    query += ` through ${returnDate}`;
  }

  // Build query parameters
  const searchParams = new URLSearchParams({
    q: query,
    hl: 'en', // Interface language
  });

  // Add passenger count if more than 1
  if (passengers > 1) {
    searchParams.set('adults', passengers.toString());
  }

  // Add cabin class hint (optional, may not always be respected by Google)
  const cabinKey = cabin.toUpperCase() as CabinClass;
  const googleCabin = CABIN_CLASS_MAP[cabinKey]?.google || 'economy';
  searchParams.set('cabin', googleCabin);

  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * Build Skyscanner search URL with pre-filled parameters
 * 
 * @param params - Flight search parameters
 * @returns Complete Skyscanner URL
 * 
 * @example
 * ```typescript
 * buildSkyscannerUrl({
 *   origin: 'FRA',
 *   destination: 'HKT',
 *   departDate: '2025-12-15',
 *   returnDate: '2025-12-22',
 *   cabin: 'BUSINESS',
 *   passengers: 2
 * });
 * // Returns: https://www.skyscanner.com/transport/flights/FRA/HKT/251215/251222?adults=2&cabinclass=business
 * ```
 */
export function buildSkyscannerUrl(params: FlightSearchLinkParams): string {
  const { origin, destination, departDate, returnDate, cabin, passengers } = params;

  // Validate cabin class
  const cabinKey = cabin.toUpperCase() as CabinClass;
  const skyscannerCabin = CABIN_CLASS_MAP[cabinKey]?.skyscanner || 'economy';

  // Convert dates to Skyscanner format (YYMMDD)
  const formatSkyscannerDate = (date: string): string => {
    const [year, month, day] = date.split('-');
    return `${year.slice(2)}${month}${day}`;
  };

  const departDateFormatted = formatSkyscannerDate(departDate);
  const returnDateFormatted = returnDate ? formatSkyscannerDate(returnDate) : '';

  // Base URL structure: /origin/destination/departDate[/returnDate]
  let url = 'https://www.skyscanner.com/transport/flights';
  url += `/${origin}/${destination}/${departDateFormatted}`;
  
  if (returnDateFormatted) {
    url += `/${returnDateFormatted}`;
  }

  // Add query parameters
  const queryParams = new URLSearchParams();
  queryParams.set('adults', passengers.toString());
  queryParams.set('cabinclass', skyscannerCabin);

  url += `?${queryParams.toString()}`;

  return url;
}
