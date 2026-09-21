import type { TransferChange } from './types';

export const SOURCE_LABELS = { amex_dach: 'Amex Deutschland', payback: 'PAYBACK' } as const;
export const OUTCOME_LABELS = {
  unchanged: 'Unverändert',
  applied: 'Übernommen',
  held: 'Freigabe nötig',
  source_error: 'Quellenfehler',
} as const;

/**
 * Describe a stored change consistently in the admin card and email.
 * @param change - Typed source change.
 * @returns German before/after description.
 */
export function describeChange(change: TransferChange): string {
  if (change.type === 'partner_added') {
    const item = change.observation;
    return `Neuer Partner: ${item.sourceName} – ${item.sourcePoints}:${item.partnerUnits}, Mindesttransfer ${item.minTransfer}, Schritt ${item.transferIncrement ?? 'nicht angegeben'}, Dauer ${item.transferDurationDe ?? 'nicht angegeben'}.`;
  }
  if (change.type === 'partner_removed') return `${change.partnerKey}: Partner entfernt.`;
  if (change.type === 'rate_changed')
    return `${change.partnerKey}: Verhältnis ${change.before.sourcePoints}:${change.before.partnerUnits} → ${change.after.sourcePoints}:${change.after.partnerUnits}.`;
  const { before, after } = change;
  return `${change.partnerKey}: Mindesttransfer ${before.minTransfer} → ${after.minTransfer}, Schritt ${before.transferIncrement} → ${after.transferIncrement}, Dauer „${before.transferDurationDe}“ → „${after.transferDurationDe}“.`;
}
