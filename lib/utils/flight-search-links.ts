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
 * @param params - Flight search parameters
 * @returns Complete Google Flights URL
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
 * // Returns: https://www.google.com/travel/flights/FRA/HKT/2025-12-15/2025-12-22?passengers=2&cabin=business
 * ```
 */
export function buildGoogleFlightsUrl(params: FlightSearchLinkParams): string {
  const { origin, destination, departDate, returnDate, cabin, passengers } = params;

  // Validate cabin class
  const cabinKey = cabin.toUpperCase() as CabinClass;
  const googleCabin = CABIN_CLASS_MAP[cabinKey]?.google || 'economy';

  // Base URL structure
  let url = 'https://www.google.com/travel/flights';

  // Add route: /origin/destination/departDate[/returnDate]
  url += `/${origin}/${destination}/${departDate}`;
  
  if (returnDate) {
    url += `/${returnDate}`;
  }

  // Add query parameters
  const queryParams = new URLSearchParams();
  
  if (passengers > 1) {
    queryParams.set('passengers', passengers.toString());
  }
  
  queryParams.set('cabin', googleCabin);

  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  return url;
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
