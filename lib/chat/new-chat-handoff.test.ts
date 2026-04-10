import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildDealPrefillMessage, buildNewChatRedirectUrl } from './new-chat-handoff';

describe('buildNewChatRedirectUrl', () => {
  it('prefers explicit query parameters', () => {
    const result = buildNewChatRedirectUrl('de', {
      query: 'Business Class Deals nach Tokio',
      origin: 'FRA',
      destination: 'HND',
    });

    assert.strictEqual(result, '/de?query=Business+Class+Deals+nach+Tokio');
  });

  it('falls back to prefill parameter', () => {
    const result = buildNewChatRedirectUrl('en', {
      prefill: 'Best flights from BER to JFK',
    });

    assert.strictEqual(result, '/en?query=Best+flights+from+BER+to+JFK');
  });

  it('builds a route query from origin and destination', () => {
    const result = buildNewChatRedirectUrl('de', {
      origin: 'MUC',
      destination: 'LAX',
    });

    assert.strictEqual(result, '/de?query=MUC+to+LAX');
  });

  it('returns the localized root when no handoff data is present', () => {
    const result = buildNewChatRedirectUrl('de', {});

    assert.strictEqual(result, '/de');
  });
});

describe('buildDealPrefillMessage', () => {
  it('builds a rich prefill message from a cash deal', () => {
    const result = buildDealPrefillMessage({
      origin: 'FRA',
      destinationName: 'Palma de Mallorca',
      price: 220,
      averagePrice: 615,
      currency: 'EUR',
      travelMonthLabel: 'April 2026',
    });

    assert.match(result, /FRA → Palma de Mallorca/i);
    assert.match(result, /220 EUR/i);
    assert.match(result, /statt 615/i);
    assert.match(result, /April 2026/i);
    assert.match(result, /Ist das ein guter Deal\?/i);
  });

  it('omits the average-price fragment when no comparison exists', () => {
    const result = buildDealPrefillMessage({
      origin: 'BER',
      destinationName: 'Seoul',
      price: 48000,
      averagePrice: null,
      currency: 'PTS',
      travelMonthLabel: 'Juni 2026',
    });

    assert.doesNotMatch(result, /statt/i);
    assert.match(result, /48000 Punkte/i);
  });
});
