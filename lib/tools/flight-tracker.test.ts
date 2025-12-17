import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flightTrackerTool } from './flight-tracker';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function makeMockResponse(body: unknown, init?: { ok?: boolean; status?: number }): MockFetchResponse {
  const status = init?.status ?? (init?.ok === false ? 400 : 200);
  const ok = init?.ok ?? (status >= 200 && status < 300);

  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function setDateNow(iso: string): () => void {
  const original = Date.now;
  const ms = new Date(iso).getTime();
  Date.now = () => ms;
  return () => {
    Date.now = original;
  };
}

test('track_flight: returns delayed scheduled data and extracts gate/terminal', async () => {
  const restoreNow = setDateNow('2025-12-17T10:00:00+01:00');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/v1/security/oauth2/token')) {
      return makeMockResponse({ access_token: 'token' }) as unknown as Response;
    }

    if (url.includes('/v2/schedule/flights')) {
      return makeMockResponse({
        data: [
          {
            scheduledDepartureDate: '2025-12-17',
            flightPoints: [
              {
                iataCode: 'DUS',
                departure: {
                  timings: [
                    { qualifier: 'STD', value: '2025-12-17T11:05:00+01:00' },
                    { qualifier: 'ETD', value: '2025-12-17T11:35:00+01:00' },
                  ],
                  terminal: { code: 'B' },
                  gate: 'B53',
                },
              },
              {
                iataCode: 'HEL',
                arrival: {
                  timings: [
                    { qualifier: 'STA', value: '2025-12-17T13:25:00+02:00' },
                    { qualifier: 'ETA', value: '2025-12-17T13:55:00+02:00' },
                  ],
                  terminal: '2',
                  gate: { code: '21' },
                },
              },
            ],
            legs: [
              {
                scheduledLegDuration: 'PT2H20M',
                aircraftEquipment: { aircraftType: '319' },
              },
            ],
            segments: [
              {
                partnership: { operatingFlight: { carrierCode: 'JL', flightNumber: 6820 } },
                scheduledSegmentDuration: 'PT2H20M',
              },
            ],
          },
        ],
      }) as unknown as Response;
    }

    return makeMockResponse({ error: 'unexpected url' }, { ok: false, status: 500 }) as unknown as Response;
  }) as typeof fetch;

  try {
    const result = await flightTrackerTool.execute({
      carrierCode: 'AY',
      flightNumber: '1392',
      scheduledDepartureDate: '2025-12-17',
    });

    assert.equal(result.data[0]?.flight_status, 'scheduled');
    assert.equal(result.data[0]?.departure.delay, 30);
    assert.equal(result.data[0]?.departure.terminal, 'B');
    assert.equal(result.data[0]?.departure.gate, 'B53');
    assert.equal(result.data[0]?.arrival.terminal, '2');
    assert.equal(result.data[0]?.arrival.gate, '21');

    // Best-known time should use ETD/ETA
    assert.equal(result.data[0]?.departure.scheduled, '2025-12-17T11:35:00+01:00');
    assert.equal(result.data[0]?.arrival.scheduled, '2025-12-17T13:55:00+02:00');
  } finally {
    globalThis.fetch = originalFetch;
    restoreNow();
  }
});

test('track_flight: derives active when current time is between departure and arrival', async () => {
  const restoreNow = setDateNow('2025-12-17T12:00:00+01:00');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/v1/security/oauth2/token')) {
      return makeMockResponse({ access_token: 'token' }) as unknown as Response;
    }

    if (url.includes('/v2/schedule/flights')) {
      return makeMockResponse({
        data: [
          {
            scheduledDepartureDate: '2025-12-17',
            flightPoints: [
              {
                iataCode: 'DUS',
                departure: {
                  timings: [
                    { qualifier: 'STD', value: '2025-12-17T11:05:00+01:00' },
                    { qualifier: 'ATD', value: '2025-12-17T11:10:00+01:00' },
                  ],
                },
              },
              {
                iataCode: 'HEL',
                arrival: {
                  timings: [
                    { qualifier: 'STA', value: '2025-12-17T13:25:00+02:00' },
                    { qualifier: 'ETA', value: '2025-12-17T13:30:00+02:00' },
                  ],
                },
              },
            ],
          },
        ],
      }) as unknown as Response;
    }

    return makeMockResponse({ error: 'unexpected url' }, { ok: false, status: 500 }) as unknown as Response;
  }) as typeof fetch;

  try {
    const result = await flightTrackerTool.execute({
      carrierCode: 'AY',
      flightNumber: '1392',
      scheduledDepartureDate: '2025-12-17',
    });

    assert.equal(result.data[0]?.flight_status, 'active');
  } finally {
    globalThis.fetch = originalFetch;
    restoreNow();
  }
});

test('track_flight: derives landed when ATA is present', async () => {
  const restoreNow = setDateNow('2025-12-17T16:00:00+02:00');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/v1/security/oauth2/token')) {
      return makeMockResponse({ access_token: 'token' }) as unknown as Response;
    }

    if (url.includes('/v2/schedule/flights')) {
      return makeMockResponse({
        data: [
          {
            scheduledDepartureDate: '2025-12-17',
            flightPoints: [
              {
                iataCode: 'DUS',
                departure: {
                  timings: [{ qualifier: 'STD', value: '2025-12-17T11:05:00+01:00' }],
                },
              },
              {
                iataCode: 'HEL',
                arrival: {
                  timings: [
                    { qualifier: 'STA', value: '2025-12-17T13:25:00+02:00' },
                    { qualifier: 'ATA', value: '2025-12-17T13:22:00+02:00' },
                  ],
                },
              },
            ],
          },
        ],
      }) as unknown as Response;
    }

    return makeMockResponse({ error: 'unexpected url' }, { ok: false, status: 500 }) as unknown as Response;
  }) as typeof fetch;

  try {
    const result = await flightTrackerTool.execute({
      carrierCode: 'AY',
      flightNumber: '1392',
      scheduledDepartureDate: '2025-12-17',
    });

    assert.equal(result.data[0]?.flight_status, 'landed');
  } finally {
    globalThis.fetch = originalFetch;
    restoreNow();
  }
});
