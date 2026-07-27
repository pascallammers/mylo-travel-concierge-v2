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

/** Route/date context used to prefill a program's award-search deeplink. */
export interface AwardBookingContext {
  origin: string;
  destination: string;
  /** YYYY-MM-DD */
  departDate: string;
}

/** Encode a query-parameter value, including parens that would break Markdown link targets. */
const queryValue = (value: string): string => {
  const encoded = new URLSearchParams({ _: value }).toString();
  return encoded.slice(2);
};

const PROGRAM_DEEPLINKS: Record<string, (ctx: AwardBookingContext) => string> = {
  aeroplan: ({ origin, destination, departDate }) =>
    `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${queryValue(origin)}&dest0=${queryValue(destination)}&departureDate0=${queryValue(departDate)}&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&marketCode=INT`,
  alaska: ({ origin, destination, departDate }) =>
    `https://www.alaskaair.com/search/results?A=1&O=${queryValue(origin)}&D=${queryValue(destination)}&OD=${queryValue(departDate)}&RT=false&ShoppingMethod=onlineaward`,
  jetblue: ({ origin, destination, departDate }) =>
    `https://www.jetblue.com/booking/flights?from=${queryValue(origin)}&to=${queryValue(destination)}&depart=${queryValue(departDate)}&adults=1&usePoints=true`,
  united: ({ origin, destination, departDate }) =>
    `https://www.united.com/en/us/fsr/choose-flights?f=${queryValue(origin)}&t=${queryValue(destination)}&d=${queryValue(departDate)}&tt=1&at=1&px=1&taxng=1&idx=1`,
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
  flyingblue: 'https://www.flyingblue.com/',
  lifemiles: 'https://www.lifemiles.com/',
  lufthansa: 'https://www.miles-and-more.com/de/en/spend/flights.html',
  qantas: 'https://www.qantas.com/frequent-flyer',
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
 * @param ctx Route and departure-date context for supported deeplinks.
 * @returns A program booking URL, or `null` for an unknown program.
 */
export function getProgramBookingUrl(
  slug: string,
  ctx: AwardBookingContext,
): string | null {
  const deeplink = PROGRAM_DEEPLINKS[slug];
  if (deeplink) return deeplink(ctx);
  return PROGRAM_SEARCH_PAGES[slug] ?? null;
}

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
