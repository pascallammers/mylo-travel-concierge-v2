import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPriceHistoryBar,
  classifyDealRange,
  getDealKind,
  getLastSeenHours,
  isFreshDeal,
  sortPresentedDeals,
  type PresentableDeal,
} from './deal-presenter';

type SortableDeal = PresentableDeal & { isFresh: boolean };

function createDeal(overrides: Partial<SortableDeal> = {}): SortableDeal {
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
    isFresh: false,
    ...overrides,
  };
}

describe('getDealKind', () => {
  it('erkennt ausschließlich seats_aero als Prämien-Deal', () => {
    assert.equal(getDealKind('seats_aero'), 'award');
    for (const source of ['travelpayouts', 'other', 'seats', 'SEATS_AERO', '']) {
      assert.equal(getDealKind(source), 'cash');
    }
  });
});

describe('classifyDealRange', () => {
  it('verwendet die 4000-km-Grenze einschließlich und priorisiert Distanz', () => {
    assert.equal(classifyDealRange({ routeDistanceKm: 3999, flightDurationMinutes: null }), 'europe');
    assert.equal(classifyDealRange({ routeDistanceKm: 4000, flightDurationMinutes: 301 }), 'europe');
    assert.equal(classifyDealRange({ routeDistanceKm: 4001, flightDurationMinutes: 100 }), 'long_haul');
  });

  it('nutzt ohne Distanz die Dauer bis einschließlich 300 Minuten', () => {
    assert.equal(classifyDealRange({ routeDistanceKm: null, flightDurationMinutes: 299 }), 'europe');
    assert.equal(classifyDealRange({ routeDistanceKm: null, flightDurationMinutes: 300 }), 'europe');
    assert.equal(classifyDealRange({ routeDistanceKm: null, flightDurationMinutes: 301 }), 'long_haul');
    assert.equal(classifyDealRange({ routeDistanceKm: null, flightDurationMinutes: null }), null);
  });
});

describe('isFreshDeal', () => {
  const now = new Date('2026-04-09T12:00:00.000Z');

  it('kennzeichnet Deals nur innerhalb der ersten 24 Stunden als neu', () => {
    assert.equal(isFreshDeal(now, now), true);
    assert.equal(isFreshDeal(new Date('2026-04-08T12:00:00.001Z'), now), true);
    assert.equal(isFreshDeal(new Date('2026-04-08T12:00:00.000Z'), now), false);
    assert.equal(isFreshDeal(new Date('2026-04-07T12:00:00.000Z'), now), false);
    assert.equal(isFreshDeal(new Date('2026-04-10T12:00:00.000Z'), now), false);
  });
});

describe('getLastSeenHours', () => {
  const now = new Date('2026-04-09T12:00:00.000Z');

  it('rundet ab und gibt unter einer Stunde sowie bei zukünftigen Zeiten null zurück', () => {
    assert.equal(getLastSeenHours(now, now), 0);
    assert.equal(getLastSeenHours(new Date('2026-04-09T11:00:00.001Z'), now), 0);
    assert.equal(getLastSeenHours(new Date('2026-04-09T11:00:00.000Z'), now), 1);
    assert.equal(getLastSeenHours(new Date('2026-04-09T09:01:00.000Z'), now), 2);
    assert.equal(getLastSeenHours(new Date('2026-04-10T12:00:00.000Z'), now), 0);
  });
});

describe('buildPriceHistoryBar', () => {
  it('zeigt die Historie erst ab drei Barpreis-Messungen', () => {
    assert.equal(buildPriceHistoryBar('cash', 220, { min: 200, max: 400, count: 2 }).visible, false);
    assert.deepEqual(buildPriceHistoryBar('cash', 220, { min: 200, max: 400, count: 3 }), {
      visible: true, percent: 10, tone: 'good',
    });
    assert.equal(buildPriceHistoryBar('award', 220, { min: 200, max: 400, count: 100 }).visible, false);
  });

  it('versteckt identische oder umgekehrte Preisgrenzen', () => {
    assert.equal(buildPriceHistoryBar('cash', 200, { min: 200, max: 200, count: 3 }).visible, false);
    assert.equal(buildPriceHistoryBar('cash', 200, { min: 300, max: 200, count: 3 }).visible, false);
  });

  it('begrenzt den Balken und unterscheidet günstige, mittlere und hohe Preise', () => {
    const stats = { min: 200, max: 400, count: 3 };
    assert.deepEqual(buildPriceHistoryBar('cash', 100, stats), { visible: true, percent: 0, tone: 'good' });
    assert.deepEqual(buildPriceHistoryBar('cash', 250, stats), { visible: true, percent: 25, tone: 'neutral' });
    assert.equal(buildPriceHistoryBar('cash', 320, stats).tone, 'neutral');
    assert.equal(buildPriceHistoryBar('cash', 322, stats).tone, 'high');
    assert.deepEqual(buildPriceHistoryBar('cash', 500, stats), { visible: true, percent: 100, tone: 'high' });
  });
});

describe('sortPresentedDeals', () => {
  const fresh = createDeal({ destination: 'ATH', isFresh: true, dealScore: 60, price: 500 });
  const old = createDeal({
    destination: 'JFK', dealScore: 97, price: 100, preferredOriginMatch: true,
    departureDate: new Date('2026-04-12T10:00:00.000Z'),
  });

  it('sortiert neue Deals nur bei Güte vor ältere und verändert die Eingabe nicht', () => {
    const input = [old, fresh];
    assert.deepEqual(sortPresentedDeals(input, 'score').map((deal) => deal.destination), ['ATH', 'JFK']);
    assert.deepEqual(input, [old, fresh]);
    assert.deepEqual(sortPresentedDeals([fresh, old], 'price').map((deal) => deal.destination), ['JFK', 'ATH']);
    assert.deepEqual(sortPresentedDeals([fresh, old], 'date').map((deal) => deal.destination), ['JFK', 'ATH']);
  });

  it('lässt bevorzugte Abflughäfen weder Preis- noch Datumssortierung überschreiben', () => {
    const preferred = { ...fresh, preferredOriginMatch: true };
    const cheaper = { ...old, preferredOriginMatch: false };
    for (const sort of ['price', 'date'] as const) {
      assert.deepEqual(sortPresentedDeals([preferred, cheaper], sort).map((deal) => deal.destination), ['JFK', 'ATH']);
    }
  });

  it('bewahrt die Personalisierung innerhalb derselben Frischegruppe bei Güte', () => {
    const deals = [
      createDeal({ destination: 'A', dealScore: 99 }),
      createDeal({ destination: 'B', personalizedScore: 100 }),
      createDeal({ destination: 'C', preferredOriginMatch: true, dealScore: 70 }),
    ];
    assert.deepEqual(sortPresentedDeals(deals, 'score').map((deal) => deal.destination), ['C', 'B', 'A']);
  });

  it('nutzt bei gleicher Güte die Personalisierungsgründe, danach den Deal-Score', () => {
    const deals = [
      createDeal({ destination: 'A', personalizedScore: 90, dealScore: 80 }),
      createDeal({ destination: 'B', personalizedScore: 90, dealScore: 85 }),
      createDeal({ destination: 'C', personalizedScore: 90, personalizationReasons: ['FRA'] }),
    ];
    assert.deepEqual(sortPresentedDeals(deals, 'score').map((deal) => deal.destination), ['C', 'B', 'A']);
    assert.deepEqual(sortPresentedDeals([], 'score'), []);
  });
});
