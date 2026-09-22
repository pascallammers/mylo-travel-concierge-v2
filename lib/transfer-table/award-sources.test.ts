import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAwardProgramSourceResolver } from './award-sources';
import { TRANSFER_SEEDS } from './seeds';
import { getTransferSourcesForAwardProgram } from '../config/transfer-engine';

test('one DACH snapshot supplies all hints while US maps remain static', async () => {
  let loads = 0;
  const resolver = await loadAwardProgramSourceResolver(async () => {
    loads++;
    return {
      amex: {
        flyingBlue: { ...TRANSFER_SEEDS.amex_dach.flyingBlue, amexPoints: 2, partnerMiles: 1, effectiveRate: 50 },
      },
      payback: TRANSFER_SEEDS.payback,
      tableAsOf: '2026-10',
    };
  });
  assert.equal(resolver('flyingblue').find((source) => source.sourceProgramId === 'amex_dach')?.partner.amexPoints, 2);
  assert.equal(
    resolver('british').find((source) => source.sourceProgramId === 'amex_dach'),
    undefined,
  );
  assert.deepEqual(
    resolver('flyingblue').filter((source) => source.sourceProgramId !== 'amex_dach'),
    getTransferSourcesForAwardProgram('flyingblue').filter((source) => source.sourceProgramId !== 'amex_dach'),
  );
  assert.equal(loads, 1);
});
