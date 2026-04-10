import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildDealInsight,
  buildPriceHistoryBar,
  classifyDealBucket,
  sortPresentedDeals,
  type PresentableDeal,
} from './deal-presenter';

function createDeal(overrides: Partial<PresentableDeal> = {}): PresentableDeal {
  return {
    origin: 'FRA',
    destination: 'PMI',
    destinationName: 'Palma de Mallorca',
    departureDate: new Date('2026-04-18T10:00:00.000Z'),
    returnDate: new Date('2026-04-21T18:00:00.000Z'),
    price: 220,
    currency: 'EUR',
    cabinClass: 'economy',
    averagePrice: 610,
    priceChangePercent: 64,
    dealScore: 92,
    personalizedScore: null,
    personalizationReasons: [],
    airline: 'Lufthansa',
    source: 'travelpayouts',
    flightDurationMinutes: null,
    ...overrides,
  };
}

describe('classifyDealBucket', () => {
  it('ordnet Punkte-Deals immer dem Punkte-Bucket zu', () => {
    const bucket = classifyDealBucket(createDeal({ source: 'seats_aero' }), {
      routeDistanceKm: 1200,
    });

    assert.strictEqual(bucket, 'points');
  });

  it('ordnet kurze Cash-Deals mit kurzer Reisedauer als Wochenend-Escape ein', () => {
    const bucket = classifyDealBucket(createDeal(), {
      routeDistanceKm: 1250,
    });

    assert.strictEqual(bucket, 'weekend_escape');
  });

  it('ordnet laengere Routen als Fernreise ein', () => {
    const bucket = classifyDealBucket(
      createDeal({
        destination: 'BKK',
        destinationName: 'Bangkok',
        returnDate: new Date('2026-05-03T18:00:00.000Z'),
      }),
      {
        routeDistanceKm: 9000,
      },
    );

    assert.strictEqual(bucket, 'long_haul');
  });
});

describe('buildDealInsight', () => {
  it('liefert Why, Fuer-wen und Buchen-Empfehlung fuer starke Wochenend-Deals', () => {
    const insight = buildDealInsight(createDeal(), 'weekend_escape');

    assert.match(insight.why, /64% guenstiger als ueblich/i);
    assert.match(insight.forWhom, /langes Wochenende/i);
    assert.strictEqual(insight.recommendation.kind, 'book');
    assert.strictEqual(insight.recommendation.confidence, 92);
  });

  it('liefert Watch-Empfehlung fuer schwaechere Deals', () => {
    const insight = buildDealInsight(
      createDeal({
        dealScore: 72,
        averagePrice: 300,
        priceChangePercent: 12,
      }),
      'long_haul',
    );

    assert.strictEqual(insight.recommendation.kind, 'watch');
    assert.strictEqual(insight.recommendation.confidence, 28);
  });

  it('liefert Sweet-Spot-Texte fuer Punkte-Deals', () => {
    const insight = buildDealInsight(
      createDeal({
        source: 'seats_aero',
        airline: 'Lufthansa',
        averagePrice: null,
        priceChangePercent: null,
      }),
      'points',
    );

    assert.match(insight.why, /Sweet Spot bei Lufthansa/i);
    assert.match(insight.forWhom, /Meilensammler/i);
  });
});

describe('buildPriceHistoryBar', () => {
  it('versteckt die Price-History bei weniger als fuenf Datenpunkten', () => {
    const bar = buildPriceHistoryBar(220, {
      min: 200,
      max: 400,
      count: 4,
    });

    assert.strictEqual(bar.visible, false);
  });

  it('klassifiziert guenstige Preise als gruenen Bereich', () => {
    const bar = buildPriceHistoryBar(220, {
      min: 200,
      max: 400,
      count: 12,
    });

    assert.strictEqual(bar.visible, true);
    assert.strictEqual(bar.tone, 'good');
    assert.strictEqual(bar.percent, 10);
  });
});

describe('sortPresentedDeals', () => {
  it('sortiert nach Deal-Score absteigend', () => {
    const deals = sortPresentedDeals(
      [
        createDeal({ destination: 'ATH', dealScore: 78 }),
        createDeal({ destination: 'JFK', dealScore: 97 }),
      ],
      'score',
    );

    assert.deepStrictEqual(deals.map((deal) => deal.destination), ['JFK', 'ATH']);
  });

  it('sortiert nach Ersparnis absteigend', () => {
    const deals = sortPresentedDeals(
      [
        createDeal({ destination: 'ATH', priceDifference: 120 }),
        createDeal({ destination: 'JFK', priceDifference: 410 }),
      ],
      'savings',
    );

    assert.deepStrictEqual(deals.map((deal) => deal.destination), ['JFK', 'ATH']);
  });
});
