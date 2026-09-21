import { describeChange, OUTCOME_LABELS, SOURCE_LABELS } from './presentation';
import { findSeedKey, TRANSFER_SEEDS } from './seeds';
import type { TransferCheck } from './types';

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/**
 * Render a German source-check email with escaped source content.
 * @param check - Persisted result requiring administrator notification.
 * @returns HTML containing the result, all changes, and metadata instructions.
 */
export function renderTransferTableEmail(check: TransferCheck): string {
  const missingMetadata = check.changes.some(
    (change) =>
      change.type === 'partner_added' && !findSeedKey(change.observation, TRANSFER_SEEDS[check.sourceProgramId]),
  );
  return `<html lang="de"><body><h1>Transfertabelle: ${SOURCE_LABELS[check.sourceProgramId]}</h1>
    <p>${OUTCOME_LABELS[check.outcome]} · ${check.checkedAt.toISOString()}</p>
    ${check.outcome === 'held' ? '<p>Die Abweichungssperre ist aktiv. Die bisherigen Werte bleiben bis zur Freigabe gültig.</p>' : ''}
    ${check.error ? `<p>${escapeHtml(check.error)}</p>` : ''}
    <ul>${check.changes.map((change) => `<li>${escapeHtml(describeChange(change))}</li>`).join('')}</ul>
    ${missingMetadata ? '<p>Metadaten in dach.ts ergänzen. Danach kann die gesamte Prüfung übernommen werden.</p>' : ''}
    <p>Offene Prüfungen können im Admin-Dashboard übernommen oder verworfen werden.</p>
    <p>Prüfung: ${escapeHtml(check.id)}</p></body></html>`;
}
