import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHarness } from './test-support';
import { seedRows } from './seeds';
import { buildValuationTable } from './table';

test('concurrent initial seeding inserts exactly 25 rows and locks before reading', async () => {
  const { repository, state, calls, counts } = createHarness();
  await Promise.all([repository.ensureSeeded(state.now), repository.ensureSeeded(state.now)]);
  assert.equal(state.rows.length, 25);
  assert.equal(calls[0].query, 'SELECT pg_advisory_xact_lock(520053, 1)');
  assert.deepEqual(counts(), { commits: 2, rollbacks: 0 });
  const rows = await repository.loadCurrentRows();
  assert.equal(rows[0].centsPerUnit, 1.7);
  assert.equal(rows[0].sourceAsOf.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(rows[0].validFrom.toISOString(), state.now.toISOString());
  assert.ok(rows.every((row) => row.origin === 'seed' && row.createdBy === null));
});

test('replacement closes exactly one key and inserts an admin version in one transaction', async () => {
  const { repository, state, calls } = createHarness();
  await repository.ensureSeeded(state.now);
  const at = new Date('2026-10-01T12:00:00Z');
  const row = await repository.replaceRate({ ...seedRows()[0], centsPerUnit: 1.8, createdBy: 'admin-1' }, at);
  assert.equal(row.origin, 'admin');
  assert.equal(row.createdBy, 'admin-1');
  assert.equal(row.centsPerUnit, 1.8);
  assert.equal(state.rows.length, 26);
  const closed = state.rows.filter((item) => item.valid_to !== null);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].cents_per_unit, '1.700');
  assert.equal(closed[0].valid_to, at.toISOString());
  const rows = await repository.loadCurrentRows();
  assert.equal(rows.length, 25);
  assert.equal(buildValuationTable(rows, at).rateFor('lufthansa', 'travel')?.centsPerUnit, 1.8);
  const writes = calls.filter(
    (call) => call.query.startsWith('update') || (call.transaction === 2 && call.query.startsWith('insert')),
  );
  assert.equal(writes.length, 2);
  assert.ok(writes.every((call) => call.transaction === 2));
});

test('failed insertion after closing rolls back the old version', async () => {
  const { repository, state, counts } = createHarness();
  await repository.ensureSeeded(state.now);
  const before = structuredClone(state.rows);
  state.failInsert = true;
  await assert.rejects(repository.replaceRate({ ...seedRows()[0], centsPerUnit: 1.8 }, state.now));
  assert.deepEqual(state.rows, before);
  assert.equal(counts().rollbacks, 1);
});

test('large deviations require confirmation and compare against the locked current version', async () => {
  const { repository, state } = createHarness();
  await repository.ensureSeeded(state.now);
  await assert.rejects(repository.replaceRate({ ...seedRows()[0], centsPerUnit: 2.2 }, state.now), /2,2.*1,7/);
  assert.equal(state.rows.length, 25);
  await repository.replaceRate({ ...seedRows()[0], centsPerUnit: 2.2 }, state.now, { confirmDeviation: true });
  const results = await Promise.allSettled([
    repository.replaceRate({ ...seedRows()[0], centsPerUnit: 2.7 }, state.now),
    repository.replaceRate({ ...seedRows()[0], centsPerUnit: 1.7 }, state.now),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(
    (await repository.loadCurrentRows()).find(
      (row) => row.programId === 'lufthansa' && row.cabin === 'all' && row.anchor === 'travel',
    )?.centsPerUnit,
    2.7,
  );
});

test('historical presence prevents reseeding and transaction interfaces expose exact keys', async () => {
  const { repository, state } = createHarness();
  await repository.ensureSeeded(state.now);
  await repository.withTransaction(async (tx) => {
    assert.equal(await tx.hasHistory(), true);
    assert.equal((await tx.currentRows()).length, 25);
    assert.equal((await tx.currentRow(seedRows()[0]))?.centsPerUnit, 1.7);
    assert.equal(await tx.currentRow({ programId: 'ihg', anchor: 'travel', cabin: 'all' }), undefined);
    assert.deepEqual(await tx.insertRates([], state.now, 'admin'), []);
    for (const key of seedRows()) await tx.closeRate(key, state.now);
  });
  await repository.ensureSeeded(state.now);
  assert.equal(state.rows.length, 25);
  assert.deepEqual(await repository.loadCurrentRows(), []);
});

test('first write seeds before adding a registered programme and rejects unknown IDs', async () => {
  const { repository, state } = createHarness();
  await assert.rejects(
    repository.replaceRate({ ...seedRows()[0], programId: 'unknown' }, state.now),
    /Unbekanntes Programm/,
  );
  assert.equal(state.rows.length, 0);
  const result = await repository.replaceRate({ ...seedRows()[0], programId: 'ihg' }, state.now);
  assert.equal(result.programId, 'ihg');
  assert.equal(state.rows.length, 26);
});
