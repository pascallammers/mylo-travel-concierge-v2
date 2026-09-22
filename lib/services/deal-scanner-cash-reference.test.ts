import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { DuffelFlight } from '@/lib/api/duffel-client';
import type { EurRates } from '@/lib/deals/award-valuation';
import {
  scanBusinessCashReference,
  selectCashReferenceRoutes,
} from './deal-scanner-cash-reference';

function createOffer(total: string, currency = 'EUR'): DuffelFlight {
  return {
    id: `offer-${total}-${currency}`,
    airline: 'LH',
    price: { total, base: total, currency },
    departure: { airport: 'FRA', time: '2026-06-01T10:00:00Z' },
    arrival: { airport: 'SIN', time: '2026-06-01T22:00:00Z' },
    duration: '12h 0m',
    stops: 0,
    segments: [],
  };
}

const EUR_ONLY: EurRates = {
  toEur: (amount, currency) => (currency === 'EUR' ? amount : null),
};

const WITH_USD: EurRates = {
  toEur: (amount, currency) => {
    if (currency === 'EUR') return amount;
    if (currency === 'USD') return amount / 1.25;
    return null;
  },
};

function createDeps(offers: DuffelFlight[], eurRates: EurRates = EUR_ONLY) {
  return {
    searchDuffel: mock.fn(async () => offers),
    insertPriceHistory: mock.fn(async () => undefined),
    eurRates,
  };
}

const ROUTE = { origin: 'FRA', destination: 'SIN' };
const DEPARTURE_DATE = '2026-06-01';

describe('scanBusinessCashReference', () => {
  it('fragt Business-One-Way-Angebote ueber Duffel ab', async () => {
    const deps = createDeps([createOffer('2400')]);

    const inserted = await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, deps);

    assert.equal(inserted, 1);
    const params = deps.searchDuffel.mock.calls[0].arguments[0];
    assert.equal(params.origin, 'FRA');
    assert.equal(params.destination, 'SIN');
    assert.equal(params.departureDate, DEPARTURE_DATE);
    assert.equal(params.cabinClass, 'business');
    assert.equal(params.passengers, 1);
    assert.equal(params.maxConnections, 1);
    assert.equal(params.maxResults, 10);
  });

  it('speichert das guenstigste Angebot als EUR-Sample', async () => {
    const deps = createDeps([
      createOffer('2600'),
      createOffer('2400'),
      createOffer('2900'),
    ]);

    await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, deps);

    const entry = deps.insertPriceHistory.mock.calls[0].arguments[0][0];
    assert.equal(entry.price, 2400);
    assert.equal(entry.currency, 'EUR');
    assert.equal(entry.cabinClass, 'business');
    assert.equal(entry.source, 'duffel');
    assert.ok(entry.scannedAt instanceof Date);
  });

  it('konvertiert Fremdwaehrungs-Angebote nach EUR', async () => {
    const deps = createDeps(
      [createOffer('3000', 'USD'), createOffer('2600')],
      WITH_USD,
    );

    await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, deps);

    const entry = deps.insertPriceHistory.mock.calls[0].arguments[0][0];
    // min(3000/1.25, 2600) = min(2400, 2600)
    assert.equal(entry.price, 2400);
  });

  it('ueberspringt Angebote ohne konvertierbare Waehrung', async () => {
    const deps = createDeps([createOffer('500', 'XXX'), createOffer('2700')]);

    await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, deps);

    const entry = deps.insertPriceHistory.mock.calls[0].arguments[0][0];
    assert.equal(entry.price, 2700);
  });

  it('insertet nichts ohne Angebote oder ohne konvertierbaren Preis', async () => {
    const emptyDeps = createDeps([]);
    assert.equal(await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, emptyDeps), 0);
    assert.equal(emptyDeps.insertPriceHistory.mock.calls.length, 0);

    const unconvertibleDeps = createDeps([createOffer('500', 'XXX')]);
    assert.equal(await scanBusinessCashReference(ROUTE, DEPARTURE_DATE, unconvertibleDeps), 0);
    assert.equal(unconvertibleDeps.insertPriceHistory.mock.calls.length, 0);
  });
});

describe('selectCashReferenceRoutes', () => {
  const routes = Array.from({ length: 17 }, (_, i) => `route-${i}`);

  it('verteilt jede Route auf genau ein 6-Stunden-Fenster pro Tag', () => {
    const day = [
      new Date('2026-04-09T00:30:00Z'),
      new Date('2026-04-09T06:30:00Z'),
      new Date('2026-04-09T12:30:00Z'),
      new Date('2026-04-09T18:30:00Z'),
    ];
    const partitions = day.map((now) => selectCashReferenceRoutes(routes, now));

    assert.deepEqual(partitions.flat().sort(), [...routes].sort());
    for (const partition of partitions) {
      assert.ok(partition.length >= 4 && partition.length <= 5);
    }
  });

  it('ist deterministisch und ueberspringt Stunden innerhalb eines Fensters nicht', () => {
    const a = selectCashReferenceRoutes(routes, new Date('2026-04-09T06:00:00Z'));
    const b = selectCashReferenceRoutes(routes, new Date('2026-04-09T11:59:00Z'));

    assert.deepEqual(a, b);
    assert.deepEqual(a, ['route-1', 'route-5', 'route-9', 'route-13']);
  });
});
