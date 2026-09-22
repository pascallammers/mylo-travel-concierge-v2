import { getLoyaltyProgram } from '../loyalty/programs';
import { ANCHOR_LABELS, CABIN_LABELS, formatReviewDate, formatSourceMonth } from './presentation';
import type { RateKey, ResolvedRate } from './types';

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/**
 * Render one German reminder listing every overdue current valuation rate.
 * @param rates - Overdue resolved rates with their exact keys.
 * @returns Escaped HTML with source months, deadlines and renewal instructions.
 */
export function renderValuationStaleEmail(rates: readonly (ResolvedRate & RateKey)[]): string {
  const items = rates.map((rate) => {
    const name = getLoyaltyProgram(rate.programId)?.name ?? rate.programId;
    return `<li>${escapeHtml(`${name} · ${ANCHOR_LABELS[rate.anchor]} · ${CABIN_LABELS[rate.cabin]} · ${rate.centsPerUnit.toLocaleString('de-DE', { maximumFractionDigits: 3 })} ct/Punkt · Stand: ${formatSourceMonth(rate.sourceAsOf)} · fällig seit: ${formatReviewDate(rate.reviewDue)}`)}</li>`;
  });
  return `<html lang="de"><body><h1>Bewertungssätze: Überprüfung fällig</h1><ul>${items.join('')}</ul><p>Bitte die aufgeführten Werte im Admin-Dashboard prüfen und als neuen Bewertungssatz erneuern.</p></body></html>`;
}
