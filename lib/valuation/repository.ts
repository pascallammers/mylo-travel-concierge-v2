import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getLoyaltyProgram } from '../loyalty/programs';
import { assertRateDeviation } from './deviation';
import { valuationRates } from './schema';
import { seedRows } from './seeds';
import type { NewRate, RateKey, RateVersion, ValuationRepository, ValuationTransaction } from './types';

const currentFilter = isNull(valuationRates.validTo);
const keyFilter = (key: RateKey) =>
  and(
    currentFilter,
    eq(valuationRates.programId, key.programId),
    eq(valuationRates.anchor, key.anchor),
    eq(valuationRates.cabin, key.cabin),
  );
const toVersion = (row: typeof valuationRates.$inferSelect): RateVersion => ({
  ...row,
  centsPerUnit: Number(row.centsPerUnit),
});

function validateRate(row: NewRate): void {
  if (!getLoyaltyProgram(row.programId)) throw new Error(`Unbekanntes Programm: ${row.programId}`);
}

/**
 * Create versioned valuation persistence with serialized, atomic replacements.
 * @param database - Cache-free Drizzle database supporting interactive transactions.
 * @returns Repository with numeric-to-number conversion at its read boundary.
 */
export function createValuationRepository(database: PostgresJsDatabase): ValuationRepository {
  const withTransaction: ValuationRepository['withTransaction'] = (work) =>
    database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(520053, 1)`);
      const access: ValuationTransaction = {
        hasHistory: async () => (await tx.select({ id: valuationRates.id }).from(valuationRates).limit(1)).length > 0,
        currentRows: async () => (await tx.select().from(valuationRates).where(currentFilter)).map(toVersion),
        currentRow: async (key) => {
          const row = (await tx.select().from(valuationRates).where(keyFilter(key)).limit(1))[0];
          return row ? toVersion(row) : undefined;
        },
        insertRates: async (rows, at, origin) => {
          rows.forEach(validateRate);
          if (!rows.length) return [];
          return (
            await tx
              .insert(valuationRates)
              .values(rows.map((row) => ({ ...row, centsPerUnit: row.centsPerUnit.toFixed(3), validFrom: at, origin })))
              .returning()
          ).map(toVersion);
        },
        closeRate: async (key, at) => {
          await tx.update(valuationRates).set({ validTo: at }).where(keyFilter(key));
        },
      };
      return work(access);
    });
  return {
    withTransaction,
    loadCurrentRows: async () => (await database.select().from(valuationRates).where(currentFilter)).map(toVersion),
    ensureSeeded: (now) =>
      withTransaction(async (tx) => {
        if (!(await tx.hasHistory())) await tx.insertRates(seedRows(), now, 'seed');
      }),
    replaceRate: (newRate, now, options) =>
      withTransaction(async (tx) => {
        validateRate(newRate);
        // The first POST must preserve the full allowlist even before an administrator visits GET.
        if (!(await tx.hasHistory())) await tx.insertRates(seedRows(), now, 'seed');
        const current = await tx.currentRow(newRate);
        assertRateDeviation(current?.centsPerUnit, newRate.centsPerUnit, options?.confirmDeviation);
        await tx.closeRate(newRate, now);
        return (await tx.insertRates([newRate], now, 'admin'))[0];
      }),
  };
}
