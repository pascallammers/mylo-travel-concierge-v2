import type { Anchor, Cabin } from './types';

export const ANCHOR_LABELS: Record<Anchor, string> = { travel: 'Reisewert', no_plan: 'Wert ohne Plan' };
export const CABIN_LABELS: Record<Cabin, string> = {
  all: 'Alle Klassen',
  economy: 'Economy Class',
  premium_economy: 'Premium Economy',
  business: 'Business Class',
  first: 'First Class',
};

/**
 * Format a source month consistently in summaries, mail and the dashboard.
 * @param date - Domain date or serialized ISO date/month.
 * @returns German MM/YYYY text, or an em dash when no source month exists.
 */
export function formatSourceMonth(date: Date | string): string {
  if (!date) return '—';
  const iso = typeof date === 'string' ? date : date.toISOString();
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Format a date-only review deadline without local timezone shifts.
 * @param date - Domain date or serialized ISO date.
 * @returns German DD.MM.YYYY text.
 */
export function formatReviewDate(date: Date | string): string {
  const iso = typeof date === 'string' ? date : date.toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
