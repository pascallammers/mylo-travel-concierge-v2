import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { getTransferRepository, readDachPartnerMaps, resetDachPartnerMapsCache } from './runtime';
import { TRANSFER_SEEDS } from './seeds';

test('runtime reader fails safely before connection when configuration is missing', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const warning = mock.method(console, 'warn', () => {});
  resetDachPartnerMapsCache();
  try {
    assert.throws(() => getTransferRepository(), /nicht konfiguriert/);
    assert.equal((await readDachPartnerMaps()).amex, TRANSFER_SEEDS.amex_dach);
    await readDachPartnerMaps();
    assert.equal(warning.mock.callCount(), 1, 'the second read is served from the instance cache');
    resetDachPartnerMapsCache();
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
    warning.mock.restore();
  }
});
