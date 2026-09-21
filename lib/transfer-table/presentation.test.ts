import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeChange } from './presentation';
import { seedRows, TRANSFER_SEEDS } from './seeds';

const before = seedRows(TRANSFER_SEEDS.payback)[0];
const after = { ...before, sourcePoints: 2, minTransfer: 300, transferDurationDe: '7 Werktage' };

test('every change kind has a German administrator description', () => {
  assert.match(describeChange({ type: 'rate_changed', partnerKey: 'milesAndMore', before, after }), /1:1 → 2:1/);
  assert.match(
    describeChange({ type: 'terms_changed', partnerKey: 'milesAndMore', before, after }),
    /Mindesttransfer 200 → 300/,
  );
  assert.match(describeChange({ type: 'partner_removed', partnerKey: 'milesAndMore', before }), /entfernt/);
  assert.match(
    describeChange({
      type: 'partner_added',
      observation: { sourceCode: 'NEW', sourceName: 'New', sourcePoints: 5, partnerUnits: 4, minTransfer: 1000 },
    }),
    /Neuer Partner.*5:4.*1000.*nicht angegeben/,
  );
});
