import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildTravelpayoutsAffiliateLink } from './travelpayouts-affiliate-link';

describe('buildTravelpayoutsAffiliateLink', () => {
  it('baut einen roundtrip Travelpayouts-Suchlink mit Query-Parametern', () => {
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

    assert.strictEqual(url.origin, 'https://hydra.aviasales.ru');
    assert.strictEqual(url.pathname, '/searches/new');
    assert.strictEqual(url.searchParams.get('origin_iata'), 'FRA');
    assert.strictEqual(url.searchParams.get('destination_iata'), 'PMI');
    assert.strictEqual(url.searchParams.get('depart_date'), '2026-04-17');
    assert.strictEqual(url.searchParams.get('return_date'), '2026-04-20');
    assert.strictEqual(url.searchParams.get('adults'), '2');
    assert.strictEqual(url.searchParams.get('children'), '0');
    assert.strictEqual(url.searchParams.get('infants'), '0');
    assert.strictEqual(url.searchParams.get('trip_class'), '1');
    assert.strictEqual(url.searchParams.get('with_request'), 'true');
    assert.strictEqual(url.searchParams.get('currency'), 'eur');
    assert.strictEqual(url.searchParams.get('locale'), 'de');
    assert.strictEqual(url.searchParams.get('marker'), 'tp-marker-123');
    assert.strictEqual(url.searchParams.get('oneway'), '0');
  });

  it('baut einen oneway Link ohne Return-Date', () => {
    const link = buildTravelpayoutsAffiliateLink({
      origin: 'DUS',
      destination: 'PMI',
      departDate: '2026-05-03',
    });
    const url = new URL(link);

    assert.strictEqual(url.searchParams.get('origin_iata'), 'DUS');
    assert.strictEqual(url.searchParams.get('destination_iata'), 'PMI');
    assert.strictEqual(url.searchParams.get('depart_date'), '2026-05-03');
    assert.strictEqual(url.searchParams.get('return_date'), null);
    assert.strictEqual(url.searchParams.get('adults'), '1');
    assert.strictEqual(url.searchParams.get('trip_class'), '0');
    assert.strictEqual(url.searchParams.get('oneway'), '1');
  });
});
