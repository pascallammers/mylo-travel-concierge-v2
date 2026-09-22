import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyChanges, diffTransferTable, MAX_RELATIVE_RATE_DEVIATION } from './diff';
import { parseAmexDePartners, parsePaybackMilesAndMore } from './parsers';
import { seedRows, TRANSFER_SEEDS } from './seeds';
import { amexHtml, paybackHtml } from './test-support';

const rows = seedRows(TRANSFER_SEEDS.amex_dach);
const observations = parseAmexDePartners(amexHtml);

test('unchanged source yields no changes', () => {
  assert.deepEqual(diffTransferTable(rows, observations), []);
  assert.equal(classifyChanges([]), 'unchanged');
});

test('small rate changes apply while 5:4 to 2:1 holds', () => {
  for (const [sourcePoints, partnerUnits, expected] of [
    [5, 3, 'apply'],
    [2, 1, 'hold'],
    [1, 1, 'apply'],
    [1, 2, 'hold'],
  ] as const) {
    const changed = observations.map((item) =>
      item.partnerKey === 'flyingBlue' ? { ...item, sourcePoints, partnerUnits } : item,
    );
    const diff = diffTransferTable(rows, changed);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].type, 'rate_changed');
    assert.equal(classifyChanges(diff), expected);
  }
  assert.equal(MAX_RELATIVE_RATE_DEVIATION, 0.25);
});

test('removed and added partners hold the entire source', () => {
  const removed = diffTransferTable(rows, observations.slice(1));
  assert.equal(removed[0].type, 'partner_removed');
  assert.equal(classifyChanges(removed), 'hold');
  const added = diffTransferTable(rows, [
    ...observations,
    { ...observations[0], partnerKey: undefined, sourceName: 'New partner', sourceCode: 'NEW' },
  ]);
  assert.equal(added[0].type, 'partner_added');
  assert.equal(classifyChanges(added), 'hold');
});

test('terms-only changes apply and before snapshots contain no persistence fields', () => {
  const diff = diffTransferTable(
    rows,
    observations.map((item) => ({ ...item, minTransfer: item.minTransfer + 100 })),
  );
  assert.equal(diff.length, 14);
  assert.ok(diff.every((change) => change.type === 'terms_changed'));
  assert.equal(classifyChanges(diff), 'apply');
});

test('PAYBACK never compares unpublished duration or increment', () => {
  const paybackRows = seedRows(TRANSFER_SEEDS.payback).map((row) => ({
    ...row,
    transferIncrement: 500,
    transferDurationDe: 'Individuell',
  }));
  assert.deepEqual(diffTransferTable(paybackRows, parsePaybackMilesAndMore(paybackHtml)), []);
});
