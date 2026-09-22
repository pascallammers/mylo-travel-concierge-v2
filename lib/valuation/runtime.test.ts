import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { getValuationRepository, readValuationTable, resetValuationTableCache } from './runtime';
import { seedRows } from './seeds';
import type { RateVersion } from './types';

test('runtime falls back without configuration, caches five minutes and resets after writes', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const warning = mock.method(console, 'warn', () => {});
  const clock = mock.method(Date, 'now', () => 1000);
  try {
    assert.throws(getValuationRepository, /nicht konfiguriert/);
    resetValuationTableCache();
    const first = await readValuationTable();
    assert.equal(first.tableAsOf, '2026-09');
    assert.equal(await readValuationTable(), first);
    assert.equal(warning.mock.callCount(), 1);
    clock.mock.mockImplementation(() => 301000);
    assert.notEqual(await readValuationTable(), first);
    resetValuationTableCache();
    await readValuationTable();
    assert.equal(warning.mock.callCount(), 3);
    process.env.DATABASE_URL = 'postgres://localhost:1/unused';
    const repository = getValuationRepository();
    assert.equal(getValuationRepository(), repository);
    const rows = seedRows().map(
      (row): RateVersion => ({ ...row, id: 'id', origin: 'seed', validFrom: new Date(), validTo: null }),
    );
    rows[0].centsPerUnit = 1.8;
    const loader = mock.method(repository, 'loadCurrentRows', async () => rows);
    resetValuationTableCache();
    assert.equal((await readValuationTable()).rateFor('lufthansa', 'travel')?.centsPerUnit, 1.8);
    loader.mock.mockImplementation(() => new Promise(() => {}));
    resetValuationTableCache();
    // Keep the test process alive while the production timeout is deliberately unref'ed.
    const keepAlive = setTimeout(() => {}, 3000);
    const started = performance.now();
    assert.equal((await readValuationTable()).rateFor('lufthansa', 'travel')?.centsPerUnit, 1.7);
    assert.ok(performance.now() - started >= 1900);
    clearTimeout(keepAlive);
    loader.mock.restore();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    resetValuationTableCache();
    warning.mock.restore();
    clock.mock.restore();
  }
});
