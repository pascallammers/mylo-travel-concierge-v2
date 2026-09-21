import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { createTransferTableRepository } from './repository';
import { seedRows, TRANSFER_SEEDS } from './seeds';

function fakeDatabase() {
  const calls: { query: string; params: unknown[]; transaction: number }[] = [];
  let transaction = 0;
  let commits = 0;
  let rollbacks = 0;
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(query: string, params: unknown[]) {
      calls.push({ query, params, transaction });
      const rows: unknown[][] = query.startsWith('insert into "transfer_table_checks"')
        ? [
            [
              '00000000-0000-4000-8000-000000000001',
              'amex_dach',
              '2026-10-02T05:00:00Z',
              'unchanged',
              [],
              null,
              null,
              null,
              null,
            ],
          ]
        : [];
      return Object.assign(Promise.resolve(rows), { values: () => Promise.resolve(rows) });
    },
    async begin<T>(callback: (connection: typeof client) => Promise<T>): Promise<T> {
      transaction++;
      try {
        const result = await callback(client);
        commits++;
        return result;
      } catch (error) {
        rollbacks++;
        throw error;
      }
    },
  };
  return {
    repository: createTransferTableRepository(drizzle(client as unknown as Sql)),
    calls,
    counts: () => ({ commits, rollbacks }),
  };
}

test('repository locks before reading and writes versions and check within the same transaction', async () => {
  const { repository, calls, counts } = fakeDatabase();
  const at = new Date('2026-10-02T05:00:00Z');
  await repository.withSourceTransaction('amex_dach', async (tx) => {
    assert.equal(await tx.hasHistory(), false);
    assert.deepEqual(await tx.currentRows(), []);
    const check = await tx.insertCheck({
      sourceProgramId: 'amex_dach',
      checkedAt: at,
      outcome: 'unchanged',
      changes: [],
      error: null,
    });
    assert.equal(check.checkedAt.toISOString(), at.toISOString());
    await tx.closeRates(['flyingBlue'], at);
    await tx.insertRates(seedRows(TRANSFER_SEEDS.amex_dach).slice(0, 1), at, 'check', check.id);
    await tx.getCheck(check.id);
    await tx.resolveCheck(check.id, 'approved', at, 'admin-id');
  });
  assert.match(calls[0].query, /pg_advisory_xact_lock/);
  assert.deepEqual(calls[0].params, [1]);
  assert.ok(calls.every((call) => call.transaction === 1));
  const close = calls.find((call) => call.query.startsWith('update "transfer_rates"'))!;
  assert.match(close.query, /set "valid_to" = \$1/);
  assert.match(close.query, /"valid_to" is null/);
  assert.ok(close.params.includes('amex_dach'));
  assert.ok(close.params.includes('flyingBlue'));
  assert.deepEqual(counts(), { commits: 1, rollbacks: 0 });
});

test('repository propagates failures to transaction rollback and skips empty mutations', async () => {
  const { repository, calls, counts } = fakeDatabase();
  await assert.rejects(
    repository.withSourceTransaction('payback', async (tx) => {
      await tx.closeRates([], new Date());
      await tx.insertRates([], new Date(), 'seed', null);
      throw new Error('conflict');
    }),
    /conflict/,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [2]);
  assert.deepEqual(counts(), { commits: 0, rollbacks: 1 });
});

test('reader snapshot uses repeatable read and only accepted freshness checks', async () => {
  const { repository, calls } = fakeDatabase();
  assert.deepEqual(await repository.loadSnapshot(), { rows: [], checks: [] });
  assert.match(calls[0].query, /repeatable read read only/);
  assert.match(calls[1].query, /"valid_to" is null/);
  assert.deepEqual(calls[2].params, ['amex_dach', 'unchanged', 'applied', 'held', 'approved', 1]);
  assert.deepEqual(calls[3].params, ['payback', 'unchanged', 'applied', 'held', 'approved', 1]);
  assert.match(calls[2].query, /order by .*"checked_at" desc/);
});

test('dashboard loads one latest check per source and unresolved holds', async () => {
  const { repository, calls } = fakeDatabase();
  assert.deepEqual(await repository.loadDashboard(), { latest: [], held: [] });
  assert.deepEqual(calls[0].params, ['amex_dach', 1]);
  assert.deepEqual(calls[1].params, ['payback', 1]);
  assert.match(calls[2].query, /"resolution" is null/);
  assert.deepEqual(calls[2].params, ['held']);
  await repository.getCheck('00000000-0000-4000-8000-000000000001');
  assert.equal(calls.at(-1)?.params[0], '00000000-0000-4000-8000-000000000001');
});
