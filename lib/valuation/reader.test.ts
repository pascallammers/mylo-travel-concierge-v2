import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadValuationTable } from './reader';
import { createHarness } from './test-support';
import { seedRows } from './seeds';

test('reader loads accepted values without restoring omitted seed rows', async () => {
  const { repository, state } = createHarness();
  await repository.ensureSeeded(state.now);
  await repository.replaceRate({ ...seedRows()[0], centsPerUnit: 1.8 }, state.now);
  await repository.withTransaction((tx) => tx.closeRate(seedRows()[1], state.now));
  const table = await loadValuationTable({
    loadCurrentRows: repository.loadCurrentRows,
    now: () => state.now,
    warn: () => assert.fail('unexpected fallback'),
  });
  assert.equal(table.rateFor('lufthansa', 'travel')?.centsPerUnit, 1.8);
  assert.equal(table.rateFor('amex-mr', 'travel'), undefined);
});

test('empty and unreachable database return dated seeds and one German warning', async () => {
  for (const loadCurrentRows of [
    async () => [],
    async () => {
      throw new Error('private driver details');
    },
  ]) {
    const warnings: string[] = [];
    const table = await loadValuationTable({
      loadCurrentRows,
      now: () => new Date('2028-01-01'),
      warn: (message) => warnings.push(message),
    });
    assert.equal(table.programIds().length, 18);
    assert.equal(table.tableAsOf, '2026-09');
    assert.equal(table.staleRates().length, 25);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^Bewertungstabelle: .*Seed wird verwendet\.$/);
    assert.ok(!warnings[0].includes('private'));
  }
});
