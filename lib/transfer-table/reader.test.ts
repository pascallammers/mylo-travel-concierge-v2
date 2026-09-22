import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDachPartnerMaps } from './reader';
import { runTransferTableCheck } from './check';
import { createHarness } from './test-support';
import { TRANSFER_SEEDS } from './seeds';
import { DACH_TRANSFER_TABLE_AS_OF } from '../config/transfer-engine/dach';

test('overlay retains metadata, recalculates rate, and omits removed partners', async () => {
  const { deps, state, repository } = createHarness();
  await runTransferTableCheck(deps);
  const flyingBlue = state.rows.find((row) => row.partnerKey === 'flyingBlue')!;
  flyingBlue.sourcePoints = 2;
  flyingBlue.partnerUnits = 1;
  flyingBlue.minTransfer = 2000;
  flyingBlue.transferIncrement = 10;
  flyingBlue.transferDurationDe = '3 Werktage';
  state.rows.find((row) => row.partnerKey === 'britishAirways')!.validTo = state.now;
  const result = await loadDachPartnerMaps({
    loadSnapshot: repository.loadSnapshot,
    warn: () => assert.fail('no fallback'),
  });
  assert.equal(result.amex.flyingBlue.effectiveRate, 50);
  assert.equal(result.amex.flyingBlue.minTransfer, 2000);
  assert.equal(result.amex.flyingBlue.transferIncrement, 10);
  assert.deepEqual(result.amex.flyingBlue.transferDuration, {
    de: '3 Werktage',
    en: TRANSFER_SEEDS.amex_dach.flyingBlue.transferDuration.en,
  });
  assert.equal(result.amex.flyingBlue.notes, TRANSFER_SEEDS.amex_dach.flyingBlue.notes);
  assert.equal(result.amex.britishAirways, undefined);
  assert.equal(result.tableAsOf, '2026-10');
  assert.equal(TRANSFER_SEEDS.amex_dach.flyingBlue.amexPoints, 5);
});

test('empty DB and query failure return seeds and log a warning', async () => {
  for (const loadSnapshot of [
    async () => ({ rows: [], checks: [] }),
    async () => {
      throw new Error('offline');
    },
  ]) {
    const warnings: string[] = [];
    const result = await loadDachPartnerMaps({ loadSnapshot, warn: (warning) => warnings.push(warning) });
    assert.equal(result.amex, TRANSFER_SEEDS.amex_dach);
    assert.equal(result.payback, TRANSFER_SEEDS.payback);
    assert.equal(result.tableAsOf, DACH_TRANSFER_TABLE_AS_OF);
    assert.ok(warnings.length > 0);
  }
});

test('tableAsOf ignores failed, unresolved and rejected checks, but accepts approved holds', async () => {
  const { deps, state, repository } = createHarness();
  await runTransferTableCheck(deps);
  const base = state.checks[0];
  state.checks.push({ ...base, checkedAt: new Date('2026-11-01'), outcome: 'source_error' });
  state.checks.push({ ...base, checkedAt: new Date('2026-12-01'), outcome: 'held', resolution: 'rejected' });
  state.checks.push({ ...base, checkedAt: new Date('2027-01-01'), outcome: 'held' });
  const load = () => loadDachPartnerMaps({ loadSnapshot: repository.loadSnapshot, warn: () => {} });
  assert.equal((await load()).tableAsOf, '2026-10');
  state.checks.at(-1)!.resolution = 'approved';
  assert.equal((await load()).tableAsOf, '2026-10', 'PAYBACK was last verified in October');
  state.checks.push({ ...state.checks[1], checkedAt: new Date('2027-02-01'), outcome: 'unchanged' });
  assert.equal((await load()).tableAsOf, '2027-01', 'the stalest verified source sets the table date');
});
