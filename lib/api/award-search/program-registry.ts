/**
 * seats.aero mileage-program registry: Source slug -> display name {de, en}.
 *
 * Slugs are the real seats.aero `Source` values. 23 of the 25 were harvested
 * live from /partnerapi/search across diverse long-haul routes (JFK-LHR,
 * LAX-SYD, PTY-GRU, ...); connectmiles + lifemiles are the two well-known
 * Copa/Avianca sources that did not surface in those windows. Unknown slugs
 * fall back to a Title-Cased label plus a console warning.
 *
 * Program names are brand proper nouns, so `de` and `en` are intentionally
 * identical today; the localized shape keeps room for future divergence
 * (e.g. a translated generic suffix) without touching call sites.
 */

import type { TransferLocale } from '@/lib/config/transfer-engine/types';

interface LocalizedProgramName {
  de: string;
  en: string;
}

const PROGRAM_NAMES: Record<string, LocalizedProgramName> = {
  aeroplan: { de: 'Air Canada Aeroplan', en: 'Air Canada Aeroplan' },
  aeromexico: { de: 'Aeroméxico Rewards', en: 'Aeroméxico Rewards' },
  alaska: { de: 'Alaska Mileage Plan', en: 'Alaska Mileage Plan' },
  american: { de: 'American AAdvantage', en: 'American AAdvantage' },
  azul: { de: 'Azul TudoAzul', en: 'Azul TudoAzul' },
  british: { de: 'British Airways Executive Club', en: 'British Airways Executive Club' },
  connectmiles: { de: 'Copa ConnectMiles', en: 'Copa ConnectMiles' },
  delta: { de: 'Delta SkyMiles', en: 'Delta SkyMiles' },
  emirates: { de: 'Emirates Skywards', en: 'Emirates Skywards' },
  ethiopian: { de: 'Ethiopian ShebaMiles', en: 'Ethiopian ShebaMiles' },
  etihad: { de: 'Etihad Guest', en: 'Etihad Guest' },
  eurobonus: { de: 'SAS EuroBonus', en: 'SAS EuroBonus' },
  finnair: { de: 'Finnair Plus', en: 'Finnair Plus' },
  flyingblue: { de: 'Flying Blue (Air France/KLM)', en: 'Flying Blue (Air France/KLM)' },
  jetblue: { de: 'JetBlue TrueBlue', en: 'JetBlue TrueBlue' },
  lifemiles: { de: 'Avianca LifeMiles', en: 'Avianca LifeMiles' },
  lufthansa: { de: 'Lufthansa Miles & More', en: 'Lufthansa Miles & More' },
  qantas: { de: 'Qantas Frequent Flyer', en: 'Qantas Frequent Flyer' },
  qatar: { de: 'Qatar Airways Privilege Club', en: 'Qatar Airways Privilege Club' },
  saudia: { de: 'Saudia Alfursan', en: 'Saudia Alfursan' },
  singapore: { de: 'Singapore Airlines KrisFlyer', en: 'Singapore Airlines KrisFlyer' },
  smiles: { de: 'GOL Smiles', en: 'GOL Smiles' },
  united: { de: 'United MileagePlus', en: 'United MileagePlus' },
  velocity: { de: 'Virgin Australia Velocity', en: 'Virgin Australia Velocity' },
  virginatlantic: { de: 'Virgin Atlantic Flying Club', en: 'Virgin Atlantic Flying Club' },
};

/** All seats.aero source slugs the registry maps by name. */
export const KNOWN_PROGRAM_SLUGS: string[] = Object.keys(PROGRAM_NAMES);

/**
 * Map free-text loyalty-program inputs to seats.aero source slugs.
 *
 * @param inputs - Free-text loyalty-program names or seats.aero slugs.
 * @returns Matched source slugs and the original inputs that could not be mapped.
 */
export function resolveProgramSlugs(
  inputs: string[],
): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const raw of inputs) {
    const needle = normalizeProgramName(raw);
    if (!needle) continue;

    const tokens = needle.split(/[^a-z0-9]+/).filter(Boolean);
    const slug =
      KNOWN_PROGRAM_SLUGS.find((candidate) => candidate === needle || tokens.includes(candidate)) ??
      KNOWN_PROGRAM_SLUGS.find((candidate) =>
        displayNameMatchesNeedle(PROGRAM_NAMES[candidate].en, needle),
      );

    if (!slug) {
      if (!unmatched.includes(raw)) unmatched.push(raw);
    } else if (!matched.includes(slug)) {
      matched.push(slug);
    }
  }

  return { matched, unmatched };
}

/**
 * Match a normalized needle against a program display name using token or
 * consecutive phrase equality.
 *
 * @param displayName - Localized program brand name.
 * @param needle - Normalized user input to match.
 * @returns True when the needle equals a name token or consecutive phrase.
 */
function displayNameMatchesNeedle(displayName: string, needle: string): boolean {
  if (needle.length < 3) return false;

  const nameTokens = normalizeProgramName(displayName).split(/[^a-z0-9]+/).filter(Boolean);
  const needleTokens = needle.split(/[^a-z0-9]+/).filter(Boolean);
  if (needleTokens.length === 0) return false;

  if (needleTokens.length === 1) {
    return nameTokens.some((nameToken) => nameToken === needleTokens[0]);
  }

  for (let index = 0; index <= nameTokens.length - needleTokens.length; index += 1) {
    if (needleTokens.every((token, offset) => nameTokens[index + offset] === token)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a program name for case-insensitive matching.
 *
 * @param value - Raw program name or slug input.
 * @returns Normalized program name.
 */
function normalizeProgramName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Route/date/cabin context used to prefill a program's award-search deeplink. */
export interface AwardBookingContext {
  origin: string;
  destination: string;
  /** YYYY-MM-DD */
  departDate: string;
  cabin: string;
}

/** Encode a query-parameter value, including parens that would break Markdown link targets. */
const queryValue = (value: string): string => {
  const encoded = new URLSearchParams({ _: value }).toString();
  return encoded.slice(2);
};

const UNITED_CABIN_CODES: Record<string, string> = {
  economy: '7',
  'premium economy': '6',
  business: '4',
  first: '3',
};

const getOwnValue = <T>(record: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

const PROGRAM_DEEPLINKS: Record<string, (ctx: AwardBookingContext) => string> = {
  aeroplan: ({ origin, destination, departDate }) =>
    `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${queryValue(origin)}&dest0=${queryValue(destination)}&departureDate0=${queryValue(departDate)}&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&marketCode=INT`,
  alaska: ({ origin, destination, departDate }) =>
    `https://www.alaskaair.com/search/results?A=1&O=${queryValue(origin)}&D=${queryValue(destination)}&OD=${queryValue(departDate)}&RT=false&ShoppingMethod=onlineaward`,
  jetblue: ({ origin, destination, departDate }) =>
    `https://www.jetblue.com/booking/flights?from=${queryValue(origin)}&to=${queryValue(destination)}&depart=${queryValue(departDate)}&adults=1&usePoints=true`,
  united: ({ origin, destination, departDate, cabin }) => {
    const cabinCode = getOwnValue(UNITED_CABIN_CODES, cabin.trim().toLowerCase());
    const cabinParam = cabinCode ? `&clm=${cabinCode}` : '';
    return `https://www.united.com/en/us/fsr/choose-flights?f=${queryValue(origin)}&t=${queryValue(destination)}&d=${queryValue(departDate)}&tt=1&at=1&px=1&taxng=1&idx=1&tqp=A${cabinParam}`;
  },
};

// Award-search entry page per program, used when the website offers no
// prefillable deeplink (login walls, session-bound search forms, ...).
const PROGRAM_SEARCH_PAGES: Record<string, string> = {
  aeromexico: 'https://www.aeromexico.com/en-us/aeromexico-rewards',
  american: 'https://www.aa.com/booking/find-flights',
  azul: 'https://www.voeazul.com.br/en/tudoazul',
  british: 'https://www.britishairways.com/travel/redeem/execclub/_gf/en_gb',
  connectmiles: 'https://www.copaair.com/en/web/us/connectmiles',
  delta: 'https://www.delta.com/flight-search/book-a-flight',
  emirates: 'https://www.emirates.com/english/skywards/',
  ethiopian: 'https://www.ethiopianairlines.com/aa/shebamiles',
  etihad: 'https://www.etihadguest.com/',
  eurobonus: 'https://www.flysas.com/',
  finnair: 'https://www.finnair.com/finnair-plus',
  flyingblue: 'https://www.flyingblue.com/en/earn-spend/flights/award-search',
  lifemiles: 'https://www.lifemiles.com/',
  lufthansa: 'https://www.miles-and-more.com/de/en/spend/flights.html',
  qantas: 'https://flightrewardfinder.qantas.com/',
  qatar: 'https://www.qatarairways.com/en/privilege-club.html',
  saudia: 'https://www.saudia.com/alfursan',
  singapore: 'https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/use-miles/',
  smiles: 'https://www.smiles.com.br/',
  velocity: 'https://www.virginaustralia.com/velocity/',
  virginatlantic: 'https://www.virginatlantic.com/flying-club',
};

/**
 * Booking URL for an award row: a prefilled deeplink where the program's
 * website supports one, otherwise the program's award-search page.
 *
 * @param slug Program slug from the award-search provider.
 * @param ctx Route, departure-date, and cabin context for supported deeplinks.
 * @returns A program booking URL, or `null` for an unknown program.
 */
export function getProgramBookingUrl(
  slug: string,
  ctx: AwardBookingContext,
): string | null {
  const deeplink = getOwnValue(PROGRAM_DEEPLINKS, slug);
  if (deeplink) return deeplink(ctx);

  return getOwnValue(PROGRAM_SEARCH_PAGES, slug) ?? null;
}

interface LocalizedProgramCaveat {
  de: string;
  en: string;
}

// Known airline-website hurdles (MYLO-17). Rendered as footnotes under the
// award table so users don't fail when they try to verify/book on the
// program's own site. Keep entries short — one footnote line per program.
const PROGRAM_CAVEATS: Record<string, LocalizedProgramCaveat> = {
  singapore: {
    de: 'Die KrisFlyer-Website blockiert die Award-Suche bei einem Kontostand unter ca. 1.000 Meilen ("miles balance is insufficient"). Workarounds: 3.000 Marriott Bonvoy Punkte zu 1.000 Meilen übertragen (3:1), die mobile SIA-App nutzen oder telefonisch buchen.',
    en: 'The KrisFlyer website blocks award search when your balance is below roughly 1,000 miles ("miles balance is insufficient"). Workarounds: transfer 3,000 Marriott Bonvoy points for 1,000 miles (3:1), use the SIA mobile app, or book by phone.',
  },
  emirates: {
    de: 'Emirates zeigt Meilenpreise nur eingeloggt und mit aktivierter "Classic Rewards"-Checkbox. Partner-Awards finden Sie nur über die Advanced Search mit "Search partner flights only".',
    en: 'Emirates only shows mileage prices when you are logged in with the "Classic Rewards" checkbox ticked. Partner awards only appear via Advanced Search with "Search partner flights only".',
  },
};

/**
 * Known website hurdle for a program, or null when booking on the program's
 * site works without surprises. Localized, customer-facing text.
 *
 * @param slug Program slug from the award-search provider.
 * @param locale Locale for the customer-facing caveat.
 * @returns A localized caveat, or `null` when no hurdle is known.
 */
export function getProgramCaveat(
  slug: string,
  locale: TransferLocale,
): string | null {
  return PROGRAM_CAVEATS[slug]?.[locale] ?? null;
}

/**
 * Resolve a seats.aero source slug to a customer-facing program label.
 *
 * @param slug - seats.aero source slug.
 * @param locale - Response locale for the display name.
 * @returns Localized brand name, or a Title-Cased fallback for unknown slugs.
 */
export function getProgramDisplayName(slug: string, locale: TransferLocale): string {
  // A missing slug must never crash the renderer (which formats both award AND
  // cash tables in one call); degrade to an empty label.
  if (!slug) return '';

  const known = PROGRAM_NAMES[slug];
  if (known) return known[locale];

  // Unknown program: never leak the raw slug to the user. Title-Case it as a
  // best-effort label and warn so a missing mapping surfaces in logs/QA.
  console.warn(`[award-search] Unknown seats.aero program slug "${slug}" — using Title-Case fallback`);
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
