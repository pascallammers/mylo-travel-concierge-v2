import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_ORIGIN_FILTERS,
  buildDealsPageModel,
  parseDealsFilters,
  type DealsPageFilters,
  type DealsPageModelDeal,
} from './deals-page-model';

const now = new Date('2026-04-09T12:00:00.000Z');
const awardContext = {
  ownBalanceProgramIds: new Set<string>(),
  resolveProgramName: () => 'Miles & More',
  resolveDachRoute: () => ({ label: 'PAYBACK 1:1' }),
};
const defaultFilters: DealsPageFilters = { kind: 'award', origins: [], sort: 'score' };

function createDeal(overrides: Partial<DealsPageModelDeal> = {}): DealsPageModelDeal {
  return {
    programId: 'lufthansa',
    programReachableDach: true,
    taxesEur: 480,
    seatsLeft: 2,
    cashReferencePrice: null,
    cashReferenceSamples: null,
    valuationRateCt: null,
    valuationRateValidFrom: null,
    savingsPercent: null,
    id: 'deal-fra',
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
    createdAt: new Date('2026-04-08T12:00:00.000Z'),
    updatedAt: new Date('2026-04-09T10:00:00.000Z'),
    preferredOriginMatch: false,
    routeDistanceKm: 1250,
    priceHistoryStats: { min: 200, max: 620, count: 3 },
    ...overrides,
  };
}

describe('parseDealsFilters', () => {
  it('wählt standardmäßig Prämien, Güte und gespeicherte Abflughäfen', () => {
    const preferred = ['FRA', 'MUC'];
    const filters = parseDealsFilters({}, preferred);
    assert.deepEqual(filters, { ...defaultFilters, origins: preferred, range: undefined });
    assert.notEqual(filters.origins, preferred);
  });

  it('unterscheidet fehlendes origin von all, leerem Wert und ungültiger Liste', () => {
    assert.deepEqual(parseDealsFilters({}, ['FRA']).origins, ['FRA']);
    for (const origin of ['all', 'ALL', ' All ', '', '12,AB,ABCD,!!,MÜC']) {
      assert.deepEqual(parseDealsFilters({ origin }, ['FRA']).origins, []);
    }
  });

  it('begrenzt die Liste auf die Menge, die das Wochenabo speichern darf', () => {
    const origin = 'FRA,MUC,BER,DUS,HAM,VIE,ZRH,CGN,STR,NUE,LEJ,HAJ';
    assert.equal(parseDealsFilters({ origin }, []).origins.length, MAX_ORIGIN_FILTERS);
  });

  it('normalisiert, validiert und dedupliziert kommagetrennte IATA-Codes', () => {
    assert.deepEqual(
      parseDealsFilters({ origin: ' fra, MUC,FRA,,ber,12,ABCD,<FRA>' }, ['DUS']).origins,
      ['FRA', 'MUC', 'BER'],
    );
  });

  it('akzeptiert nur die festgelegten Arten, Reichweiten und Sortierungen', () => {
    for (const sort of ['score', 'price', 'date'] as const) {
      for (const range of ['europe', 'long_haul'] as const) {
        assert.deepEqual(parseDealsFilters({ kind: 'cash', sort, range }, []), {
          kind: 'cash', origins: [], sort, range,
        });
      }
    }
    for (const kind of ['award', 'all', 'points', 'CASH', 'garbage']) {
      assert.equal(parseDealsFilters({ kind }, []).kind, 'award');
    }
    assert.deepEqual(parseDealsFilters({ sort: 'savings', range: 'all' }, []), {
      ...defaultFilters, range: undefined,
    });
    assert.deepEqual(parseDealsFilters({ sort: 'garbage', range: 'garbage' }, []), {
      ...defaultFilters, range: undefined,
    });
  });

  it('liest wiederholte Parameter einmal über ihren ersten Wert und ignoriert alte Filter', () => {
    assert.deepEqual(parseDealsFilters({
      kind: ['cash', 'award'], origin: ['muc', 'FRA'], range: ['europe', 'long_haul'],
      sort: ['date', 'price'], bucket: 'points', stops: '0', tripType: 'oneway',
    }, []), { kind: 'cash', origins: ['MUC'], range: 'europe', sort: 'date' });
  });
});

describe('buildDealsPageModel', () => {
  it('zählt beide Arten unabhängig vom aktiven Tab nach Abflug- und Reichweitenfiltern', () => {
    const deals = [
      createDeal(),
      createDeal({ id: 'award-fra', source: 'seats_aero' }),
      createDeal({ id: 'award-muc', source: 'seats_aero', origin: 'MUC' }),
      createDeal({ id: 'cash-muc', origin: 'MUC' }),
      createDeal({ id: 'award-ber', source: 'seats_aero', origin: 'BER' }),
      createDeal({ id: 'award-long', source: 'seats_aero', routeDistanceKm: 9000 }),
    ];
    for (const kind of ['award', 'cash'] as const) {
      const model = buildDealsPageModel({ awardContext,
        deals, filters: { kind, origins: ['FRA', 'MUC'], range: 'europe', sort: 'score' }, now,
      });
      assert.deepEqual(model.kindCounts, { award: 2, cash: 2 });
      assert.equal(model.activeKind, kind);
      assert.deepEqual(model.deals.map((deal) => deal.id), kind === 'award'
        ? ['award-fra', 'award-muc'] : ['deal-fra', 'cash-muc']);
    }
  });

  it('zeigt unbekannte Reichweiten nur ohne Reichweitenfilter', () => {
    const deals = [
      createDeal({ id: 'unknown', routeDistanceKm: null }),
      createDeal({ id: 'duration', routeDistanceKm: null, flightDurationMinutes: 300 }),
      createDeal({ id: 'long', routeDistanceKm: 4001 }),
    ];
    const build = (range?: DealsPageFilters['range']) => buildDealsPageModel({ awardContext,
      deals, filters: { kind: 'cash', origins: [], sort: 'score', range }, now,
    });
    assert.equal(build().deals.length, 3);
    assert.equal(build().deals[0].range, null);
    assert.deepEqual(build('europe').deals.map((deal) => deal.id), ['duration']);
    assert.deepEqual(build('long_haul').deals.map((deal) => deal.id), ['long']);
  });

  it('berechnet Frische aus createdAt, Sichtung aus updatedAt und Historie nach Art', () => {
    const cash = buildDealsPageModel({ awardContext,
      deals: [createDeal()], filters: { ...defaultFilters, kind: 'cash' }, now,
    }).deals[0];
    assert.equal(cash.isFresh, false);
    assert.equal(cash.lastSeenHours, 2);
    assert.equal(cash.priceHistoryBar.visible, true);
    const award = buildDealsPageModel({ awardContext,
      deals: [createDeal({ source: 'seats_aero', createdAt: now, updatedAt: now })],
      filters: defaultFilters, now,
    }).deals[0];
    assert.equal(award.isFresh, true);
    assert.equal(award.lastSeenHours, 0);
    assert.equal(award.priceHistoryBar.visible, false);
  });

  it('sortiert eine flache Liste nach Güte, Preis oder Abflugdatum', () => {
    const deals = [
      createDeal({ id: 'old', price: 100, departureDate: new Date('2026-04-10'), dealScore: 99 }),
      createDeal({ id: 'fresh', price: 500, createdAt: now, dealScore: 60 }),
    ];
    for (const sort of ['score', 'price', 'date'] as const) {
      const model = buildDealsPageModel({ awardContext, deals, filters: { kind: 'cash', origins: [], sort }, now });
      assert.deepEqual(model.deals.map((deal) => deal.id), sort === 'score' ? ['fresh', 'old'] : ['old', 'fresh']);
    }
  });

  it('behandelt fehlende Historie und leere Trefferlisten', () => {
    const model = buildDealsPageModel({ awardContext,
      deals: [createDeal({ priceHistoryStats: null })], filters: { ...defaultFilters, kind: 'cash' }, now,
    });
    assert.equal(model.deals[0].priceHistoryBar.visible, false);
    assert.deepEqual(buildDealsPageModel({ awardContext, deals: [], filters: defaultFilters, now }), {
      activeKind: 'award', kindCounts: { award: 0, cash: 0 }, deals: [], unreachableDeals: [], staleHours: null,
    });
  });

  it('berechnet die Datenfrische anhand der jüngsten Sichtung vor allen Filtern', () => {
    const model = buildDealsPageModel({ awardContext,
      deals: [
        createDeal({ updatedAt: new Date('2026-04-07T05:00:00.000Z') }),
        createDeal({ updatedAt: new Date('2026-04-08T05:00:00.000Z') }),
      ], filters: defaultFilters, now,
    });
    assert.equal(model.staleHours, 31);
    assert.equal(model.deals.length, 0);
  });

  it('trennt unerreichbare Awards, zählt sie weiter und lässt eigenes Guthaben in der Hauptliste', () => {
    const deals = [
      createDeal({ id: 'transfer', source: 'seats_aero' }),
      createDeal({ id: 'own', source: 'seats_aero', programId: 'united', programReachableDach: false }),
      createDeal({ id: 'unreachable', source: 'seats_aero', programId: 'aeroplan', programReachableDach: false }),
      createDeal({ id: 'unknown', source: 'seats_aero', programId: null }),
      createDeal({ id: 'cash' }),
    ];
    const context = { ...awardContext, ownBalanceProgramIds: new Set(['united']) };
    const model = buildDealsPageModel({ deals, filters: defaultFilters, now, awardContext: context });
    assert.deepEqual(model.deals.map(({ id }) => id), ['transfer', 'own']);
    assert.deepEqual(model.unreachableDeals.map(({ id }) => id), ['unreachable', 'unknown']);
    assert.deepEqual(model.kindCounts, { award: 4, cash: 1 });
    assert.equal(model.deals[1].award?.reachability, 'own_balance');
    assert.ok(model.unreachableDeals.every(({ award }) => award?.seal === null));

    const cash = buildDealsPageModel({
      deals, filters: { ...defaultFilters, kind: 'cash' }, now, awardContext: context,
    });
    assert.deepEqual(cash.unreachableDeals, []);
    assert.equal(cash.deals[0].award, null);
    assert.equal(cash.kindCounts.award, 4);
  });

  it('sortiert beide Award-Listen nach Frische, Sparwert mit null zuletzt und bisherigen Kriterien', () => {
    for (const programReachableDach of [true, false]) {
      const awards = [
        createDeal({ id: 'null', savingsPercent: null, dealScore: 100, preferredOriginMatch: true }),
        createDeal({ id: 'negative', savingsPercent: -23, preferredOriginMatch: true }),
        createDeal({ id: 'high', savingsPercent: 40, dealScore: 60 }),
        createDeal({ id: 'fresh', savingsPercent: null, createdAt: now, dealScore: 50 }),
        createDeal({ id: 'equal-preferred', savingsPercent: 40, preferredOriginMatch: true }),
      ].map((deal) => ({ ...deal, source: 'seats_aero', programReachableDach }));
      const model = buildDealsPageModel({ deals: awards, filters: defaultFilters, now, awardContext });
      const list = programReachableDach ? model.deals : model.unreachableDeals;
      assert.deepEqual(list.map(({ id }) => id), ['fresh', 'equal-preferred', 'high', 'negative', 'null']);
    }
  });

  it('sortiert Awards nach Meilen oder Datum und Cash weiter unabhängig vom Sparwert', () => {
    const deals = [
      createDeal({ id: 'cheap', price: 60_000, departureDate: new Date('2026-06-01'), savingsPercent: null, dealScore: 100 }),
      createDeal({ id: 'early', price: 80_000, departureDate: new Date('2026-05-01'), savingsPercent: 80, dealScore: 60 }),
    ];
    for (const reachable of [true, false]) {
      for (const sort of ['price', 'date'] as const) {
        const model = buildDealsPageModel({
          deals: deals.map((deal) => ({ ...deal, source: 'seats_aero', programReachableDach: reachable })),
          filters: { ...defaultFilters, sort }, now, awardContext,
        });
        const list = reachable ? model.deals : model.unreachableDeals;
        assert.deepEqual(list.map(({ id }) => id), sort === 'price' ? ['cheap', 'early'] : ['early', 'cheap']);
      }
    }
    const cash = buildDealsPageModel({ deals, filters: { ...defaultFilters, kind: 'cash' }, now, awardContext });
    assert.deepEqual(cash.deals.map(({ id }) => id), ['cheap', 'early']);
  });
});
