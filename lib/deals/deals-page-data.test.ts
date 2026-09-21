import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it, mock } from 'node:test';
import type { FlightDeal } from '@/lib/db/schema';

const getPriceHistoryForRoute = mock.fn(async (
  _origin: string, _destination: string, _cabinClass: string, _source: string,
) => [100, 200, 300]);

mock.module('server-only', { namedExports: {} });
mock.module('@/env/server', { namedExports: { serverEnv: { TRAVELPAYOUTS_MARKER: 'test' } } });
mock.module('@/lib/db/deal-queries', { namedExports: { getPriceHistoryForRoute } });
mock.module('@/lib/utils/airport-database', {
  namedExports: {
    getAirportDetails: async (code: string) => code === 'FRA'
      ? { latitude: 50.03, longitude: 8.57 }
      : code === 'PMI' ? { latitude: 39.55, longitude: 2.73 } : null,
    resolveAirportInput: async (code: string) => code,
  },
});

// Load after installing I/O mocks; require keeps the test free of dynamic imports.
const { buildDealsPageData } = createRequire(import.meta.url)('./deals-page-data.ts') as typeof import('./deals-page-data');

const now = new Date('2026-04-09T12:00:00.000Z');
const deal: FlightDeal = {
  id: 'cash-fra', origin: 'FRA', destination: 'PMI', destinationName: 'Palma',
  departureDate: new Date('2026-05-01'), returnDate: null, price: 150, currency: 'EUR',
  averagePrice: 200, priceDifference: 50, priceChangePercent: 25, dealScore: 85,
  cabinClass: 'economy', tripType: 'oneway', airline: null, categories: [],
  stops: 0, flightDuration: null, source: 'travelpayouts', affiliateLink: null,
  expiresAt: new Date('2026-05-01'), createdAt: now,
  updatedAt: new Date('2026-04-09T10:00:00.000Z'),
};

describe('buildDealsPageData', () => {
  it('übernimmt Fund- und Sichtungszeit, Routendistanz und drei Messungen ins Modell', async () => {
    getPriceHistoryForRoute.mock.resetCalls();
    const model = await buildDealsPageData([deal], { kind: 'cash', origins: ['FRA'], sort: 'score' }, now);
    assert.equal(model.deals[0].isFresh, true);
    assert.equal(model.deals[0].lastSeenHours, 2);
    assert.equal(model.deals[0].range, 'europe');
    assert.equal(model.deals[0].priceHistoryBar.visible, true);
    assert.deepEqual(getPriceHistoryForRoute.mock.calls[0].arguments, ['FRA', 'PMI', 'economy', 'travelpayouts']);
  });

  it('ordnet Awards derselben Strecke separat zu und erhält deren Buchungslink', async () => {
    const award = { ...deal, id: 'award-fra', source: 'seats_aero', affiliateLink: 'https://example.com/award' };
    const model = await buildDealsPageData([deal, award], { kind: 'award', origins: [], sort: 'score' }, now);
    assert.deepEqual(model.kindCounts, { cash: 1, award: 1 });
    assert.equal(model.deals[0].priceHistoryBar.visible, false);
    assert.equal(model.deals[0].affiliateLink, award.affiliateLink);
  });

  it('lässt unbekannte Strecken ohne Reichweitenfilter sichtbar', async () => {
    const model = await buildDealsPageData(
      [{ ...deal, destination: 'XXX' }], { kind: 'cash', origins: [], sort: 'score' }, now,
    );
    assert.equal(model.deals[0].range, null);
  });
});
