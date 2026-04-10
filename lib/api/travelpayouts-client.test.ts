import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildTravelpayoutsAffiliateLink,
  resolveTravelpayoutsLocalization,
} from './travelpayouts-affiliate-link';

describe('buildTravelpayoutsAffiliateLink', () => {
  it('baut einen kompakten Aviasales-Roundtrip-Link', () => {
    const link = buildTravelpayoutsAffiliateLink({
      origin: 'fra',
      destination: 'pmi',
      departDate: '2026-04-17',
      returnDate: '2026-04-20',
      adults: 2,
      tripClass: 1,
      marker: 'tp-marker-123',
      locale: 'de',
      currency: 'EUR',
    });
    const url = new URL(link);

    assert.strictEqual(url.origin, 'https://www.aviasales.com');
    assert.strictEqual(url.pathname, '/search/FRA1704PMI2004c2');
    assert.strictEqual(url.searchParams.get('locale'), 'de');
    assert.strictEqual(url.searchParams.get('marker'), 'tp-marker-123');
    assert.strictEqual(url.searchParams.get('currency'), 'EUR');
  });

  it('baut einen kompakten Aviasales-Oneway-Link ohne Return-Date', () => {
    const link = buildTravelpayoutsAffiliateLink({
      origin: 'DUS',
      destination: 'PMI',
      departDate: '2026-05-03',
    });
    const url = new URL(link);

    assert.strictEqual(url.origin, 'https://www.aviasales.com');
    assert.strictEqual(url.pathname, '/search/DUS0305PMI1');
  });
});

describe('resolveTravelpayoutsLocalization', () => {
  it('mapped deutsche Lokalisierung auf EUR und de', () => {
    assert.deepStrictEqual(resolveTravelpayoutsLocalization('de'), {
      locale: 'de',
      currency: 'EUR',
    });
  });

  it('mapped englische und unbekannte Lokalisierung auf USD und en', () => {
    assert.deepStrictEqual(resolveTravelpayoutsLocalization('en'), {
      locale: 'en',
      currency: 'USD',
    });
    assert.deepStrictEqual(resolveTravelpayoutsLocalization(undefined), {
      locale: 'en',
      currency: 'USD',
    });
  });
});
