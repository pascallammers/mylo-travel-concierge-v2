import type { CurrentRate, Observation, RateValues, TransferChange } from './types';

export const MAX_RELATIVE_RATE_DEVIATION = 0.25;

/**
 * Select only the accepted, comparable values from a row.
 * @param row - Current rate or version.
 * @returns A stable before/after snapshot.
 */
export function rateValues(row: RateValues): RateValues {
  return {
    sourcePoints: row.sourcePoints,
    partnerUnits: row.partnerUnits,
    minTransfer: row.minTransfer,
    transferIncrement: row.transferIncrement,
    transferDurationDe: row.transferDurationDe,
  };
}

/**
 * Compare one source's complete observations with its accepted rows.
 * @param currentRows - Current accepted rows for one source.
 * @param observations - Complete parsed source observations.
 * @returns Typed changes; absent PAYBACK terms retain their accepted values.
 */
export function diffTransferTable(currentRows: CurrentRate[], observations: Observation[]): TransferChange[] {
  const changes: TransferChange[] = [];
  for (const row of currentRows) {
    if (!observations.some((item) => item.partnerKey === row.partnerKey)) {
      changes.push({ type: 'partner_removed', partnerKey: row.partnerKey, before: rateValues(row) });
    }
  }
  for (const observation of observations) {
    const row = currentRows.find((item) => item.partnerKey === observation.partnerKey);
    if (!row) {
      changes.push({ type: 'partner_added', partnerKey: observation.partnerKey, observation });
      continue;
    }
    const before = rateValues(row);
    const after: RateValues = {
      sourcePoints: observation.sourcePoints,
      partnerUnits: observation.partnerUnits,
      minTransfer: observation.minTransfer,
      transferIncrement: observation.transferIncrement ?? row.transferIncrement,
      transferDurationDe: observation.transferDurationDe ?? row.transferDurationDe,
    };
    if (before.sourcePoints !== after.sourcePoints || before.partnerUnits !== after.partnerUnits) {
      changes.push({ type: 'rate_changed', partnerKey: row.partnerKey, before, after });
    }
    if (
      before.minTransfer !== after.minTransfer ||
      before.transferIncrement !== after.transferIncrement ||
      before.transferDurationDe !== after.transferDurationDe
    ) {
      changes.push({ type: 'terms_changed', partnerKey: row.partnerKey, before, after });
    }
  }
  return changes;
}

/**
 * Apply the deviation lock to the entire source check.
 * @param changes - Proposed changes for one source.
 * @returns Whether to log, apply atomically, or hold for approval.
 */
export function classifyChanges(changes: TransferChange[]): 'unchanged' | 'apply' | 'hold' {
  if (!changes.length) return 'unchanged';
  return changes.some((change) => {
    if (change.type === 'partner_added' || change.type === 'partner_removed') return true;
    if (change.type !== 'rate_changed') return false;
    const beforeScaled = change.before.partnerUnits * change.after.sourcePoints;
    const afterScaled = change.after.partnerUnits * change.before.sourcePoints;
    return Math.abs(afterScaled - beforeScaled) > MAX_RELATIVE_RATE_DEVIATION * beforeScaled;
  })
    ? 'hold'
    : 'apply';
}
