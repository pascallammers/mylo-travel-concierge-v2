import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { UserDealPreferences } from '@/lib/db/schema';
import {
  createDealPreferenceSnapshot,
  hasActiveDealPreferences,
  parseAirportCodeList,
  resolveAirportCodeList,
  scoreDealForPreferences,
  selectTopPersonalizedDeals,
} from './deal-personalization';

const basePreferences: UserDealPreferences = {
  id: 'prefs-1',
  userId: 'user-1',
  originAirports: ['fra', 'muc'],
  preferredDestinations: ['jfk'],
  cabinClass: 'business',
  maxPrice: 600,
  emailDigest: 'weekly',
  createdAt: new Date('2026-04-10T08:00:00.000Z'),
  updatedAt: new Date('2026-04-10T08:00:00.000Z'),
};

function createDeal(overrides: Record<string, unknown> = {}) {
  return {
    origin: 'FRA',
    destination: 'JFK',
    destinationName: 'New York',
    price: 520,
    currency: 'EUR',
    cabinClass: 'business' as const,
    source: 'travelpayouts',
    dealScore: 84,
    ...overrides,
  };
}

describe('createDealPreferenceSnapshot', () => {
  it('normalisiert gespeicherte IATA-Codes und Defaults', () => {
    const snapshot = createDealPreferenceSnapshot(basePreferences);

    assert.deepStrictEqual(snapshot.originAirports, ['FRA', 'MUC']);
    assert.deepStrictEqual(snapshot.preferredDestinations, ['JFK']);
    assert.strictEqual(snapshot.cabinClass, 'business');
    assert.strictEqual(snapshot.maxPrice, 600);
    assert.strictEqual(snapshot.emailDigest, 'weekly');
  });
});

describe('hasActiveDealPreferences', () => {
  it('erkennt aktive Personalisierungs-Signale', () => {
    assert.strictEqual(hasActiveDealPreferences(createDealPreferenceSnapshot(basePreferences)), true);
    assert.strictEqual(
      hasActiveDealPreferences(
        createDealPreferenceSnapshot({
          ...basePreferences,
          originAirports: [],
          preferredDestinations: [],
          cabinClass: null,
          maxPrice: null,
          emailDigest: 'none',
        }),
      ),
      false,
    );
  });
});

describe('scoreDealForPreferences', () => {
  it('boostet passende Deals und liefert Gruende', () => {
    const score = scoreDealForPreferences(
      createDeal(),
      createDealPreferenceSnapshot(basePreferences),
    );

    assert.ok(score.score > 84);
    assert.ok(score.reasons.some((reason) => reason.includes('Abflug ab FRA')));
    assert.ok(score.reasons.some((reason) => reason.includes('Ziel JFK')));
    assert.ok(score.reasons.some((reason) => reason.includes('Preislimit')));
  });

  it('senkt Cash-Deals deutlich ueber dem Budget ab', () => {
    const score = scoreDealForPreferences(
      createDeal({ price: 950 }),
      createDealPreferenceSnapshot(basePreferences),
    );

    assert.ok(score.score < 84);
  });
});

describe('selectTopPersonalizedDeals', () => {
  it('sortiert die passendsten Deals nach personalisiertem Score', () => {
    const ranked = selectTopPersonalizedDeals(
      [
        createDeal({ destination: 'BCN', destinationName: 'Barcelona', dealScore: 95 }),
        createDeal({ destination: 'JFK', destinationName: 'New York', dealScore: 84 }),
      ],
      createDealPreferenceSnapshot(basePreferences),
    );

    assert.strictEqual(ranked[0]?.deal.destination, 'JFK');
    assert.ok(ranked[0]?.personalization.reasons.length);
  });
});

describe('parseAirportCodeList', () => {
  it('parst kommaseparierte IATA-Codes robust', () => {
    assert.deepStrictEqual(parseAirportCodeList('fra, muc, xx, jfk, FRA'), ['FRA', 'MUC', 'JFK']);
  });
});

describe('resolveAirportCodeList', () => {
  it('loest Staedte und IATA-Codes in speicherbare Flughafenlisten auf', async () => {
    const resolved = await resolveAirportCodeList('Düsseldorf, Palma de Mallorca, dus, ungültig');

    assert.deepStrictEqual(resolved, ['DUS', 'PMI']);
  });
});
