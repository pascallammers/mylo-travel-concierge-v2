import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { transferRates, transferTableChecks } from './schema';
import { SUPERSEDED_BY_NEWER_CHECK } from './types';
import type { SourceProgramId, SourceTransaction, TransferRepository } from './types';

/**
 * Create transactional transfer-table persistence without opening a connection.
 * @param database - Cache-free Drizzle database supporting interactive transactions.
 * @returns Repository serializing all writes for each source.
 */
export function createTransferTableRepository(database: PostgresJsDatabase): TransferRepository {
  const getCheck = async (id: string) =>
    (await database.select().from(transferTableChecks).where(eq(transferTableChecks.id, id)).limit(1))[0];
  return {
    getCheck,
    withSourceTransaction: (source, work) =>
      database.transaction(async (tx) => {
        // A source-scoped advisory lock also protects the empty-table first seed.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(520052, ${source === 'amex_dach' ? 1 : 2})`);
        const sourceFilter = eq(transferRates.sourceProgramId, source);
        const currentFilter = and(sourceFilter, isNull(transferRates.validTo));
        const access: SourceTransaction = {
          hasHistory: async () =>
            (await tx.select({ id: transferRates.id }).from(transferRates).where(sourceFilter).limit(1)).length > 0,
          currentRows: () => tx.select().from(transferRates).where(currentFilter),
          insertRates: async (rows, at, origin, checkId) => {
            if (rows.length)
              await tx
                .insert(transferRates)
                .values(rows.map((row) => ({ ...row, sourceProgramId: source, validFrom: at, origin, checkId })));
          },
          closeRates: async (keys, at) => {
            if (keys.length)
              await tx
                .update(transferRates)
                .set({ validTo: at })
                .where(and(currentFilter, inArray(transferRates.partnerKey, keys)));
          },
          insertCheck: async (check) => (await tx.insert(transferTableChecks).values(check).returning())[0],
          getCheck: async (id) =>
            (
              await tx
                .select()
                .from(transferTableChecks)
                .where(and(eq(transferTableChecks.id, id), eq(transferTableChecks.sourceProgramId, source)))
                .limit(1)
            )[0],
          resolveCheck: async (id, resolution, at, adminUserId) => {
            await tx
              .update(transferTableChecks)
              .set({ resolution, resolvedAt: at, resolvedBy: adminUserId })
              .where(and(eq(transferTableChecks.id, id), eq(transferTableChecks.sourceProgramId, source)));
          },
          supersedeOpenHeldChecks: async (at) => {
            await tx
              .update(transferTableChecks)
              .set({ resolution: 'rejected', resolvedAt: at, resolvedBy: SUPERSEDED_BY_NEWER_CHECK })
              .where(
                and(
                  eq(transferTableChecks.sourceProgramId, source),
                  eq(transferTableChecks.outcome, 'held'),
                  isNull(transferTableChecks.resolution),
                ),
              );
          },
        };
        return work(access);
      }),
    loadSnapshot: () =>
      database.transaction(
        async (tx) => ({
          rows: await tx.select().from(transferRates).where(isNull(transferRates.validTo)),
          // One verified check per source: the table date is only as fresh as its stalest source.
          checks: (
            await Promise.all(
              (['amex_dach', 'payback'] as SourceProgramId[]).map((source) =>
                tx
                  .select()
                  .from(transferTableChecks)
                  .where(
                    and(
                      eq(transferTableChecks.sourceProgramId, source),
                      or(
                        inArray(transferTableChecks.outcome, ['unchanged', 'applied']),
                        and(eq(transferTableChecks.outcome, 'held'), eq(transferTableChecks.resolution, 'approved')),
                      ),
                    ),
                  )
                  .orderBy(desc(transferTableChecks.checkedAt))
                  .limit(1),
              ),
            )
          ).flat(),
        }),
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
      ),
    loadDashboard: async () => {
      const latest = await Promise.all(
        (['amex_dach', 'payback'] as SourceProgramId[]).map(
          async (source) =>
            (
              await database
                .select()
                .from(transferTableChecks)
                .where(eq(transferTableChecks.sourceProgramId, source))
                .orderBy(desc(transferTableChecks.checkedAt))
                .limit(1)
            )[0],
        ),
      );
      const held = await database
        .select()
        .from(transferTableChecks)
        .where(and(eq(transferTableChecks.outcome, 'held'), isNull(transferTableChecks.resolution)))
        .orderBy(desc(transferTableChecks.checkedAt));
      return { latest: latest.filter((check) => check !== undefined), held };
    },
  };
}
