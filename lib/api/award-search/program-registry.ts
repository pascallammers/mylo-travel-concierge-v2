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
 * Map free-text loyalty-program inputs (from the model's `loyaltyPrograms`
 * argument) to seats.aero source slugs. The model may hand back a bare slug
 * ("aeroplan"), the full brand name it saw in the table ("Lufthansa Miles &
 * More"), or a bare brand keyword ("KrisFlyer"). We match case-insensitively
 * against each program's slug and its localized display names, both as an exact
 * match and as a substring of the display name, so a brand keyword resolves
 * without an exhaustive alias table.
 *
 * Unmatched inputs are returned separately rather than dropped, so the caller
 * can tell the user which program request could not be honored instead of
 * silently ignoring it. Matches preserve first-seen order and are deduplicated.
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
      KNOWN_PROGRAM_SLUGS.find((s) => s === needle || tokens.includes(s)) ??
      KNOWN_PROGRAM_SLUGS.find((s) => {
        const name = normalizeProgramName(PROGRAM_NAMES[s].en);
        return needle.length >= 3 && name.includes(needle);
      });

    if (!slug) {
      if (!unmatched.includes(raw)) unmatched.push(raw);
    } else if (!matched.includes(slug)) {
      matched.push(slug);
    }
  }

  return { matched, unmatched };
}

/** Lowercase, collapse whitespace and unify "&"/"and" for tolerant matching. */
function normalizeProgramName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
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
