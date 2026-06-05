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
