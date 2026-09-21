import type { PartnerMap } from '../config/transfer-engine/types';
import { applyChanges } from './apply';
import { classifyChanges, diffTransferTable } from './diff';
import { parseAmexDePartners, parsePaybackMilesAndMore, TransferParseError } from './parsers';
import { findSeedKey, seedRows, SOURCE_URLS } from './seeds';
import type { CheckSummary, Observation, SourceProgramId, TransferCheck, TransferRepository } from './types';

export interface CheckDependencies {
  repository: TransferRepository;
  seeds: Record<SourceProgramId, PartnerMap>;
  fetchHtml: (url: string) => Promise<string>;
  sendMail: (check: TransferCheck) => Promise<void>;
  now: () => Date;
}

/**
 * Seed and check each source, preserving accepted truth on unsafe source changes.
 * @param deps - Explicit persistence, source, mail, seed, and clock dependencies.
 * @returns One result per source, including delivery failures without losing committed history.
 */
export async function runTransferTableCheck(deps: CheckDependencies): Promise<CheckSummary[]> {
  const summaries: CheckSummary[] = [];
  for (const source of ['amex_dach', 'payback'] as const) {
    await deps.repository.withSourceTransaction(source, async (tx) => {
      // History, rather than current rows, prevents resurrecting an intentionally removed source.
      if (!(await tx.hasHistory())) await tx.insertRates(seedRows(deps.seeds[source]), deps.now(), 'seed', null);
    });
    let observations: Observation[] = [];
    let sourceError: string | null = null;
    try {
      const html = await deps.fetchHtml(SOURCE_URLS[source]);
      observations = (source === 'amex_dach' ? parseAmexDePartners(html) : parsePaybackMilesAndMore(html)).map(
        (item) => ({ ...item, partnerKey: findSeedKey(item, deps.seeds[source]) }),
      );
      const keys = observations.flatMap((item) => (item.partnerKey ? [item.partnerKey] : []));
      if (new Set(keys).size !== keys.length) {
        throw new TransferParseError('Die Quelle enthält mehrere Einträge für denselben Partner.');
      }
    } catch (error) {
      sourceError = error instanceof Error ? error.message : 'Die Quelle konnte nicht gelesen werden.';
    }
    const check = await deps.repository.withSourceTransaction(source, async (tx) => {
      const checkedAt = deps.now();
      const changes = sourceError === null ? diffTransferTable(await tx.currentRows(), observations) : [];
      const classification = classifyChanges(changes);
      const outcome =
        sourceError !== null
          ? 'source_error'
          : classification === 'apply'
            ? 'applied'
            : classification === 'hold'
              ? 'held'
              : 'unchanged';
      // A fresh reading replaces an older open proposal; an unreadable source leaves it open.
      if (sourceError === null) await tx.supersedeOpenHeldChecks(checkedAt);
      const saved = await tx.insertCheck({ sourceProgramId: source, checkedAt, outcome, changes, error: sourceError });
      if (outcome === 'applied') await applyChanges(tx, changes, deps.seeds[source], checkedAt, saved.id);
      return saved;
    });
    const summary: CheckSummary = {
      sourceProgramId: source,
      checkId: check.id,
      outcome: check.outcome,
      changeCount: check.changes.length,
    };
    if (check.outcome !== 'unchanged') {
      try {
        await deps.sendMail(check);
      } catch {
        summary.mailError = 'Die Benachrichtigung konnte nicht versendet werden.';
      }
    }
    summaries.push(summary);
  }
  return summaries;
}
