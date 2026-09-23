import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SeatsAeroQuotaExhaustedError } from '@/lib/api/seats-aero-quota';
import { formatAwardQuotaNotice, searchAwardFlights } from './flight-search-award-errors';

const params = { origin: 'FRA', destination: 'JFK', departureDate: '2027-06-15', travelClass: 'BUSINESS' as const };
const resetsAt = new Date('2026-09-24T00:00:00Z');

describe('award search failure metadata', () => {
  it('keeps a successful empty search distinct from a failure', async () => {
    assert.deepEqual(await searchAwardFlights(params, async () => []), { flights: [] });
  });
  it('preserves quota reset details', async () => {
    const result = await searchAwardFlights(params, async () => {
      throw new SeatsAeroQuotaExhaustedError(resetsAt);
    });
    assert.deepEqual(result, { flights: null, errorType: 'rate_limited', resetsAt });
  });
  it('classifies other errors as provider failures', async () => {
    assert.deepEqual(
      await searchAwardFlights(params, async () => {
        throw new Error('network');
      }),
      {
        flights: null,
        errorType: 'provider_unavailable',
      },
    );
  });
  it('propagates cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      searchAwardFlights(
        params,
        async () => {
          throw controller.signal.reason;
        },
        controller.signal,
      ),
      { name: 'AbortError' },
    );
  });
});

describe('award quota notices', () => {
  for (const locale of ['de', 'en'] as const) {
    it(`shows Berlin summer time in ${locale}`, () => assert.match(formatAwardQuotaNotice(resetsAt, locale), /02:00/));
    it(`shows Berlin winter time in ${locale}`, () =>
      assert.match(formatAwardQuotaNotice(new Date('2026-12-01T00:00:00Z'), locale), /01:00/));
    it(`handles unknown reset times in ${locale}`, () => {
      const notice = formatAwardQuotaNotice(null, locale);
      assert.doesNotMatch(notice, /seats\.aero|Invalid Date|\d\d:\d\d/i);
      assert.match(notice, locale === 'de' ? /täglichen Zurücksetzen/ : /daily reset/);
    });
  }
});
