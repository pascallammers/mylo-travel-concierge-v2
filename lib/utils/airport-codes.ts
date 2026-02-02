/**
 * Airport IATA code mapping and resolution utilities
 * Automatically converts city names to their primary airport IATA codes
 */

import { extractAirportCodes, type AirportExtractionResult } from './llm-airport-resolver';
import { airportExtractionCache, airportCorrectionCache, createAirportKey } from '../performance-cache';
import { validateIATACode } from '../api/duffel-client';

/**
 * Airport IATA code mapping
 * Maps common city names (lowercase) to their primary airport codes
 */
export const AIRPORT_CODES: Record<string, string> = {
  // Germany
  berlin: 'BER',
  münchen: 'MUC',
  munich: 'MUC',
  frankfurt: 'FRA',
  hamburg: 'HAM',
  düsseldorf: 'DUS',
  dusseldorf: 'DUS',
  köln: 'CGN',
  cologne: 'CGN',
  stuttgart: 'STR',
  hannover: 'HAJ',
  hanover: 'HAJ',
  nürnberg: 'NUE',
  nuremberg: 'NUE',
  bremen: 'BRE',
  leipzig: 'LEJ',
  dresden: 'DRS',

  // USA - Major Cities
  'new york': 'JFK',
  nyc: 'JFK',
  'new york city': 'JFK',
  manhattan: 'JFK',
  'los angeles': 'LAX',
  la: 'LAX',
  chicago: 'ORD',
  houston: 'IAH',
  phoenix: 'PHX',
  philadelphia: 'PHL',
  'san antonio': 'SAT',
  'san diego': 'SAN',
  dallas: 'DFW',
  'san jose': 'SJC',
  austin: 'AUS',
  jacksonville: 'JAX',
  'fort worth': 'DFW',
  columbus: 'CMH',
  charlotte: 'CLT',
  'san francisco': 'SFO',
  sf: 'SFO',
  indianapolis: 'IND',
  seattle: 'SEA',
  denver: 'DEN',
  washington: 'IAD',
  'washington dc': 'IAD',
  boston: 'BOS',
  'el paso': 'ELP',
  nashville: 'BNA',
  detroit: 'DTW',
  oklahoma: 'OKC',
  portland: 'PDX',
  'las vegas': 'LAS',
  vegas: 'LAS',
  memphis: 'MEM',
  louisville: 'SDF',
  milwaukee: 'MKE',
  albuquerque: 'ABQ',
  tucson: 'TUS',
  fresno: 'FAT',
  sacramento: 'SMF',
  'kansas city': 'MCI',
  atlanta: 'ATL',
  miami: 'MIA',
  tampa: 'TPA',
  orlando: 'MCO',
  'new orleans': 'MSY',

  // Canada
  toronto: 'YYZ',
  vancouver: 'YVR',
  montreal: 'YUL',
  calgary: 'YYC',
  ottawa: 'YOW',
  edmonton: 'YEG',
  winnipeg: 'YWG',
  quebec: 'YQB',
  'quebec city': 'YQB',
  halifax: 'YHZ',

  // UK & Ireland
  london: 'LHR',
  manchester: 'MAN',
  birmingham: 'BHX',
  glasgow: 'GLA',
  edinburgh: 'EDI',
  bristol: 'BRS',
  liverpool: 'LPL',
  newcastle: 'NCL',
  belfast: 'BFS',
  dublin: 'DUB',
  cork: 'ORK',

  // Europe - Major Cities
  paris: 'CDG',
  amsterdam: 'AMS',
  madrid: 'MAD',
  barcelona: 'BCN',
  rome: 'FCO',
  milan: 'MXP',
  milano: 'MXP',
  venice: 'VCE',
  vienna: 'VIE',
  wien: 'VIE',
  zurich: 'ZRH',
  zürich: 'ZRH',
  geneva: 'GVA',
  genève: 'GVA',
  brussels: 'BRU',
  bruxelles: 'BRU',
  copenhagen: 'CPH',
  stockholm: 'ARN',
  oslo: 'OSL',
  helsinki: 'HEL',
  warsaw: 'WAW',
  prague: 'PRG',
  budapest: 'BUD',
  athens: 'ATH',
  lisbon: 'LIS',
  lisboa: 'LIS',
  porto: 'OPO',

  // Asia - Major Cities
  tokyo: 'NRT',
  osaka: 'KIX',
  seoul: 'ICN',
  beijing: 'PEK',
  shanghai: 'PVG',
  'hong kong': 'HKG',
  hongkong: 'HKG',
  singapore: 'SIN',
  bangkok: 'BKK',
  'kuala lumpur': 'KUL',
  jakarta: 'CGK',
  manila: 'MNL',
  taipei: 'TPE',
  hanoi: 'HAN',
  'ho chi minh': 'SGN',
  'ho chi minh city': 'SGN',
  saigon: 'SGN',
  delhi: 'DEL',
  'new delhi': 'DEL',
  mumbai: 'BOM',
  bombay: 'BOM',
  bangalore: 'BLR',
  bengaluru: 'BLR',
  chennai: 'MAA',
  kolkata: 'CCU',
  calcutta: 'CCU',
  hyderabad: 'HYD',

  // Thailand (detailed)
  phuket: 'HKT',
  'koh samui': 'USM',
  samui: 'USM',
  'chiang mai': 'CNX',
  'krabi': 'KBV',
  'hat yai': 'HDY',

  // Middle East
  dubai: 'DXB',
  'abu dhabi': 'AUH',
  doha: 'DOH',
  riyadh: 'RUH',
  jeddah: 'JED',
  kuwait: 'KWI',
  muscat: 'MCT',
  bahrain: 'BAH',
  tehran: 'IKA',
  istanbul: 'IST',
  ankara: 'ESB',
  'tel aviv': 'TLV',
  jerusalem: 'TLV',
  amman: 'AMM',
  beirut: 'BEY',

  // Australia & New Zealand
  sydney: 'SYD',
  melbourne: 'MEL',
  brisbane: 'BNE',
  perth: 'PER',
  adelaide: 'ADL',
  'gold coast': 'OOL',
  canberra: 'CBR',
  auckland: 'AKL',
  wellington: 'WLG',
  christchurch: 'CHC',
  queenstown: 'ZQN',

  // Central America & Caribbean
  'costa rica': 'SJO',
  'san jose costa rica': 'SJO',
  liberia: 'LIR',
  'liberia costa rica': 'LIR',
  guanacaste: 'LIR',
  panama: 'PTY',
  'panama city': 'PTY',
  'guatemala city': 'GUA',
  guatemala: 'GUA',
  'san salvador': 'SAL',
  'el salvador': 'SAL',
  tegucigalpa: 'TGU',
  honduras: 'TGU',
  managua: 'MGA',
  nicaragua: 'MGA',
  'belize city': 'BZE',
  belize: 'BZE',
  'santo domingo': 'SDQ',
  'dominican republic': 'SDQ',
  kingston: 'KIN',
  jamaica: 'MBJ',
  'montego bay': 'MBJ',
  nassau: 'NAS',
  bahamas: 'NAS',
  aruba: 'AUA',
  curacao: 'CUR',
  curaçao: 'CUR',
  'st maarten': 'SXM',
  'sint maarten': 'SXM',
  barbados: 'BGI',
  'trinidad': 'POS',
  'port of spain': 'POS',

  // South America
  'são paulo': 'GRU',
  'sao paulo': 'GRU',
  'rio de janeiro': 'GIG',
  rio: 'GIG',
  'buenos aires': 'EZE',
  santiago: 'SCL',
  lima: 'LIM',
  bogota: 'BOG',
  bogotá: 'BOG',
  caracas: 'CCS',
  quito: 'UIO',
  'la paz': 'LPB',

  // Africa
  johannesburg: 'JNB',
  'cape town': 'CPT',
  cairo: 'CAI',
  nairobi: 'NBO',
  lagos: 'LOS',
  casablanca: 'CMN',
  marrakech: 'RAK',
  marrakesh: 'RAK',
  tunis: 'TUN',
  addis: 'ADD',
  'addis ababa': 'ADD',

  // Additional Popular Destinations
  bali: 'DPS',
  denpasar: 'DPS',
  'cancun': 'CUN',
  cancún: 'CUN',
  'los cabos': 'SJD',
  'cabo': 'SJD',
  'punta cana': 'PUJ',
  reykjavik: 'KEF',
  reykjavík: 'KEF',
  havana: 'HAV',
  havanna: 'HAV',
  'san juan': 'SJU',
};

/**
 * Resolves a city name or IATA code to a valid IATA airport code
 * @param location - City name (e.g., "Frankfurt", "New York") or IATA code (e.g., "FRA", "JFK")
 * @returns IATA code (3 letters uppercase)
 */
export function resolveIATACode(location: string): string {
  if (!location || typeof location !== 'string') {
    console.warn('[IATA] Invalid location provided:', location);
    return '';
  }

  const trimmed = location.trim();

  // If already a valid IATA code (exactly 3 uppercase letters), return as-is
  if (/^[A-Z]{3}$/.test(trimmed)) {
    return trimmed;
  }

  // Normalize: lowercase, trim, remove special characters
  const normalized = trimmed.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // Try to find exact match in mapping
  const exactMatch = AIRPORT_CODES[normalized];
  if (exactMatch) {
    console.log(`[IATA] Resolved "${location}" → ${exactMatch}`);
    return exactMatch;
  }

  // Try to find partial match (e.g., "new york city" matches "new york")
  const partialMatch = Object.keys(AIRPORT_CODES).find((key) =>
    normalized.includes(key) || key.includes(normalized)
  );
  if (partialMatch) {
    const code = AIRPORT_CODES[partialMatch];
    console.log(`[IATA] Partial match: "${location}" → ${code} (via "${partialMatch}")`);
    return code;
  }

  // If string contains a 3-letter code anywhere, extract it
  const extractedCode = trimmed.match(/\b([A-Z]{3})\b/);
  if (extractedCode) {
    console.log(`[IATA] Extracted code from "${location}" → ${extractedCode[1]}`);
    return extractedCode[1];
  }

  // Fallback: Take first 3 letters and uppercase (might work for some cases)
  const fallback = trimmed.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
  console.warn(`[IATA] Could not resolve "${location}", using fallback: ${fallback}`);
  return fallback;
}

/**
 * Validates if a string is a valid IATA airport code format
 * @param code - String to validate
 * @returns true if valid IATA code format (3 uppercase letters)
 */
export function isValidIATACode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Gets the city name for a given IATA code (reverse lookup)
 * @param iataCode - IATA airport code (e.g., "FRA")
 * @returns City name or the IATA code if not found
 */
export function getCityNameForIATA(iataCode: string): string {
  const normalized = iataCode.toUpperCase();
  const entry = Object.entries(AIRPORT_CODES).find(([, code]) => code === normalized);
  return entry ? entry[0] : iataCode;
}

/**
 * Airport resolution result with confidence levels
 */
export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AirportResolutionResult {
  origin: Airport | null;
  destination: Airport | null;
  needsClarification?: {
    type: 'origin' | 'destination' | 'both';
    message: string;
  };
  error?: string;
}

/**
 * Cache entry type for airport extractions (imported from performance-cache)
 */
interface AirportExtractionCacheEntry {
  origin: { code: string; name: string; confidence: string } | null;
  destination: { code: string; name: string; confidence: string } | null;
  cachedAt: number;
}

/**
 * Convert cache entry to full AirportResolutionResult
 */
function cacheEntryToResult(entry: AirportExtractionCacheEntry): AirportResolutionResult {
  return {
    origin: entry.origin ? {
      code: entry.origin.code,
      name: entry.origin.name,
      city: entry.origin.name,
      country: '',
      confidence: entry.origin.confidence as 'high' | 'medium' | 'low',
    } : null,
    destination: entry.destination ? {
      code: entry.destination.code,
      name: entry.destination.name,
      city: entry.destination.name,
      country: '',
      confidence: entry.destination.confidence as 'high' | 'medium' | 'low',
    } : null,
  };
}

/**
 * Convert AirportResolutionResult to cache entry
 */
function resultToCacheEntry(result: AirportResolutionResult): AirportExtractionCacheEntry {
  return {
    origin: result.origin ? {
      code: result.origin.code,
      name: result.origin.name,
      confidence: result.origin.confidence,
    } : null,
    destination: result.destination ? {
      code: result.destination.code,
      name: result.destination.name,
      confidence: result.destination.confidence,
    } : null,
    cachedAt: Date.now(),
  };
}

/**
 * Try to extract direct IATA codes from query (e.g., "FRA to LIR")
 */
function tryDirectCodeExtraction(query: string): AirportResolutionResult | null {
  // Match patterns like "FRA to LIR", "FRA nach LIR", "FRA → LIR"
  const patterns = [
    /\b([A-Z]{3})\s+(?:to|nach|→|-|->)\s+([A-Z]{3})\b/i,
    /\b([A-Z]{3})\s*-\s*([A-Z]{3})\b/,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1] && match[2]) {
      const originCode = match[1].toUpperCase();
      const destCode = match[2].toUpperCase();

      if (isValidIATACode(originCode) && isValidIATACode(destCode)) {
        return {
          origin: {
            code: originCode,
            name: getCityNameForIATA(originCode),
            city: getCityNameForIATA(originCode),
            country: '',
            confidence: 'high',
          },
          destination: {
            code: destCode,
            name: getCityNameForIATA(destCode),
            city: getCityNameForIATA(destCode),
            country: '',
            confidence: 'high',
          },
        };
      }
    }
  }

  return null;
}

/**
 * Try static mapping for simple city names
 */
function tryStaticMapping(query: string): AirportResolutionResult | null {
  // Normalize query
  const normalized = query.toLowerCase().trim();

  // Try to match patterns like "city1 to city2" or "city1 nach city2"
  const patterns = [
    /^(.+?)\s+(?:to|nach|→)\s+(.+?)$/i,
    /^from\s+(.+?)\s+to\s+(.+?)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1] && match[2]) {
      const origin = match[1].trim();
      const destination = match[2].trim();

      const originCode = AIRPORT_CODES[origin];
      const destCode = AIRPORT_CODES[destination];

      if (originCode && destCode) {
        return {
          origin: {
            code: originCode,
            name: getCityNameForIATA(originCode),
            city: origin,
            country: '',
            confidence: 'high',
          },
          destination: {
            code: destCode,
            name: getCityNameForIATA(destCode),
            city: destination,
            country: '',
            confidence: 'high',
          },
        };
      }
    }
  }

  return null;
}

/**
 * Convert LLM extraction result to AirportResolutionResult
 */
function convertLLMResult(llmResult: AirportExtractionResult): AirportResolutionResult {
  const origin = llmResult.originConfidence !== 'none' ? {
    code: llmResult.originCode,
    name: llmResult.originName,
    city: llmResult.originCity,
    country: llmResult.originCountry,
    confidence: llmResult.originConfidence as 'high' | 'medium' | 'low',
  } : null;

  const destination = llmResult.destinationConfidence !== 'none' ? {
    code: llmResult.destinationCode,
    name: llmResult.destinationName,
    city: llmResult.destinationCity,
    country: llmResult.destinationCountry,
    confidence: llmResult.destinationConfidence as 'high' | 'medium' | 'low',
  } : null;

  const result: AirportResolutionResult = {
    origin,
    destination,
  };

  // Check for low confidence requiring clarification
  if (origin && origin.confidence === 'low') {
    result.needsClarification = {
      type: destination && destination.confidence === 'low' ? 'both' : 'origin',
      message: llmResult.reasoning || 'Origin airport is ambiguous',
    };
  } else if (destination && destination.confidence === 'low') {
    result.needsClarification = {
      type: 'destination',
      message: llmResult.reasoning || 'Destination airport is ambiguous',
    };
  }

  return result;
}

/**
 * LLM timeout constant (2 seconds for airport resolution)
 */
const LLM_TIMEOUT_MS = 2000;

/**
 * Extract airport codes with timeout wrapper
 */
async function extractWithTimeout(query: string): Promise<AirportExtractionResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS)
  );

  return Promise.race([extractAirportCodes(query), timeoutPromise]) as Promise<AirportExtractionResult>;
}

/**
 * Detects if a user message is correcting a previous airport extraction.
 * Patterns: "nein, ich meinte LIR", "nicht LIB sondern LIR", "korrektur: LIR"
 * @param message - User's follow-up message
 * @param previousExtraction - The previous extraction result to correct
 * @returns Corrected result or null if not a correction
 */
export function detectCorrectionIntent(
  message: string,
  previousExtraction: AirportResolutionResult | null
): { type: 'origin' | 'destination'; correctedCode: string } | null {
  if (!previousExtraction) return null;

  const correctionPatterns = [
    /(?:nein|nicht|falsch)[,\s]+(?:ich meinte?|sondern|das ist)\s+([A-Z]{3})/i,
    /korrektur[:\s]+([A-Z]{3})/i,
    /(?:eigentlich|richtig ist)\s+([A-Z]{3})/i,
    /^([A-Z]{3})$/,  // Just the code alone as a correction
  ];

  for (const pattern of correctionPatterns) {
    const match = message.match(pattern);
    if (match) {
      const correctedCode = match[1].toUpperCase();
      // Determine if correcting origin or destination based on context
      const type = inferCorrectionTarget(previousExtraction, correctedCode);
      return { type, correctedCode };
    }
  }
  return null;
}

/**
 * Infer which field (origin or destination) is being corrected
 */
function inferCorrectionTarget(
  previous: AirportResolutionResult,
  correctedCode: string
): 'origin' | 'destination' {
  // If previous had needsClarification, use that
  if (previous.needsClarification?.type === 'origin' || previous.needsClarification?.type === 'both') {
    return 'origin';
  }
  if (previous.needsClarification?.type === 'destination') {
    return 'destination';
  }
  // Default to destination (most common correction case)
  return 'destination';
}

/**
 * Stores a user correction to influence future extractions.
 * When LLM extracts LIB but user corrects to LIR for "liberia costa rica",
 * this mapping is cached so future similar queries prefer LIR.
 */
export function storeCorrectionMapping(
  originalQuery: string,
  extractedCode: string,
  correctedCode: string
): void {
  const key = createAirportKey(originalQuery);
  airportCorrectionCache.set(key, {
    originalQuery: originalQuery.toLowerCase(),
    extractedCode,
    correctedCode,
    correctedAt: Date.now(),
  });
  console.log(`[Airport] Stored correction: "${originalQuery}" ${extractedCode} -> ${correctedCode}`);
}

/**
 * Resolve airport codes from natural language query using LLM
 *
 * Uses a tiered approach:
 * 1. Try direct IATA code extraction (e.g., "FRA to LIR")
 * 2. Check cache for previous extractions
 * 3. Try static mapping for simple city names
 * 4. Fall back to LLM extraction for complex/ambiguous queries
 * 5. Validate low-confidence results
 *
 * @param query - Natural language query (e.g., "Frankfurt nach costa rica liberia")
 * @returns Airport resolution result with confidence levels
 */
export async function resolveAirportCodesWithLLM(query: string): Promise<AirportResolutionResult> {
  // Tier 1: Check if already valid IATA codes (e.g., "FRA to LIR")
  const directMatch = tryDirectCodeExtraction(query);
  if (directMatch) {
    console.log('[Airport Resolution] Direct code match:', directMatch);
    return directMatch;
  }

  // Tier 2: Cache lookup
  const cacheKey = createAirportKey(query);
  const cached = airportExtractionCache.get(cacheKey);
  if (cached) {
    console.log('[Airport] Cache hit:', cacheKey);
    return cacheEntryToResult(cached);
  }

  // Check for user corrections that apply to this query
  const correction = airportCorrectionCache.get(cacheKey);
  if (correction) {
    console.log(`[Airport] Found previous user correction: ${correction.extractedCode} -> ${correction.correctedCode}`);
    // Apply the correction by returning a high-confidence result with the corrected code
    const correctedResult: AirportResolutionResult = {
      origin: null,
      destination: {
        code: correction.correctedCode,
        name: getCityNameForIATA(correction.correctedCode),
        city: getCityNameForIATA(correction.correctedCode),
        country: '',
        confidence: 'high',
      },
    };
    return correctedResult;
  }

  // Tier 3: Try static mapping for simple city names
  const staticResult = tryStaticMapping(query);
  if (staticResult && staticResult.origin?.confidence === 'high' && staticResult.destination?.confidence === 'high') {
    console.log('[Airport Resolution] Static mapping match:', staticResult);
    airportExtractionCache.set(cacheKey, resultToCacheEntry(staticResult));
    return staticResult;
  }

  // Tier 4: LLM extraction for complex/ambiguous queries
  console.log('[Airport Resolution] Using LLM extraction for:', query);

  let llmResult: AirportExtractionResult;
  try {
    llmResult = await extractWithTimeout(query);
  } catch (error) {
    console.error('[Airport Resolution] LLM extraction failed:', error);
    return {
      origin: null,
      destination: null,
      error: 'Failed to extract airport codes from query (timeout or error)',
    };
  }

  if ('error' in llmResult) {
    return {
      origin: null,
      destination: null,
      error: 'Failed to extract airport codes from query',
    };
  }

  const result = convertLLMResult(llmResult);

  // Tier 5: Validate low-confidence results
  if (result.origin?.confidence === 'low' && result.origin?.code) {
    const originCode = result.origin.code;
    const valid = await validateIATACode(originCode);
    if (!valid) {
      result.origin = null;
      result.needsClarification = {
        type: 'origin',
        message: `Origin airport code "${originCode}" is invalid`,
      };
    }
  }

  if (result.destination?.confidence === 'low' && result.destination?.code) {
    const destCode = result.destination.code;
    const valid = await validateIATACode(destCode);
    if (!valid) {
      result.destination = null;
      result.needsClarification = {
        type: result.needsClarification?.type === 'origin' ? 'both' : 'destination',
        message: result.needsClarification?.message
          ? `${result.needsClarification.message}; Destination airport code "${destCode}" is invalid`
          : `Destination airport code "${destCode}" is invalid`,
      };
    }
  }

  // Cache successful extractions (not low-confidence or failed validations)
  if (result.origin?.confidence !== 'low' && result.destination?.confidence !== 'low' && !result.error) {
    airportExtractionCache.set(cacheKey, resultToCacheEntry(result));
  }

  return result;
}
