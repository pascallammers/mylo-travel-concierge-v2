import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyChanges } from './apply';
import { runTransferTableCheck } from './check';
import { diffTransferTable } from './diff';
import { parseAmexDePartners } from './parsers';
import { createHarness } from './test-support';

test('rate and terms changed together produce only one successor', async () => {
  const { deps, state, repository } = createHarness();
  await runTransferTableCheck(deps);
  await repository.withSourceTransaction('amex_dach', async (tx) => {
    const observations = parseAmexDePartners(state.amexHtml).map((row) =>
      row.partnerKey === 'flyingBlue' ? { ...row, sourcePoints: 2, partnerUnits: 1, minTransfer: 1000 } : row,
    );
    const changes = diffTransferTable(await tx.currentRows(), observations);
    assert.deepEqual(
      changes.map((change) => change.type),
      ['rate_changed', 'terms_changed'],
    );
    await applyChanges(tx, changes, deps.seeds.amex_dach, state.now, 'check');
  });
  assert.equal(state.rows.length, 16);
  assert.equal(state.rows.at(-1)?.minTransfer, 1000);
  assert.equal(state.rows.at(-1)?.sourcePoints, 2);
});

test('a failure after closing rates rolls back all history changes', async () => {
  const { deps, state, repository } = createHarness();
  await runTransferTableCheck(deps);
  const before = structuredClone(state.rows);
  await assert.rejects(
    repository.withSourceTransaction('amex_dach', async (tx) => {
      const observations = parseAmexDePartners(state.amexHtml).map((row) => ({
        ...row,
        minTransfer: row.minTransfer + 10,
      }));
      const changes = diffTransferTable(await tx.currentRows(), observations);
      await applyChanges(
        {
          ...tx,
          insertRates: async () => {
            throw new Error('write failed');
          },
        },
        changes,
        deps.seeds.amex_dach,
        state.now,
        'check',
      );
    }),
    /write failed/,
  );
  assert.deepEqual(state.rows, before);
});
