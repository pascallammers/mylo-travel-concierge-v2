import { isRetryableError, sleep } from '@/lib/utils/tool-error-response';
import { parseAwardResponse, type AwardFlight } from './award-search/parser';
import { groupByProgram } from './award-search/program-grouping';

const SEATSAERO_BASE_URL = 'https://seats.aero/partnerapi';
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

function waitForRetryDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!signal) return sleep(delayMs);
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException('Operation aborted', 'AbortError'),
    );
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('Operation aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// Short-lived TTL cache for search results (MYLO-23). The seats.aero daily
// quota is shared between chat search and the deal scanner, so a repeated
// identical route+dates+cabin lookup within the TTL must not burn a second
// call. Modeled on lib/performance-cache, kept local to avoid pulling the db
// layer into this client.
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 200;

interface SearchCacheEntry {
  flights: SeatsAeroFlight[];
  cachedAt: number;
}

const searchCache = new Map<string, SearchCacheEntry>();
const inFlightSearches = new Map<string, Promise<SeatsAeroFlight[]>>();

function cloneSearchResults(flights: SeatsAeroFlight[]): SeatsAeroFlight[] {
  return structuredClone(flights);
}

function searchCacheKey(params: SeatsAeroSearchParams): string {
  return [
    params.origin,
    params.destination,
    params.departureDate,
    params.flexibility || 0,
    params.travelClass,
    params.maxResults || 100,
    params.onlyDirectFlights === true ? 'direct' : 'all',
  ].join('|');
}

function getCachedSearch(key: string): SeatsAeroFlight[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return cloneSearchResults(entry.flights);
}

function setCachedSearch(key: string, flights: SeatsAeroFlight[]): void {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, {
    flights: cloneSearchResults(flights),
    cachedAt: Date.now(),
  });
}

/**
 * Reset completed and in-flight search caches between test cases.
 *
 * @returns Nothing.
 */
export function clearSeatsAeroSearchCache(): void {
  searchCache.clear();
  inFlightSearches.clear();
}

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
  /** Ask seats.aero for direct flights only (API param only_direct_flights). */
  onlyDirectFlights?: boolean;
}

/**
 * Formatted flight result from Seats.aero.
 *
 * `program` is the mileage PROGRAM slug from seats.aero `Source` (aeroplan,
 * lufthansa, united, ...) — the bookable loyalty currency. `airline` is the
 * operating metal (LH, LX). Keeping them distinct is the "MYLO zeigt nur
 * Lufthansa" fix: previously `airline` held the carrier and the program was
 * thrown away, collapsing every program to its carrier. The renderer resolves
 * `program` to a localized display name via the program-registry.
 *
 * The Seats.aero provider itself is never surfaced to end users.
 */
export interface SeatsAeroFlight {
  id: string;
  price: string;
  pricePerPerson: string;
  /** Mileage program slug (seats.aero Source), e.g. "aeroplan". */
  program: string;
  /** Operating carriers (metal), e.g. "LH, LX". */
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
 * Includes automatic retry with exponential backoff for transient errors
 *
 * @param params - Search parameters
 * @param signal - Optional request cancellation signal
 * @returns List of available award flights
 */
export async function searchSeatsAero(
  params: SeatsAeroSearchParams,
  signal?: AbortSignal
): Promise<SeatsAeroFlight[]> {
  const cacheKey = searchCacheKey(params);
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    console.log(`[Seats.aero] Cache hit for ${cacheKey}, skipping API call`);
    return cached;
  }

  // An abort signal belongs to one caller. Sharing its provider request would
  // let one cancelled chat abort another caller's identical search. Abortable
  // requests therefore keep their own in-flight operation, while successful
  // results still populate the shared completed-result cache.
  if (signal) {
    const flights = await executeSeatsAeroSearchWithRetry(params, signal);
    setCachedSearch(cacheKey, flights);
    return cloneSearchResults(flights);
  }

  const inFlight = inFlightSearches.get(cacheKey);
  if (inFlight) {
    console.log(`[Seats.aero] Joining in-flight search for ${cacheKey}`);
    return cloneSearchResults(await inFlight);
  }

  const searchPromise = executeSeatsAeroSearchWithRetry(params);
  inFlightSearches.set(cacheKey, searchPromise);

  try {
    const flights = await searchPromise;
    setCachedSearch(cacheKey, flights);
    return cloneSearchResults(flights);
  } finally {
    if (inFlightSearches.get(cacheKey) === searchPromise) {
      inFlightSearches.delete(cacheKey);
    }
  }
}

async function executeSeatsAeroSearchWithRetry(
  params: SeatsAeroSearchParams,
  signal?: AbortSignal,
): Promise<SeatsAeroFlight[]> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeSeatsAeroSearch(params, signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (signal?.aborted) {
        throw lastError;
      }

      // Check if we should retry
      const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);

      if (shouldRetry) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(
          `[Seats.aero] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed, retrying in ${delay}ms...`
        );
        await waitForRetryDelay(delay, signal);
      } else {
        // Don't retry - either max retries reached or non-retryable error
        console.error(
          `[Seats.aero] Search failed after ${attempt + 1} attempt(s):`,
          lastError.message
        );
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Seats.aero search failed');
}

/**
 * Execute the actual Seats.aero API search
 * Separated from retry logic for clarity
 */
async function executeSeatsAeroSearch(
  params: SeatsAeroSearchParams,
  signal?: AbortSignal
): Promise<SeatsAeroFlight[]> {
  const { cabin, apiValue } = CLASS_MAP[params.travelClass];
  const flex = Math.min(params.flexibility || 0, 3);

  // Calculate date range with flexibility
  const baseDate = new Date(params.departureDate);
  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  if (flex > 0) {
    startDate.setDate(startDate.getDate() - flex);
    endDate.setDate(endDate.getDate() + flex);
  }

  // Build search URL. `take` is free (1 HTTP call = 1 budget unit regardless of
  // take), so we pull a high page to capture EVERY program — one call returns
  // ~30 entries per program, and a small take would only surface the first one.
  const searchUrl = new URL(`${SEATSAERO_BASE_URL}/search`);
  searchUrl.searchParams.set('origin_airport', params.origin);
  searchUrl.searchParams.set('destination_airport', params.destination);
  searchUrl.searchParams.set('cabin', apiValue);
  searchUrl.searchParams.set('start_date', formatDate(startDate));
  searchUrl.searchParams.set('end_date', formatDate(endDate));
  searchUrl.searchParams.set('take', String(params.maxResults || 100));
  searchUrl.searchParams.set('include_trips', 'true');
  // Without order_by, seats.aero sorts by date — with take-truncation the
  // cheapest options of whole programs can fall off the page.
  searchUrl.searchParams.set('order_by', 'lowest_mileage');
  if (params.onlyDirectFlights) {
    searchUrl.searchParams.set('only_direct_flights', 'true');
  }

  console.log('[Seats.aero] Searching:', searchUrl.toString());

  // API Call
  const response = await fetch(searchUrl.toString(), {
    signal,
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

  // take-truncation: seats.aero signals more pages via hasMore. We don't
  // paginate (quota), but order_by=lowest_mileage keeps the cheapest options
  // on the first page — surface the truncation for visibility.
  if (data?.hasMore) {
    console.warn(
      `[Seats.aero] Response truncated (hasMore=true) at take=${params.maxResults || 100} for ${params.origin}->${params.destination}; cheapest options retained via order_by=lowest_mileage`
    );
  }

  // Parse raw JSON -> AwardFlight[] (reads Source as the program), then keep
  // only the requested cabin and collapse to the cheapest-per-program slice.
  const parsed = parseAwardResponse(data);
  console.log(`[Seats.aero] Parsed ${parsed.length} trips`);

  const cabinFiltered = filterByCabin(parsed, apiValue);
  const grouped = groupByProgram(cabinFiltered);

  const flights = grouped.map((flight) =>
    awardFlightToSeatsAero(flight, params, cabin)
  );

  console.log(
    `[Seats.aero] Returning ${flights.length} flights across ${new Set(flights.map((f) => f.program)).size} programs`
  );
  return flights;
}

/**
 * Tolerant cabin filter. seats.aero reports lowercase cabins ("business"); the
 * old code did a strict exact match. We compare case-insensitively and allow a
 * prefix match (so "premium economy" satisfies a "premium" request) and log
 * how many trips were dropped for visibility.
 */
function filterByCabin(flights: AwardFlight[], apiValue: string): AwardFlight[] {
  const wanted = apiValue.toLowerCase();
  const kept = flights.filter((f) => {
    const c = (f.cabin || '').toLowerCase();
    return c === wanted || c.startsWith(wanted);
  });

  const dropped = flights.length - kept.length;
  if (dropped > 0) {
    console.log(`[Seats.aero] Dropped ${dropped} trip(s) not matching cabin "${wanted}"`);
  }
  return kept;
}

/**
 * Map a parsed AwardFlight to the renderer's SeatsAeroFlight shape. Airports
 * come from the search params (the searched route), duration is derived from
 * the ISO timestamps.
 */
function awardFlightToSeatsAero(
  flight: AwardFlight,
  params: SeatsAeroSearchParams,
  cabinName: string
): SeatsAeroFlight {
  const { amount, currency } = flight.taxes;
  const priceStr = `${flight.miles.toLocaleString()} miles + ${currency} ${amount.toFixed(2)}`;

  return {
    id: flight.id,
    price: priceStr,
    pricePerPerson: priceStr,
    program: flight.program,
    airline: flight.operatingCarriers,
    cabin: cabinName,
    tags: [],
    totalStops: flight.stops,
    miles: flight.miles,
    taxes: { amount, currency },
    seatsLeft: flight.remainingSeats,
    bookingLinks: {},
    outbound: {
      departure: { airport: params.origin, time: flight.departsAt },
      arrival: { airport: params.destination, time: flight.arrivesAt },
      duration: formatDuration(flight.departsAt, flight.arrivesAt),
      stops:
        flight.stops === 0
          ? 'Nonstop'
          : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`,
      flightNumbers: flight.flightNumbers,
    },
  };
}

/**
 * Format the elapsed time between two ISO timestamps as "Xh Ym".
 */
function formatDuration(departsAt: string, arrivesAt: string): string {
  const dep = new Date(departsAt).getTime();
  const arr = new Date(arrivesAt).getTime();
  if (isNaN(dep) || isNaN(arr) || arr < dep) return '';

  const totalMins = Math.round((arr - dep) / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format date to YYYY-MM-DD
 * @param date - Date object
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
