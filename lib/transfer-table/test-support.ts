import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { TRANSFER_SEEDS } from './seeds';
import { SUPERSEDED_BY_NEWER_CHECK } from './types';
import type { CheckDependencies } from './check';
import type { RateVersion, SourceTransaction, TransferCheck, TransferRepository } from './types';

export const amexHtml = readFileSync(new URL('./__fixtures__/amex-de.html', import.meta.url), 'utf8');
export const paybackHtml = readFileSync(new URL('./__fixtures__/payback.html', import.meta.url), 'utf8');

/**
 * Create isolated transactional fakes without opening a database or sending mail.
 * @returns Controllable persistence, HTML sources, clock, and captured mail.
 */
export function createHarness() {
  const state = {
    rows: [] as RateVersion[],
    checks: [] as TransferCheck[],
    mails: [] as TransferCheck[],
    failures: [] as { source: string; message: string }[],
    failPersistenceFor: null as string | null,
    amexHtml,
    paybackHtml,
    now: new Date('2026-10-02T05:00:00Z'),
    failSource: false,
    failMail: false,
  };
  let pending = Promise.resolve();
  const repository: TransferRepository = {
    async withSourceTransaction(source, work) {
      if (state.failPersistenceFor === source) throw new Error('Datenbank nicht erreichbar.');
      const predecessor = pending;
      let release = () => {};
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const backup = structuredClone({ rows: state.rows, checks: state.checks });
      const tx: SourceTransaction = {
        hasHistory: async () => state.rows.some((row) => row.sourceProgramId === source),
        currentRows: async () =>
          structuredClone(state.rows.filter((row) => row.sourceProgramId === source && row.validTo === null)),
        insertRates: async (rows, at, origin, checkId) => {
          for (const row of rows) {
            if (
              state.rows.some(
                (existing) =>
                  existing.sourceProgramId === source &&
                  existing.partnerKey === row.partnerKey &&
                  existing.validTo === null,
              )
            )
              throw new Error('Duplicate current row');
            state.rows.push({
              ...row,
              id: randomUUID(),
              sourceProgramId: source,
              validFrom: at,
              validTo: null,
              origin,
              checkId,
            });
          }
        },
        closeRates: async (keys, at) => {
          state.rows.forEach((row) => {
            if (row.sourceProgramId === source && row.validTo === null && keys.includes(row.partnerKey))
              row.validTo = at;
          });
        },
        insertCheck: async (check) => {
          const row: TransferCheck = {
            ...check,
            id: randomUUID(),
            resolution: null,
            resolvedAt: null,
            resolvedBy: null,
          };
          state.checks.push(row);
          return row;
        },
        getCheck: async (id) => state.checks.find((check) => check.id === id && check.sourceProgramId === source),
        resolveCheck: async (id, resolution, at, adminUserId) => {
          Object.assign(state.checks.find((check) => check.id === id)!, {
            resolution,
            resolvedAt: at,
            resolvedBy: adminUserId,
          });
        },
        supersedeOpenHeldChecks: async (at) => {
          for (const check of state.checks) {
            if (check.sourceProgramId === source && check.outcome === 'held' && check.resolution === null) {
              Object.assign(check, { resolution: 'rejected', resolvedAt: at, resolvedBy: SUPERSEDED_BY_NEWER_CHECK });
            }
          }
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        state.rows = backup.rows;
        state.checks = backup.checks;
        throw error;
      } finally {
        release();
      }
    },
    getCheck: async (id) => state.checks.find((check) => check.id === id),
    loadSnapshot: async () =>
      structuredClone({ rows: state.rows.filter((row) => row.validTo === null), checks: state.checks }),
    loadDashboard: async () => ({
      latest: (['amex_dach', 'payback'] as const).flatMap((source) =>
        state.checks.filter((check) => check.sourceProgramId === source).slice(-1),
      ),
      held: state.checks.filter((check) => check.outcome === 'held' && check.resolution === null),
    }),
  };
  const deps: CheckDependencies = {
    repository,
    seeds: TRANSFER_SEEDS,
    now: () => state.now,
    fetchHtml: async (url) => {
      if (state.failSource) throw new Error('Quelle nicht erreichbar.');
      return url.includes('americanexpress') ? state.amexHtml : state.paybackHtml;
    },
    reportFailure: async (source, message) => {
      state.failures.push({ source, message });
    },
    sendMail: async (check) => {
      if (state.failMail) throw new Error('Mail nicht verfügbar.');
      state.mails.push(check);
    },
  };
  return { state, repository, deps };
}
