/**
 * Airport database lookup using airport-data-js (18,700+ airports)
 * Provides fast, offline resolution of city names to IATA codes
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- airport-data-js ships no type declarations
import { searchByName, getAirportByIata, getAutocompleteSuggestions, validateIataCode as validateIataCodeLib } from 'airport-data-js';

interface AirportRecord {
  iata: string;
  icao: string;
  airport: string;
  country_code: string;
  continent: string;
  type: string;
  scheduled_service: string;
  latitude: number;
  longitude: number;
}

/**
 * Alias map for German city names and common multi-airport cities
 * Maps alternative/local names to their primary IATA code.
 * Only needed where airport-data-js searchByName fails.
 */
const CITY_ALIASES: Record<string, string> = {
  // German names → IATA
  münchen: 'MUC',
  nürnberg: 'NUE',
  düsseldorf: 'DUS',
  köln: 'CGN',
  hannover: 'HAJ',
  zürich: 'ZRH',
  nizza: 'NCE',
  straßburg: 'SXB',
  strassburg: 'SXB',
  lissabon: 'LIS',
  mailand: 'MXP',
  rom: 'FCO',
  venedig: 'VCE',
  florenz: 'FLR',
  neapel: 'NAP',
  athen: 'ATH',
  brüssel: 'BRU',
  kopenhagen: 'CPH',
  warschau: 'WAW',
  prag: 'PRG',
  bukarest: 'OTP',
  kairo: 'CAI',
  peking: 'PEK',
  teneriffa: 'TFS',
  kreta: 'HER',
  korfu: 'CFU',
  rhodos: 'RHO',
  sardinien: 'CAG',
  sizilien: 'CTA',
  wien: 'VIE',
  genf: 'GVA',
  havanna: 'HAV',

  // Multi-airport cities → primary airport
  'new york': 'JFK',
  'new york city': 'JFK',
  nyc: 'JFK',
  manhattan: 'JFK',
  london: 'LHR',
  paris: 'CDG',
  'los angeles': 'LAX',
  la: 'LAX',
  chicago: 'ORD',
  'san francisco': 'SFO',
  sf: 'SFO',
  washington: 'IAD',
  'washington dc': 'IAD',
  tokyo: 'NRT',
  osaka: 'KIX',
  'buenos aires': 'EZE',
  'sao paulo': 'GRU',
  'são paulo': 'GRU',
  'rio de janeiro': 'GIG',
  rio: 'GIG',
  istanbul: 'IST',
  seoul: 'ICN',
  shanghai: 'PVG',
  beijing: 'PEK',
  moscow: 'SVO',
  moskau: 'SVO',

  // Common short names
  vegas: 'LAS',
  'las vegas': 'LAS',
  bali: 'DPS',
  cabo: 'SJD',
  cancun: 'CUN',
  cancún: 'CUN',
  'punta cana': 'PUJ',
};

/**
 * Normalize a location string for lookup
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\sàáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿß]/g, '')
    .trim();
}

/**
 * Airport type priority for ranking (lower = better)
 */
const TYPE_PRIORITY: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
  seaplane_base: 3,
  heliport: 4,
};

/**
 * Score an airport result for relevance
 */
function scoreAirport(airport: AirportRecord, query: string): number {
  let score = TYPE_PRIORITY[airport.type] ?? 5;

  // Prefer airports with scheduled service
  if (airport.scheduled_service !== 'TRUE') {
    score += 3;
  }

  // Exact name match bonus
  const airportNameLower = airport.airport.toLowerCase();
  const queryLower = query.toLowerCase();
  if (airportNameLower.includes(queryLower)) {
    score -= 2;
  }

  return score;
}

export interface AirportLookupResult {
  iataCode: string;
  name: string;
  countryCode: string;
  type: string;
  source: 'alias' | 'database' | 'autocomplete';
}

/**
 * Look up an airport IATA code from a city/airport name.
 *
 * Resolution order:
 * 1. Check alias map (German names, multi-airport cities)
 * 2. Search airport-data-js by name (18,700+ airports)
 * 3. Try autocomplete suggestions
 *
 * @returns IATA code or null if not found
 */
export async function lookupAirportByName(
  location: string
): Promise<AirportLookupResult | null> {
  const normalized = normalize(location);

  if (!normalized) return null;

  // Already an IATA code?
  if (/^[a-z]{3}$/.test(normalized)) {
    const code = normalized.toUpperCase();
    const valid = await validateIataCodeLib(code);
    if (valid) {
      const airports = await getAirportByIata(code);
      const airport = Array.isArray(airports) ? airports[0] : airports;
      return {
        iataCode: code,
        name: airport?.airport || code,
        countryCode: airport?.country_code || '',
        type: airport?.type || '',
        source: 'database',
      };
    }
  }

  // Tier 1: Alias map (German names, multi-airport cities)
  const aliasCode = CITY_ALIASES[normalized];
  if (aliasCode) {
    const airports = await getAirportByIata(aliasCode);
    const airport = Array.isArray(airports) ? airports[0] : airports;
    return {
      iataCode: aliasCode,
      name: airport?.airport || aliasCode,
      countryCode: airport?.country_code || '',
      type: airport?.type || '',
      source: 'alias',
    };
  }

  // Tier 2: Search by name in airport-data-js
  try {
    const results = (await searchByName(location)) as AirportRecord[];
    if (results && results.length > 0) {
      // Sort by relevance score (prefer large airports with scheduled service)
      const sorted = [...results].sort(
        (a, b) => scoreAirport(a, location) - scoreAirport(b, location)
      );
      const best = sorted[0];
      if (best?.iata) {
        return {
          iataCode: best.iata,
          name: best.airport,
          countryCode: best.country_code,
          type: best.type,
          source: 'database',
        };
      }
    }
  } catch (err) {
    console.warn('[AirportDB] searchByName failed:', err);
  }

  // Tier 3: Autocomplete suggestions
  try {
    const suggestions = (await getAutocompleteSuggestions(
      normalized
    )) as AirportRecord[];
    if (suggestions && suggestions.length > 0) {
      // Filter and sort
      const filtered = suggestions
        .filter((s) => s.iata && s.scheduled_service === 'TRUE')
        .sort(
          (a, b) => scoreAirport(a, location) - scoreAirport(b, location)
        );

      const best = filtered[0] || suggestions[0];
      if (best?.iata) {
        return {
          iataCode: best.iata,
          name: best.airport,
          countryCode: best.country_code,
          type: best.type,
          source: 'autocomplete',
        };
      }
    }
  } catch (err) {
    console.warn('[AirportDB] autocomplete failed:', err);
  }

  return null;
}

/**
 * Validate if an IATA code exists in the database
 */
export async function isValidIATACodeInDB(code: string): Promise<boolean> {
  try {
    return await validateIataCodeLib(code);
  } catch {
    return false;
  }
}

/**
 * Get airport details by IATA code
 */
export async function getAirportDetails(
  code: string
): Promise<AirportRecord | null> {
  try {
    const results = await getAirportByIata(code);
    return Array.isArray(results) ? results[0] || null : results || null;
  } catch {
    return null;
  }
}
