// lib/tools/trivago-hotel-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache } from '@/lib/mcp/http-mcp-tool';
import {
  _internals,
  createTrivagoHotelSearchTool,
  trivagoHotelSearchTool,
} from './trivago-hotel-search';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function mockFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    calls.push({ url, init });
    if (i >= responses.length) {
      throw new Error('unexpected fetch call: no more mock responses');
    }
    const r = responses[i];
    i++;
    return r;
  };
  return { fetchImpl, calls };
}

function readBody(call: FetchCall): {
  method: string;
  params?: { name: string; arguments: Record<string, unknown> };
} {
  return JSON.parse(call.init?.body as string);
}

const FAKE_TRIVAGO_RESULT = {
  accommodations: [
    {
      accommodation_id: 'h1',
      accommodation_name: 'Hotel Adlon',
      address: 'Unter den Linden 77',
      country_city: 'Germany, Berlin',
      currency: 'EUR',
      price_per_night: '€450',
      price_per_stay: '€1350',
      hotel_rating: 5,
    },
  ],
};

async function run(rawInput: unknown, fetchImpl?: typeof fetch) {
  const t = fetchImpl
    ? createTrivagoHotelSearchTool({ fetchImpl })
    : trivagoHotelSearchTool;
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (t.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (t.execute as any)(parsed, {});
}

describe('trivagoHotelSearchTool — internals', () => {
  it('buildHotelRating returns undefined when min is undefined', () => {
    assert.strictEqual(_internals.buildHotelRating(undefined), undefined);
  });

  it('buildHotelRating sets keys for stars >= min (inclusive)', () => {
    assert.deepStrictEqual(_internals.buildHotelRating(4), {
      '4star': true,
      '5star': true,
    });
    assert.deepStrictEqual(_internals.buildHotelRating(3), {
      '3star': true,
      '4star': true,
      '5star': true,
    });
    assert.deepStrictEqual(_internals.buildHotelRating(5), { '5star': true });
  });

  it('buildReviewRating maps tier names to Trivago key shape, inclusive', () => {
    assert.strictEqual(_internals.buildReviewRating(undefined), undefined);
    assert.deepStrictEqual(_internals.buildReviewRating('8.0'), {
      rating80: true,
      rating85: true,
    });
    assert.deepStrictEqual(_internals.buildReviewRating('7.0'), {
      rating70: true,
      rating75: true,
      rating80: true,
      rating85: true,
    });
  });

  it('buildTrivagoArgs flattens base inputs and renames radius', () => {
    const args = _internals.buildTrivagoArgs({
      latitude: 52.52,
      longitude: 13.405,
      radiusMeters: 5000,
      arrival: '2026-06-15',
      departure: '2026-06-18',
      adults: 2,
      children: 0,
      rooms: 1,
      freeCancellation: false,
      breakfastIncluded: false,
    });
    assert.strictEqual(args.latitude, 52.52);
    assert.strictEqual(args.radius, 5000);
    assert.strictEqual('radiusMeters' in args, false);
    assert.strictEqual(args.arrival, '2026-06-15');
    assert.strictEqual(args.adults, 2);
    // No filters block when both flags are false
    assert.strictEqual('filters' in args, false);
    // No rating blocks when min not specified
    assert.strictEqual('hotel_rating' in args, false);
    assert.strictEqual('review_rating' in args, false);
  });

  it('buildTrivagoArgs adds children_ages, hotel_rating, review_rating, filters when provided', () => {
    const args = _internals.buildTrivagoArgs({
      latitude: 52.52,
      longitude: 13.405,
      radiusMeters: 5000,
      arrival: '2026-06-15',
      departure: '2026-06-18',
      adults: 2,
      children: 2,
      childrenAges: '8-12',
      rooms: 1,
      minStars: 4,
      minReviewRating: '8.0',
      freeCancellation: true,
      breakfastIncluded: false,
    });
    assert.strictEqual(args.children_ages, '8-12');
    assert.deepStrictEqual(args.hotel_rating, { '4star': true, '5star': true });
    assert.deepStrictEqual(args.review_rating, { rating80: true, rating85: true });
    assert.deepStrictEqual(args.filters, {
      freeCancellation: true,
      breakfastIncluded: false,
    });
  });
});

describe('trivagoHotelSearchTool', () => {
  afterEach(() => _resetSessionCache());

  it('declares description and zod input schema', () => {
    assert.ok(trivagoHotelSearchTool.description);
    assert.ok(trivagoHotelSearchTool.inputSchema);
  });

  it('initializes Trivago session before tool call (raw JSON, not SSE)', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } },
        200,
        { 'mcp-session-id': 'trivago-sess-xyz' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    const r = await run(
      {
        latitude: 52.52,
        longitude: 13.405,
        arrival: '2026-06-15',
        departure: '2026-06-18',
      },
      fetchImpl,
    );

    assert.strictEqual(r.success, true);
    if (r.success) assert.deepStrictEqual(r.result, FAKE_TRIVAGO_RESULT);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(readBody(calls[0]).method, 'initialize');
    assert.strictEqual(readBody(calls[1]).params?.name, 'trivago-accommodation-radius-search');
    const headers = (calls[1].init?.headers ?? {}) as Record<string, string>;
    assert.strictEqual(headers['mcp-session-id'], 'trivago-sess-xyz');
  });

  it('translates flat user input to Trivago nested filter shape', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    await run(
      {
        latitude: 48.137,
        longitude: 11.575,
        radiusMeters: 3000,
        arrival: '2026-09-01',
        departure: '2026-09-05',
        adults: 2,
        children: 1,
        childrenAges: '10',
        minStars: 4,
        minReviewRating: '8.0',
        breakfastIncluded: true,
      },
      fetchImpl,
    );

    const args = readBody(calls[1]).params?.arguments ?? {};
    assert.strictEqual(args.radius, 3000);
    assert.strictEqual(args.children_ages, '10');
    assert.deepStrictEqual(args.hotel_rating, { '4star': true, '5star': true });
    assert.deepStrictEqual(args.review_rating, { rating80: true, rating85: true });
    assert.deepStrictEqual(args.filters, {
      freeCancellation: false,
      breakfastIncluded: true,
    });
  });

  it('applies DACH-friendly defaults: radius=5km, adults=2, rooms=1, no filters set', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    await run(
      {
        latitude: 52.52,
        longitude: 13.405,
        arrival: '2026-06-15',
        departure: '2026-06-18',
      },
      fetchImpl,
    );

    const args = readBody(calls[1]).params?.arguments ?? {};
    assert.strictEqual(args.radius, 5000);
    assert.strictEqual(args.adults, 2);
    assert.strictEqual(args.rooms, 1);
    assert.strictEqual(args.children, 0);
    assert.strictEqual('filters' in args, false);
    assert.strictEqual('hotel_rating' in args, false);
  });

  it('returns error when Trivago returns JSON-RPC error', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32603, message: 'Internal Trivago failure' },
      }),
    ]);

    const r = await run(
      {
        latitude: 52.52,
        longitude: 13.405,
        arrival: '2026-06-15',
        departure: '2026-06-18',
      },
      fetchImpl,
    );

    assert.strictEqual(r.success, false);
    if (!r.success) assert.match(r.error, /Internal Trivago failure/);
  });

  it('returns error when fetch throws during init', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const r = await run(
      {
        latitude: 52.52,
        longitude: 13.405,
        arrival: '2026-06-15',
        departure: '2026-06-18',
      },
      fetchImpl,
    );
    assert.strictEqual(r.success, false);
    if (!r.success) assert.match(r.error, /ECONNREFUSED/);
  });

  it('schema rejects out-of-range latitude', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      latitude: 999,
      longitude: 0,
      arrival: '2026-06-15',
      departure: '2026-06-18',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects radius below 500m', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      latitude: 52.52,
      longitude: 13.405,
      radiusMeters: 100,
      arrival: '2026-06-15',
      departure: '2026-06-18',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects malformed childrenAges', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      latitude: 52.52,
      longitude: 13.405,
      arrival: '2026-06-15',
      departure: '2026-06-18',
      children: 1,
      childrenAges: '10,12', // commas not allowed — must be dashes
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects invalid minReviewRating value', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      latitude: 52.52,
      longitude: 13.405,
      arrival: '2026-06-15',
      departure: '2026-06-18',
      minReviewRating: '9.0', // not in REVIEW_TIERS
    });
    assert.strictEqual(parse.success, false);
  });
});
