import { DACH_TRANSFER_TABLE_AS_OF } from '../config/transfer-engine/dach';
import type { PartnerMap } from '../config/transfer-engine/types';
import { TRANSFER_SEEDS } from './seeds';
import type { TransferRepository } from './types';

export interface DachPartnerMaps {
  amex: PartnerMap;
  payback: PartnerMap;
  tableAsOf: string;
}

export interface ReaderDependencies {
  loadSnapshot: TransferRepository['loadSnapshot'];
  warn: (message: string) => void;
}

/**
 * Overlay accepted DB values while retaining seed metadata and English descriptions.
 * @param deps - Snapshot loader and warning logger.
 * @returns Both DACH maps and the month of the latest successful source check.
 */
export async function loadDachPartnerMaps(deps: ReaderDependencies): Promise<DachPartnerMaps> {
  const result: DachPartnerMaps = {
    amex: TRANSFER_SEEDS.amex_dach,
    payback: TRANSFER_SEEDS.payback,
    tableAsOf: DACH_TRANSFER_TABLE_AS_OF,
  };
  try {
    const { rows, checks } = await deps.loadSnapshot();
    for (const source of ['amex_dach', 'payback'] as const) {
      const current = rows.filter((row) => row.sourceProgramId === source && row.validTo === null);
      if (!current.length) {
        deps.warn(`Transfertabelle ${source}: Keine aktuellen Daten; Seed wird verwendet.`);
        continue;
      }
      const map: PartnerMap = {};
      for (const row of current) {
        const seed = TRANSFER_SEEDS[source][row.partnerKey];
        if (!seed) {
          deps.warn(`Transfertabelle ${source}: Metadaten in dach.ts ergänzen (${row.partnerKey}).`);
          continue;
        }
        map[row.partnerKey] = {
          ...seed,
          amexPoints: row.sourcePoints,
          partnerMiles: row.partnerUnits,
          effectiveRate: Math.round((row.partnerUnits / row.sourcePoints) * 1000) / 10,
          minTransfer: row.minTransfer,
          transferIncrement: row.transferIncrement,
          transferDuration: { ...seed.transferDuration, de: row.transferDurationDe },
        };
      }
      result[source === 'amex_dach' ? 'amex' : 'payback'] = map;
    }
    const verified = (['amex_dach', 'payback'] as const).map(
      (source) =>
        checks
          .filter(
            (check) =>
              check.sourceProgramId === source &&
              (check.outcome === 'unchanged' ||
                check.outcome === 'applied' ||
                (check.outcome === 'held' && check.resolution === 'approved')),
          )
          .sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())[0],
    );
    // The table date is only as fresh as its stalest source.
    if (verified.every((check) => check !== undefined)) {
      const stalest = Math.min(...verified.map((check) => check.checkedAt.getTime()));
      result.tableAsOf = new Date(stalest).toISOString().slice(0, 7);
    }
  } catch {
    deps.warn('Transfertabelle: Datenbank nicht verfügbar; Seed wird verwendet.');
  }
  return result;
}
