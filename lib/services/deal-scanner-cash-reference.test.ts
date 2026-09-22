import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { TravelpayoutsLatestPrice } from '@/lib/api/travelpayouts-client';
import { scanBusinessCashReference } from './deal-scanner-cash-reference';

function createPrice(overrides: Partial<TravelpayoutsLatestPrice> = {}): TravelpayoutsLatestPrice {
  return {
    value: 2400,
    trip_class: 1,
    show_to_affiliates: false,
    origin: 'FRA',
    destination: 'SIN',
    gate: 'test',
    depart_date: '2026-06-01',
    return_date: '',
    number_of_changes: 0,
    found_at: '2026-04-01T10:00:00.000Z',
    distance: 10000,
    actual: true,
    ...overrides,
  };
}

function createDeps(prices: TravelpayoutsLatestPrice[], latestScan: Date | null = null) {
  return {
    getLatestPrices: mock.fn(async () => ({ success: true, data: prices, currency: 'eur' })),
    insertPriceHistory: mock.fn(async () => undefined),
    getLatestScan: mock.fn(async () => latestScan),
  };
}

describe('scanBusinessCashReference', () => {
  it('fragt Business-One-Way-Preise des Jahres ohne Affiliate-Flag ab', async () => {
    const deps = createDeps([createPrice()]);

    const inserted = await scanBusinessCashReference(
      { origin: 'FRA', destination: 'SIN' },
      deps,
    );

    assert.equal(inserted, 1);
    const params = deps.getLatestPrices.mock.calls[0].arguments[0];
    assert.equal(params.tripClass, 1);
    assert.equal(params.oneWay, true);
    assert.equal(params.periodType, 'year');
    assert.equal(params.showToAffiliates, false);
    assert.equal(params.currency, 'eur');
  });

  it('speichert Messungen als Business-Cash-Samples mit found_at als scannedAt', async () => {
    const deps = createDeps([createPrice({ value: 2600, found_at: '2026-03-15T08:00:00.000Z' })]);

    await scanBusinessCashReference({ origin: 'FRA', destination: 'SIN' }, deps);

    const entry = deps.insertPriceHistory.mock.calls[0].arguments[0][0];
    assert.equal(entry.origin, 'FRA');
    assert.equal(entry.destination, 'SIN');
    assert.equal(entry.price, 2600);
    assert.equal(entry.currency, 'EUR');
    assert.equal(entry.cabinClass, 'business');
    assert.equal(entry.source, 'travelpayouts');
    assert.deepEqual(entry.scannedAt, new Date('2026-03-15T08:00:00.000Z'));
  });

  it('laesst nur Samples zu, die neuer als der letzte gespeicherte Scan sind', async () => {
    const deps = createDeps(
      [
        createPrice({ value: 2400, found_at: '2026-04-01T10:00:00.000Z' }),
        createPrice({ value: 2500, found_at: '2026-04-02T10:00:00.000Z' }),
        createPrice({ value: 2600, found_at: '2026-04-03T10:00:00.000Z' }),
      ],
      new Date('2026-04-02T10:00:00.000Z'),
    );

    const inserted = await scanBusinessCashReference(
      { origin: 'FRA', destination: 'SIN' },
      deps,
    );

    assert.equal(inserted, 1);
    const entries = deps.insertPriceHistory.mock.calls[0].arguments[0];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].price, 2600);
  });

  it('insertet nichts beim erneuten Lauf ohne neue Samples', async () => {
    const deps = createDeps(
      [createPrice({ found_at: '2026-04-01T10:00:00.000Z' })],
      new Date('2026-04-01T10:00:00.000Z'),
    );

    const inserted = await scanBusinessCashReference(
      { origin: 'FRA', destination: 'SIN' },
      deps,
    );

    assert.equal(inserted, 0);
    assert.equal(deps.insertPriceHistory.mock.calls.length, 0);
  });

  it('ignoriert fehlgeschlagene API-Antworten', async () => {
    const deps = createDeps([]);
    deps.getLatestPrices = mock.fn(async () => ({ success: false, data: [], currency: 'eur' }));

    const inserted = await scanBusinessCashReference(
      { origin: 'FRA', destination: 'SIN' },
      deps,
    );

    assert.equal(inserted, 0);
    assert.equal(deps.insertPriceHistory.mock.calls.length, 0);
  });
});
