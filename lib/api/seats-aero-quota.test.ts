import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasScannerBudget, parseSeatsAeroQuota, SeatsAeroQuotaExhaustedError } from './seats-aero-quota';

const now = new Date('2026-09-23T15:01:00Z');
const validHeaders = { 'x-ratelimit-limit': '1000', 'x-ratelimit-remaining': '512', 'x-ratelimit-reset': '32340' };

describe('parseSeatsAeroQuota', () => {
  it('turns the observed reset duration into an absolute date', () => {
    assert.deepEqual(parseSeatsAeroQuota(new Headers(validHeaders), now), {
      limit: 1000,
      remaining: 512,
      resetsAt: new Date('2026-09-24T00:00:00Z'),
    });
  });
  for (const name of Object.keys(validHeaders)) {
    for (const value of [null, '', 'garbage', '-1', 'Infinity', 'NaN']) {
      it(`rejects ${name} = ${String(value)}`, () => {
        const headers = new Headers(validHeaders);
        if (value === null) headers.delete(name);
        else headers.set(name, value);
        assert.equal(parseSeatsAeroQuota(headers, now), null);
      });
    }
  }
  it('accepts zero values', () => {
    const headers = new Headers(Object.fromEntries(Object.keys(validHeaders).map((name) => [name, '0'])));
    assert.deepEqual(parseSeatsAeroQuota(headers, now), { limit: 0, remaining: 0, resetsAt: now });
  });
});

describe('hasScannerBudget', () => {
  const quota = { limit: 1000, remaining: 303, resetsAt: now };
  it('allows a step that leaves exactly the reserve', () => assert.equal(hasScannerBudget(quota, 3), true));
  it('rejects a step that would dip into the reserve', () => assert.equal(hasScannerBudget(quota, 4), false));
  it('rejects spending when already at the reserve', () =>
    assert.equal(hasScannerBudget({ ...quota, remaining: 300 }, 1), false));
  it('allows unknown quota', () => assert.equal(hasScannerBudget(null, 3), true));
  it('honors a custom reserve', () => assert.equal(hasScannerBudget(quota, 3, 301), false));
});

it('preserves the reset time on a recognizable quota error', () => {
  const error = new SeatsAeroQuotaExhaustedError(now);
  assert.ok(error instanceof Error);
  assert.equal(error.resetsAt, now);
  assert.equal(new SeatsAeroQuotaExhaustedError().resetsAt, null);
});
