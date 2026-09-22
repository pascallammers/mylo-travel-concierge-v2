import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { createValuationRepository } from './repository';

interface FakeClient {
  options: { parsers: Record<string, never>; serializers: Record<string, never> };
  unsafe(query: string, params: unknown[]): Promise<unknown[][]> & { values: () => Promise<unknown[][]> };
  begin<T>(callback: (connection: FakeClient) => Promise<T>): Promise<T>;
}

interface StoredRow {
  [column: string]: unknown;
}

/**
 * Exercise real Drizzle queries against an isolated transactional driver fake.
 * @returns Repository, recorded SQL, mutable row state and transaction counters.
 */
export function createHarness() {
  const state = { rows: [] as StoredRow[], failInsert: false, now: new Date('2026-09-22T12:00:00Z') };
  const calls: { query: string; params: unknown[]; transaction: number }[] = [];
  let transaction = 0;
  let commits = 0;
  let rollbacks = 0;
  let pending = Promise.resolve();
  const matches = (query: string, params: unknown[], row: StoredRow) => {
    if (query.includes('"valid_to" is null') && row.valid_to !== null) return false;
    for (const column of ['program_id', 'anchor', 'cabin']) {
      const match = query.match(new RegExp(`"valuation_rates"\\."${column}" = \\$(\\d+)`));
      if (match && row[column] !== params[Number(match[1]) - 1]) return false;
    }
    return true;
  };
  const project = (rows: StoredRow[], columns: string) =>
    rows.map((row) => columns.split(',').map((column) => row[column.trim().replaceAll('"', '')]));
  const execute = (query: string, params: unknown[]): unknown[][] => {
    calls.push({ query, params, transaction });
    if (query.startsWith('insert')) {
      if (state.failInsert) throw new Error('Simulierter Schreibfehler');
      const parsed = query.match(/insert into "valuation_rates" \((.*?)\) values (.*?) returning (.*)$/)!;
      const columns = parsed[1].split(',').map((column) => column.trim().replaceAll('"', ''));
      const rows = [...parsed[2].matchAll(/\(([^()]+)\)/g)].map((tuple) => {
        const row: StoredRow = {};
        tuple[1].split(',').forEach((value, index) => {
          const placeholder = value.trim().match(/^\$(\d+)$/);
          row[columns[index]] = placeholder
            ? params[Number(placeholder[1]) - 1]
            : columns[index] === 'id'
              ? randomUUID()
              : null;
        });
        if (
          state.rows.some(
            (existing) =>
              existing.valid_to === null &&
              ['program_id', 'anchor', 'cabin'].every((key) => existing[key] === row[key]),
          )
        ) {
          throw new Error('Duplicate current row');
        }
        state.rows.push(row);
        return row;
      });
      return project(rows, parsed[3]);
    }
    if (query.startsWith('update')) {
      for (const row of state.rows.filter((row) => matches(query, params, row))) row.valid_to = params[0];
      return [];
    }
    if (query.startsWith('select')) {
      const fields = query.match(/^select (.*?) from/)![1];
      const rows = state.rows.filter((row) => matches(query, params, row));
      return project(query.includes('limit') ? rows.slice(0, 1) : rows, fields);
    }
    return [];
  };
  const client: FakeClient = {
    options: { parsers: {}, serializers: {} },
    unsafe(query: string, params: unknown[]) {
      const result = Promise.resolve().then(() => execute(query, params));
      return Object.assign(result, { values: () => result });
    },
    async begin<T>(callback: (connection: FakeClient) => Promise<T>): Promise<T> {
      const predecessor = pending;
      let release = () => {};
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      transaction++;
      const backup = structuredClone(state.rows);
      try {
        const result = await callback(client);
        commits++;
        return result;
      } catch (error) {
        state.rows = backup;
        rollbacks++;
        throw error;
      } finally {
        release();
      }
    },
  };
  return {
    state,
    calls,
    counts: () => ({ commits, rollbacks }),
    repository: createValuationRepository(drizzle(client as unknown as Sql)),
  };
}
