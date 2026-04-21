import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildDealsPageModel, type DealsPageModelDeal } from './deals-page-model';

function createDeal(overrides: Partial<DealsPageModelDeal> = {}): DealsPageModelDeal {
  return {
    id: `deal-${Math.random()}`,
    origin: 'FRA',
    destination: 'PMI',
    destinationName: 'Palma',
    departureDate: new Date('2026-04-18T10:00:00.000Z'),
    returnDate: new Date('2026-04-21T18:00:00.000Z'),
    price: 220,
    cabinClass: 'economy',
    averagePrice: 610,
    priceDifference: 390,
    priceChangePercent: 64,
    dealScore: 92,
    personalizedScore: null,
    personalizationReasons: [],
    airline: 'Lufthansa',
    source: 'travelpayouts',
    flightDurationMinutes: null,
    currency: 'EUR',
    affiliateLink: null,
    stops: 0,
    tripType: 'roundtrip',
    updatedAt: new Date('2026-04-09T10:00:00.000Z'),
    preferredOriginMatch: false,
    routeDistanceKm: 1250,
    priceHistoryStats: { min: 200, max: 620, count: 12 },
    ...overrides,
  };
}

describe('buildDealsPageModel', () => {
  it('gruppiert Deals in Buckets und behaelt Bucket-Counts fuer alle Buckets', () => {
    const model = buildDealsPageModel({
      deals: [
        createDeal(),
        createDeal({
          id: 'deal-bkk',
          destination: 'BKK',
          destinationName: 'Bangkok',
          price: 540,
          averagePrice: 830,
          priceDifference: 290,
          priceChangePercent: 35,
          dealScore: 88,
          routeDistanceKm: 9000,
        }),
        createDeal({
          id: 'deal-seoul',
          destination: 'ICN',
          destinationName: 'Seoul',
          source: 'seats_aero',
          price: 48000,
          averagePrice: null,
          priceDifference: null,
          priceChangePercent: null,
          currency: 'Miles',
          dealScore: 95,
          routeDistanceKm: 8600,
        }),
      ],
      filters: {
        bucket: 'all',
        sort: 'score',
      },
      now: new Date('2026-04-09T12:00:00.000Z'),
    });

    assert.strictEqual(model.bucketCounts.weekend_escape, 1);
    assert.strictEqual(model.bucketCounts.long_haul, 1);
    assert.strictEqual(model.bucketCounts.points, 1);
    assert.deepStrictEqual(model.visibleBuckets.points.map((deal) => deal.id), ['deal-seoul']);
  });

  it('wendet Origin-, Stop-, TripType- und Bucket-Filter an', () => {
    const model = buildDealsPageModel({
      deals: [
        createDeal(),
        createDeal({
          id: 'deal-oneway',
          origin: 'BER',
          tripType: 'oneway',
          stops: 1,
          routeDistanceKm: 1400,
        }),
        createDeal({
          id: 'deal-long',
          destination: 'JFK',
          routeDistanceKm: 6200,
          stops: 0,
        }),
      ],
      filters: {
        origin: 'BER',
        stops: 1,
        tripType: 'oneway',
        bucket: 'weekend_escape',
        sort: 'price',
      },
      now: new Date('2026-04-09T12:00:00.000Z'),
    });

    assert.deepStrictEqual(model.visibleBuckets.weekend_escape.map((deal) => deal.id), ['deal-oneway']);
    assert.strictEqual(model.visibleBuckets.long_haul.length, 0);
    assert.strictEqual(model.activeBucket, 'weekend_escape');
  });

  it('berechnet den Stale-Hinweis in Stunden', () => {
    const model = buildDealsPageModel({
      deals: [
        createDeal({
          updatedAt: new Date('2026-04-08T05:00:00.000Z'),
        }),
      ],
      filters: {
        bucket: 'all',
        sort: 'score',
      },
      now: new Date('2026-04-09T12:00:00.000Z'),
    });

    assert.strictEqual(model.staleHours, 31);
  });

  it('sortiert bevorzugte Heimatflughaefen vor anderen Abflughäfen', () => {
    const model = buildDealsPageModel({
      deals: [
        createDeal({
          id: 'deal-fra',
          origin: 'FRA',
          dealScore: 98,
          preferredOriginMatch: false,
        }),
        createDeal({
          id: 'deal-dus',
          origin: 'DUS',
          dealScore: 88,
          preferredOriginMatch: true,
        }),
      ],
      filters: {
        bucket: 'all',
        sort: 'score',
      },
      now: new Date('2026-04-09T12:00:00.000Z'),
    });

    assert.deepStrictEqual(
      model.visibleBuckets.weekend_escape.map((deal) => deal.id),
      ['deal-dus', 'deal-fra'],
    );
  });
});
