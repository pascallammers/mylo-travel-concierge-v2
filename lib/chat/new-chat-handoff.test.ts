import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildDealPrefillMessage,
  buildNewChatRedirectUrl,
  buildNewChatHref,
  normalizeNewChatQuery,
  resolveChatNewRequest,
  type NewChatParams,
} from './new-chat-handoff';

describe('normalizeNewChatQuery', () => {
  const cases: [NewChatParams, string][] = [
    [{ query: ' Tokio ', q: 'Paris', prefill: 'Rom', origin: 'FRA' }, 'Tokio'],
    [{ query: ' ', q: ' Paris ', prefill: 'Rom' }, 'Paris'],
    [{ q: '', prefill: ' Rom ', origin: 'FRA' }, 'Rom'],
    [{ origin: ' FRA ', destination: ' HND ' }, 'FRA to HND'],
    [{ origin: ' FRA ' }, 'FRA'],
    [{ destination: ' HND ' }, 'HND'],
    [{ query: [' Tokio ', 'Paris'] }, 'Tokio'],
    [{ prefill: ' ' }, ''],
    [{}, ''],
  ];
  for (const [params, expected] of cases) {
    it(`normalizes ${JSON.stringify(params)}`, () => {
      assert.strictEqual(normalizeNewChatQuery(params), expected);
    });
  }
});

describe('resolveChatNewRequest', () => {
  it('renders without parameters', () => {
    assert.deepStrictEqual(resolveChatNewRequest('de', {}), { kind: 'render' });
  });

  it('renders a single canonical query', () => {
    assert.deepStrictEqual(resolveChatNewRequest('de', { query: 'Flüge nach Tokio' }), { kind: 'render' });
  });

  const cases: [string, NewChatParams, string][] = [
    ['de', { prefill: ' Flüge nach Tokio ' }, '/de/chat/new?query=Fl%C3%BCge+nach+Tokio'],
    ['de', { q: 'Tokio' }, '/de/chat/new?query=Tokio'],
    ['de', { origin: ' FRA ', destination: ' HND ' }, '/de/chat/new?query=FRA+to+HND'],
    ['de', { prefill: '' }, '/de/chat/new'],
    ['de', { prefill: ' ' }, '/de/chat/new'],
    ['de', { query: '' }, '/de/chat/new'],
    ['de', { query: ' Tokio ' }, '/de/chat/new?query=Tokio'],
    ['de', { query: 'Tokio', q: 'Paris' }, '/de/chat/new?query=Tokio'],
    ['de', { query: ['Tokio', 'Paris'] }, '/de/chat/new?query=Tokio'],
    ['de', { unrelated: 'value' }, '/de/chat/new'],
    ['en', { prefill: 'Paris & Rome' }, '/en/chat/new?query=Paris+%26+Rome'],
    ['', { q: 'Tokyo' }, '/en/chat/new?query=Tokyo'],
  ];
  for (const [locale, params, url] of cases) {
    it(`redirects ${locale}: ${JSON.stringify(params)} without a redirect loop`, () => {
      assert.deepStrictEqual(resolveChatNewRequest(locale, params), { kind: 'redirect', url });
      const canonical = new URL(url, 'https://mylo.test');
      assert.deepStrictEqual(resolveChatNewRequest(locale, Object.fromEntries(canonical.searchParams)), { kind: 'render' });
    });
  }
});

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


describe('buildNewChatHref', () => {
  it('encodes the search for the existing new-chat handoff', () => {
    const message = 'FRA → BKK, Business, 2 Reisende & Rückflug';
    const href = buildNewChatHref('de', message);
    const url = new URL(href, 'https://mylo.test');
    assert.equal(url.pathname, '/de/new');
    assert.equal(url.searchParams.get('prefill'), message);
    assert.equal(buildNewChatRedirectUrl('de', Object.fromEntries(url.searchParams)), `/de?${new URLSearchParams({ query: message })}`);
    assert.equal(buildNewChatHref('en', null), '/en/new');
  });
});
