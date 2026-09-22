import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTransferTableCheck } from './check';
import { resolveHeldCheck } from './resolve';
import { createHarness } from './test-support';

async function heldHarness() {
  const harness = createHarness();
  harness.state.paybackHtml = harness.state.paybackHtml.replace('1:1', '2:1');
  const checks = await runTransferTableCheck(harness.deps);
  return { ...harness, checkId: checks[1].checkId };
}

test('approval applies the saved change and records administrator and time', async () => {
  const { state, deps, checkId } = await heldHarness();
  await resolveHeldCheck(checkId, 'approved', 'admin-1', deps);
  assert.equal(state.rows.length, 16);
  assert.equal(state.rows.at(-1)?.sourcePoints, 2);
  assert.equal(state.checks[1].resolution, 'approved');
  assert.equal(state.checks[1].resolvedBy, 'admin-1');
  assert.deepEqual(state.checks[1].resolvedAt, state.now);
  assert.equal((await runTransferTableCheck(deps))[1].outcome, 'unchanged');
});

test('approval after drift refuses atomically, including term drift', async () => {
  const { state, deps, checkId } = await heldHarness();
  // A newer check supersedes the hold, so drift can only come from outside the check flow.
  state.rows.find((row) => row.sourceProgramId === 'payback' && row.validTo === null)!.minTransfer = 300;
  const before = structuredClone(state.rows);
  await assert.rejects(resolveHeldCheck(checkId, 'approved', 'admin-1', deps), /inzwischen geändert/);
  assert.deepEqual(state.rows, before);
  assert.equal(state.checks[1].resolution, null);
});

test('rejection changes no rates and neither decision can be repeated', async () => {
  const { state, deps, checkId } = await heldHarness();
  const before = structuredClone(state.rows);
  await resolveHeldCheck(checkId, 'rejected', 'admin-1', deps);
  assert.deepEqual(state.rows, before);
  for (const resolution of ['approved', 'rejected'] as const)
    await assert.rejects(resolveHeldCheck(checkId, resolution, 'admin-2', deps), /nicht mehr/);
});

test('approval refuses a missing or non-held check', async () => {
  const { state, deps } = await heldHarness();
  await assert.rejects(resolveHeldCheck('missing', 'approved', 'admin', deps), /nicht gefunden/);
  await assert.rejects(resolveHeldCheck(state.checks[0].id, 'approved', 'admin', deps), /nicht mehr/);
});

test('unknown partner prevents partial approval until metadata is provided', async () => {
  const { state, deps } = createHarness();
  const firstBlock = state.amexHtml.match(/<li class="product-item[\s\S]*?<\/li>\s*<li class="product-item/)?.[0];
  assert.ok(firstBlock);
  const block = state.amexHtml.slice(
    state.amexHtml.indexOf('<li class="product-item'),
    state.amexHtml.indexOf('<li class="product-item', 20),
  );
  state.amexHtml += block.replaceAll('BART-01', 'NEW-01').replaceAll('British Airways Club', 'New Partner');
  const result = await runTransferTableCheck(deps);
  assert.equal(result[0].outcome, 'held');
  const before = structuredClone(state.rows);
  await assert.rejects(resolveHeldCheck(result[0].checkId, 'approved', 'admin', deps), /Metadaten in dach.ts ergänzen/);
  assert.deepEqual(state.rows, before);
  const updatedDeps = {
    ...deps,
    seeds: {
      ...deps.seeds,
      amex_dach: {
        ...deps.seeds.amex_dach,
        newPartner: { ...deps.seeds.amex_dach.britishAirways, name: 'New Partner' },
      },
    },
  };
  await resolveHeldCheck(result[0].checkId, 'approved', 'admin', updatedDeps);
  assert.ok(state.rows.find((row) => row.partnerKey === 'newPartner' && row.validTo === null));
});

test('approved removals stay removed on identical reruns and can be re-added with metadata', async () => {
  const { state, deps } = createHarness();
  const fullHtml = state.amexHtml;
  const blocks = state.amexHtml.split(/(?=<li class="product-item)/);
  state.amexHtml = blocks[0] + blocks.slice(2).join('');
  const result = await runTransferTableCheck(deps);
  await resolveHeldCheck(result[0].checkId, 'approved', 'admin', deps);
  assert.equal(state.rows.filter((row) => row.validTo === null).length, 14);
  assert.equal((await runTransferTableCheck(deps))[0].outcome, 'unchanged');
  state.amexHtml = fullHtml;
  const restored = await runTransferTableCheck(deps);
  assert.equal(restored[0].outcome, 'held');
  await resolveHeldCheck(restored[0].checkId, 'approved', 'admin', deps);
  assert.equal(state.rows.filter((row) => row.validTo === null).length, 15);
});
