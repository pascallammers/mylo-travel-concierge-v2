/**
 * Airport IATA code mapping and resolution utilities
 * Automatically converts city names to their primary airport IATA codes
 */

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
