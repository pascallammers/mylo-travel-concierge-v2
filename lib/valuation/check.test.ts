import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runValuationTableCheck } from './check';
import { createHarness } from './test-support';
import { seedRows } from './seeds';
import type { RateKey, ResolvedRate } from './types';

test('check seeds once and sends exactly one reminder containing every overdue row', async () => {
  const { repository, state } = createHarness();
  const mails: (ResolvedRate & RateKey)[][] = [];
  const deps = {
    repository,
    now: () => state.now,
    sendMail: async (rows: (ResolvedRate & RateKey)[]) => {
      mails.push(rows);
    },
  };
  assert.deepEqual(await runValuationTableCheck(deps), { stale: 0, tableAsOf: '2026-09' });
  await runValuationTableCheck(deps);
  assert.equal(state.rows.length, 25);
  assert.equal(mails.length, 0);
  await repository.replaceRate({ ...seedRows()[0], reviewDue: new Date('2026-09-01') }, state.now);
  await repository.replaceRate({ ...seedRows()[22], reviewDue: new Date('2026-09-01') }, state.now);
  assert.deepEqual(await runValuationTableCheck(deps), { stale: 2, tableAsOf: '2026-09' });
  assert.equal(mails.length, 1);
  assert.equal(mails[0].length, 2);
});

test('check propagates persistence and mail failures without claiming success', async () => {
  const { repository, state } = createHarness();
  await assert.rejects(
    runValuationTableCheck({
      repository,
      now: () => new Date('2028-01-01'),
      sendMail: async () => {
        throw new Error('mail failed');
      },
    }),
    /mail failed/,
  );
  state.failInsert = true;
  state.rows = [];
  await assert.rejects(
    runValuationTableCheck({
      repository,
      now: () => state.now,
      sendMail: async () => assert.fail('no mail on DB failure'),
    }),
  );
});
