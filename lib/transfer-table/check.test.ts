import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTransferTableCheck } from './check';
import { createHarness } from './test-support';

test('first run seeds, identical rerun converges without new versions or mail', async () => {
  const { state, deps } = createHarness();
  assert.deepEqual(
    (await runTransferTableCheck(deps)).map((item) => item.outcome),
    ['unchanged', 'unchanged'],
  );
  assert.equal(state.rows.length, 15);
  assert.ok(state.rows.every((row) => row.origin === 'seed'));
  await runTransferTableCheck(deps);
  assert.equal(state.rows.length, 15);
  assert.equal(state.checks.length, 4);
  assert.equal(state.mails.length, 0);
});

test('small change closes and inserts exactly one version, then converges', async () => {
  const { state, deps } = createHarness();
  await runTransferTableCheck(deps);
  state.paybackHtml = state.paybackHtml.replace('1:1', '10:9');
  const result = await runTransferTableCheck(deps);
  assert.equal(result[1].outcome, 'applied');
  assert.equal(state.rows.length, 16);
  assert.equal(state.rows.filter((row) => row.validTo !== null).length, 1);
  assert.equal(state.rows.at(-1)?.checkId, result[1].checkId);
  assert.equal(state.rows.at(-1)?.transferDurationDe, 'bis zu 5 Werktage');
  await runTransferTableCheck(deps);
  assert.equal(state.rows.length, 16);
  assert.equal(state.mails.length, 1);
});

test('broken three-partner page logs source_error, preserves truth, and checks the other source', async () => {
  const { state, deps } = createHarness();
  state.amexHtml = state.amexHtml
    .split(/(?=<li class="product-item)/)
    .slice(0, 4)
    .join('');
  const result = await runTransferTableCheck(deps);
  assert.deepEqual(
    result.map((item) => item.outcome),
    ['source_error', 'unchanged'],
  );
  assert.equal(state.rows.length, 15);
  assert.equal(state.mails.length, 1);
  assert.match(state.checks[0].error!, /3 Partner/);
});

test('fetch failures are recorded and mailed without changing accepted rows', async () => {
  const { state, deps } = createHarness();
  state.failSource = true;
  assert.deepEqual(
    (await runTransferTableCheck(deps)).map((item) => item.outcome),
    ['source_error', 'source_error'],
  );
  assert.equal(state.rows.length, 15);
  assert.equal(state.mails.length, 2);
});

test('large changes are held and mail failures remain visible without losing history', async () => {
  const { state, deps } = createHarness();
  state.paybackHtml = state.paybackHtml.replace('1:1', '2:1');
  state.failMail = true;
  const result = await runTransferTableCheck(deps);
  assert.equal(result[1].outcome, 'held');
  assert.ok(result[1].mailError);
  assert.equal(state.rows.length, 15);
  assert.equal(state.checks[1].resolution, null);
});

test('concurrent first checks seed each source exactly once', async () => {
  const { state, deps } = createHarness();
  await Promise.all([runTransferTableCheck(deps), runTransferTableCheck(deps)]);
  assert.equal(state.rows.length, 15);
  assert.equal(state.checks.length, 4);
});

test('ambiguous partner mapping is a source error, never an automatically applied change', async () => {
  const { deps, state } = createHarness();
  const start = state.amexHtml.indexOf('<li class="product-item');
  const next = state.amexHtml.indexOf('<li class="product-item', start + 1);
  state.amexHtml += state.amexHtml.slice(start, next).replaceAll('BART-01', 'NEW-01');
  const result = await runTransferTableCheck(deps);
  assert.equal(result[0].outcome, 'source_error');
  assert.equal(state.rows.length, 15);
  assert.match(state.checks[0].error!, /mehrere Einträge/);
});

test('a newer reading supersedes an open held check, an unreadable source leaves it open', async () => {
  const { state, deps } = createHarness();
  state.paybackHtml = state.paybackHtml.replace('1:1', '2:1');
  await runTransferTableCheck(deps);
  const firstHeld = state.checks.find((check) => check.outcome === 'held')!;
  state.failSource = true;
  await runTransferTableCheck(deps);
  assert.equal(firstHeld.resolution, null);
  state.failSource = false;
  await runTransferTableCheck(deps);
  assert.equal(firstHeld.resolution, 'rejected');
  assert.equal(firstHeld.resolvedBy, 'superseded');
  const open = state.checks.filter((check) => check.outcome === 'held' && check.resolution === null);
  assert.equal(open.length, 1);
});

test('a persistence failure is mailed and the other source is still checked', async () => {
  const { state, deps } = createHarness();
  state.failPersistenceFor = 'amex_dach';
  const result = await runTransferTableCheck(deps);
  assert.deepEqual(
    result.map((item) => item.outcome),
    ['check_failed', 'unchanged'],
  );
  assert.deepEqual(state.failures, [{ source: 'amex_dach', message: 'Datenbank nicht erreichbar.' }]);
});

test('an applied check also supersedes an open held check', async () => {
  const { state, deps } = createHarness();
  state.paybackHtml = state.paybackHtml.replace('1:1', '2:1');
  await runTransferTableCheck(deps);
  state.paybackHtml = state.paybackHtml.replace('2:1', '1:1').replace('Ab 200', 'Ab 300');
  const result = await runTransferTableCheck(deps);
  assert.equal(result[1].outcome, 'applied');
  assert.equal(state.checks.filter((check) => check.outcome === 'held' && check.resolution === null).length, 0);
});
