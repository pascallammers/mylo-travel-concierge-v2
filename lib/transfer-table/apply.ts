import type { PartnerMap } from '../config/transfer-engine/types';
import { rateValues } from './diff';
import { findSeedKey, seedRows } from './seeds';
import type { CurrentRate, RateValues, SourceTransaction, TransferChange } from './types';

/** A held check is stale, already resolved, or lacks metadata. */
export class TransferConflictError extends Error {
  /**
   * Explain why a saved check cannot be resolved safely.
   * @param message - German conflict explanation.
   * @returns A conflict error suitable for an HTTP 409 response.
   */
  constructor(message: string) {
    super(message);
    this.name = 'TransferConflictError';
  }
}

function equalValues(a: RateValues, b: RateValues): boolean {
  return Object.entries(rateValues(a)).every(([key, value]) => b[key as keyof RateValues] === value);
}

/**
 * Validate the full before state and create one successor per changed partner.
 * @param tx - Locked source transaction.
 * @param changes - Stored or freshly calculated changes.
 * @param partners - Metadata used to validate additions.
 * @param at - Effective change time.
 * @param checkId - Check owning the new history rows.
 * @returns Completion after closing old and inserting new rows in the transaction.
 */
export async function applyChanges(
  tx: SourceTransaction,
  changes: TransferChange[],
  partners: PartnerMap,
  at: Date,
  checkId: string,
): Promise<void> {
  const current = await tx.currentRows();
  const successors = new Map<string, CurrentRate>();
  const closeKeys = new Set<string>();
  for (const change of changes) {
    if (change.type === 'partner_added') {
      const key = findSeedKey(change.observation, partners);
      if (!key) throw new TransferConflictError(`Metadaten in dach.ts ergänzen: ${change.observation.sourceName}.`);
      if (current.some((row) => row.partnerKey === key))
        throw new TransferConflictError('Die Transfertabelle hat sich inzwischen geändert. Bitte erneut prüfen.');
      const seed = seedRows(partners).find((row) => row.partnerKey === key)!;
      successors.set(key, {
        partnerKey: key,
        sourcePoints: change.observation.sourcePoints,
        partnerUnits: change.observation.partnerUnits,
        minTransfer: change.observation.minTransfer,
        transferIncrement: change.observation.transferIncrement ?? seed.transferIncrement,
        transferDurationDe: change.observation.transferDurationDe ?? seed.transferDurationDe,
      });
      continue;
    }
    const row = current.find((item) => item.partnerKey === change.partnerKey);
    if (!row || !equalValues(row, change.before)) {
      throw new TransferConflictError(
        `Die Werte für ${change.partnerKey} haben sich inzwischen geändert. Bitte erneut prüfen.`,
      );
    }
    closeKeys.add(change.partnerKey);
    if (change.type !== 'partner_removed')
      successors.set(change.partnerKey, { partnerKey: change.partnerKey, ...change.after });
  }
  await tx.closeRates([...closeKeys], at);
  await tx.insertRates([...successors.values()], at, 'check', checkId);
}
