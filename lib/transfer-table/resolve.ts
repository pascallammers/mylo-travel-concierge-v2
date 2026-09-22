import type { PartnerMap } from '../config/transfer-engine/types';
import { applyChanges, TransferConflictError } from './apply';
import type { Resolution, SourceProgramId, TransferRepository } from './types';

export interface ResolutionDependencies {
  repository: TransferRepository;
  seeds: Record<SourceProgramId, PartnerMap>;
  now: () => Date;
}

/**
 * Resolve a held check, atomically refusing approvals whose before values drifted.
 * @param checkId - Held check identifier.
 * @param resolution - Administrator's decision.
 * @param adminUserId - Authenticated administrator, never supplied by the request body.
 * @param deps - Repository, seed metadata, and clock.
 * @returns Completion once history and resolution have committed together.
 */
export async function resolveHeldCheck(
  checkId: string,
  resolution: Resolution,
  adminUserId: string,
  deps: ResolutionDependencies,
): Promise<void> {
  const initial = await deps.repository.getCheck(checkId);
  if (!initial) throw new TransferConflictError('Die Prüfung wurde nicht gefunden.');
  await deps.repository.withSourceTransaction(initial.sourceProgramId, async (tx) => {
    const check = await tx.getCheck(checkId);
    if (!check || check.outcome !== 'held' || check.resolution !== null) {
      throw new TransferConflictError('Diese Prüfung ist nicht mehr zur Freigabe offen.');
    }
    const at = deps.now();
    if (resolution === 'approved')
      await applyChanges(tx, check.changes, deps.seeds[check.sourceProgramId], at, check.id);
    await tx.resolveCheck(check.id, resolution, at, adminUserId);
  });
}
