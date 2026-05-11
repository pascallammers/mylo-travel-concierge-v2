import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recoverPartialOutput, resolveRecoveryLocale, shouldForceSynthesisFailure } from './stream-failure-recovery';
import { ToolResultCache } from './tool-result-cache';

describe('recoverPartialOutput', () => {
  it('returns null for empty cache plus failure', () => {
    assert.equal(recoverPartialOutput(new Map(), 'error', 'en'), null);
  });

  it('renders one cached tool result with localized header and footer on error', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', { ok: true });

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.ok(recovered);
    assert.match(recovered.content, /The final summary could not be generated/);
    assert.match(recovered.content, /search_flights/);
    assert.match(recovered.content, /"ok": true/);
    assert.match(recovered.content, /Please try again/);
  });

  it('renders multiple tool results in arrival order', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'kiwi_flight_search', 'call-1', 'first');
    cache.set('stream-1', 'search_flights', 'call-2', 'second');
    cache.set('stream-1', 'skiplagged_flight_search', 'call-3', 'third');

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.ok(recovered);
    assert.ok(
      recovered.content.indexOf('first') <
        recovered.content.indexOf('second') &&
        recovered.content.indexOf('second') < recovered.content.indexOf('third'),
    );
  });

  it('returns null for normal stop finish reason', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', 'result');

    assert.equal(recoverPartialOutput(cache.get('stream-1'), 'stop', 'en'), null);
  });

  it('returns null for user abort finish reason', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', 'result');

    assert.equal(recoverPartialOutput(cache.get('stream-1'), 'abort', 'en'), null);
  });

  it('localizes German versus English header and footer', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', 'result');

    const de = recoverPartialOutput(cache.get('stream-1'), 'error', 'de');
    const en = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.ok(de);
    assert.ok(en);
    assert.match(de.content, /Die finale Auswertung konnte nicht generiert werden/);
    assert.match(en.content, /The final summary could not be generated/);
    assert.notEqual(de.content, en.content);
  });

  it('skips non-allowlisted tools to prevent leaking internal tool output', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'unknown_tool', 'call-1', { secret: 'leak' });

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.equal(recovered, null);
  });

  it('renders only allowlisted tools when mixed with non-allowlisted ones', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'memory_search', 'call-1', { secret: 'leak' });
    cache.set('stream-1', 'search_flights', 'call-2', 'flight-data');

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.ok(recovered);
    assert.match(recovered.content, /search_flights/);
    assert.match(recovered.content, /flight-data/);
    assert.doesNotMatch(recovered.content, /memory_search/);
    assert.doesNotMatch(recovered.content, /leak/);
  });

  it('honors test-only renderer overrides for custom allowlisting', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'custom_tool', 'call-1', 'custom-output');

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en', {
      renderers: { custom_tool: (r) => String(r) },
    });

    assert.ok(recovered);
    assert.match(recovered.content, /custom_tool/);
    assert.match(recovered.content, /custom-output/);
  });

  it('uses dedicated Skiplagged renderer instead of JSON fallback', () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'skiplagged_flight_search', 'call-1', {
      structuredContent: {
        searchUrl: 'https://skiplagged.com/flights/FRA/JFK/2026-06-15',
        flights: [
          {
            airlines: 'LH',
            departure: { airport: 'FRA', dateTime: '2026-06-15T08:35:00+02:00' },
            arrival: { airport: 'JFK', dateTime: '2026-06-15T11:20:00-04:00' },
            duration: '8h 45m',
            layovers: 0,
            price: { amount: 399, currency: 'EUR' },
            deepLink: 'https://skiplagged.com/deeplink',
            hiddenCity: false,
          },
        ],
      },
    });

    const recovered = recoverPartialOutput(cache.get('stream-1'), 'error', 'en');

    assert.ok(recovered);
    assert.match(recovered.content, /Skiplagged Flights/);
    assert.match(recovered.content, /LH/);
    assert.doesNotMatch(recovered.content, /```json/);
  });
});

describe('recovery helpers', () => {
  it('resolves de locale from referer path', () => {
    assert.equal(resolveRecoveryLocale('https://example.com/de/new'), 'de');
    assert.equal(resolveRecoveryLocale('https://example.com/en/new'), 'en');
  });

  it('allows smoke-test failure only outside production', () => {
    const headers = new Headers({ 'x-mylo-force-synthesis-failure': '1' });

    assert.equal(shouldForceSynthesisFailure(headers, 'development', undefined), true);
    assert.equal(shouldForceSynthesisFailure(headers, 'production', 'true'), false);
  });
});
