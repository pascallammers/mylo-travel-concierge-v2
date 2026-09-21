import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSeedKey, seedRows, TRANSFER_SEEDS } from './seeds';
import { parseAmexDePartners } from './parsers';
import { amexHtml } from './test-support';

test('seed rows preserve every accepted value', () => {
  assert.equal(seedRows(TRANSFER_SEEDS.amex_dach).length, 14);
  assert.deepEqual(seedRows(TRANSFER_SEEDS.payback), [
    {
      partnerKey: 'milesAndMore',
      sourcePoints: 1,
      partnerUnits: 1,
      minTransfer: 200,
      transferIncrement: 1,
      transferDurationDe: 'bis zu 5 Werktage',
    },
  ]);
});

test('metadata lookup prefers product mapping and permits explicitly supplemented names', () => {
  const partner = parseAmexDePartners(amexHtml)[0];
  assert.equal(findSeedKey({ ...partner, sourceName: 'renamed' }, TRANSFER_SEEDS.amex_dach), 'britishAirways');
  assert.equal(
    findSeedKey(
      { ...partner, partnerKey: undefined, sourceName: ' British Airways Club® ' },
      TRANSFER_SEEDS.amex_dach,
    ),
    'britishAirways',
  );
  assert.equal(
    findSeedKey({ ...partner, partnerKey: undefined, sourceName: 'Unknown' }, TRANSFER_SEEDS.amex_dach),
    undefined,
  );
});
