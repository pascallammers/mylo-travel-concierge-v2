// lib/tools/trivago-hotel-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache, McpToolFailure } from '@/lib/mcp/http-mcp-tool';
import {
  _trivagoInternals,
  createTrivagoHotelSearchTool,
  trivagoHotelSearchTool,
} from './trivago-hotel-search';
import { FAKE_TRIVAGO_RESULT } from './trivago-hotel-search.fixture';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
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

const BASE_INPUT = {
  query: 'Berlin-Mitte',
  arrival: '2026-06-15',
  departure: '2026-06-18',
};

async function run(rawInput: unknown, fetchImpl?: typeof fetch) {
  const t = fetchImpl ? createTrivagoHotelSearchTool({ fetchImpl }) : trivagoHotelSearchTool;
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (t.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (t.execute as any)(parsed, {});
}

describe('trivagoHotelSearchTool — internals', () => {
  it('buildHotelRating returns undefined when min is undefined', () => {
    assert.strictEqual(_trivagoInternals.buildHotelRating(undefined), undefined);
  });

  it('buildHotelRating sets keys for stars >= min (inclusive)', () => {
    assert.deepStrictEqual(_trivagoInternals.buildHotelRating(4), {
      '4star': true,
      '5star': true,
    });
    assert.deepStrictEqual(_trivagoInternals.buildHotelRating(3), {
      '3star': true,
      '4star': true,
      '5star': true,
    });
    assert.deepStrictEqual(_trivagoInternals.buildHotelRating(5), { '5star': true });
  });

  it('buildReviewRating maps tier names to Trivago key shape, inclusive', () => {
    assert.strictEqual(_trivagoInternals.buildReviewRating(undefined), undefined);
    assert.deepStrictEqual(_trivagoInternals.buildReviewRating('8.0'), {
      rating80: true,
      rating85: true,
    });
    assert.deepStrictEqual(_trivagoInternals.buildReviewRating('7.0'), {
      rating70: true,
      rating75: true,
      rating80: true,
      rating85: true,
    });
  });

  it('buildTrivagoArgs forwards the place name and forces the German EUR market', () => {
    const args = _trivagoInternals.buildTrivagoArgs({
      ...BASE_INPUT,
      adults: 2,
      children: 0,
      rooms: 1,
      freeCancellation: false,
      breakfastIncluded: false,
    });
    assert.strictEqual(args.query, 'Berlin-Mitte');
    assert.strictEqual('latitude' in args, false);
    assert.strictEqual('longitude' in args, false);
    assert.strictEqual('radius' in args, false);
    assert.strictEqual('radiusMeters' in args, false);
    assert.strictEqual(args.country, 'DE');
    assert.strictEqual(args.currency, 'EUR');
    assert.strictEqual(args.language, 'DE_DE');
    assert.strictEqual(args.arrival, '2026-06-15');
    assert.strictEqual(args.adults, 2);
    // No filters block when both flags are false
    assert.strictEqual('filters' in args, false);
    // No rating blocks when min not specified
    assert.strictEqual('hotel_rating' in args, false);
    assert.strictEqual('review_rating' in args, false);
  });

  it('buildTrivagoArgs adds children_ages, hotel_rating, review_rating, filters when provided', () => {
    const args = _trivagoInternals.buildTrivagoArgs({
      ...BASE_INPUT,
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
      jsonResponse({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }, 200, {
        'mcp-session-id': 'trivago-sess-xyz',
      }),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    const r = await run(BASE_INPUT, fetchImpl);

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Trivago Hotels/);
    assert.match(r, /### 1\. Adina Apartment Hotel Berlin Hackescher Markt/);
    assert.doesNotMatch(r, /```json/);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(readBody(calls[0]).method, 'initialize');
    assert.strictEqual(readBody(calls[1]).params?.name, 'trivago-accommodation-search');
    const headers = (calls[1].init?.headers ?? {}) as Record<string, string>;
    assert.strictEqual(headers['mcp-session-id'], 'trivago-sess-xyz');
  });

  it('translates flat user input to Trivago nested filter shape', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    await run(
      {
        ...BASE_INPUT,
        query: 'München',
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
    assert.strictEqual(args.query, 'München');
    assert.strictEqual(args.country, 'DE');
    assert.strictEqual(args.currency, 'EUR');
    assert.strictEqual(args.language, 'DE_DE');
    assert.strictEqual(args.children_ages, '10');
    assert.deepStrictEqual(args.hotel_rating, { '4star': true, '5star': true });
    assert.deepStrictEqual(args.review_rating, { rating80: true, rating85: true });
    assert.deepStrictEqual(args.filters, {
      freeCancellation: false,
      breakfastIncluded: true,
    });
  });

  it('applies guest defaults and no optional filters', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: FAKE_TRIVAGO_RESULT }),
    ]);

    await run(BASE_INPUT, fetchImpl);

    const args = readBody(calls[1]).params?.arguments ?? {};
    assert.strictEqual('radius' in args, false);
    assert.strictEqual(args.adults, 2);
    assert.strictEqual(args.rooms, 1);
    assert.strictEqual(args.children, 0);
    assert.strictEqual('filters' in args, false);
    assert.strictEqual('hotel_rating' in args, false);
  });

  it('throws McpToolFailure when Trivago returns JSON-RPC error', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32603, message: 'Internal Trivago failure' },
      }),
    ]);

    await assert.rejects(
      run(BASE_INPUT, fetchImpl),
      (error: unknown) =>
        error instanceof McpToolFailure &&
        /## Trivago search unavailable/.test(error.message) &&
        /Internal Trivago failure/.test(error.reason),
    );
  });

  it('throws McpToolFailure when Trivago answers ok with isError: true', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { isError: true, content: [{ type: 'text', text: 'Rate limit exceeded' }] },
      }),
    ]);

    await assert.rejects(
      run(BASE_INPUT, fetchImpl),
      (error: unknown) =>
        error instanceof McpToolFailure &&
        /## Trivago search unavailable/.test(error.message) &&
        error.reason === 'Rate limit exceeded',
    );
  });

  it('throws a sanitized McpToolFailure when fetch throws during init', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNREFUSED https://mcp.trivago.com/private');
    };

    await assert.rejects(
      run(BASE_INPUT, fetchImpl),
      (error: unknown) =>
        error instanceof McpToolFailure &&
        /## Trivago search unavailable/.test(error.message) &&
        /ECONNREFUSED/.test(error.reason) &&
        !/https?:\/\//.test(error.reason) &&
        !/mcp\.trivago\.com/.test(error.reason),
    );
  });

  it('keeps user-readable markdown in the McpToolFailure message', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('boom');
    };

    await assert.rejects(
      run(BASE_INPUT, fetchImpl),
      (error: unknown) =>
        error instanceof McpToolFailure &&
        /##.*unavailable/i.test(error.message) &&
        /Falling back|try again|temporarily/i.test(error.message) &&
        !/"success"\s*:\s*false/.test(error.message) &&
        !/^\s*\{/.test(error.message),
    );
  });

  it('schema takes a place name instead of coordinates', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const schema = trivagoHotelSearchTool.inputSchema as any;
    const dates = { arrival: '2026-06-15', departure: '2026-06-18' };

    assert.strictEqual(schema.safeParse({ latitude: 52.52, longitude: 13.405, ...dates }).success, false);
    assert.strictEqual(schema.safeParse({ query: '   ', ...dates }).success, false);
    const parsed = schema.parse({ query: '  Brandenburger Tor ', latitude: 52.52, ...dates });
    assert.strictEqual(parsed.query, 'Brandenburger Tor');
    assert.strictEqual('latitude' in parsed, false);
  });

  it('schema rejects malformed childrenAges', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      query: 'Berlin',
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
      query: 'Berlin',
      arrival: '2026-06-15',
      departure: '2026-06-18',
      minReviewRating: '9.0', // not in REVIEW_TIERS
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects children > 0 without childrenAges (Trivago needs ages)', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      query: 'Berlin',
      arrival: '2026-06-15',
      departure: '2026-06-18',
      children: 2,
      // childrenAges intentionally missing
    });
    assert.strictEqual(parse.success, false);
    if (!parse.success) {
      const msg = JSON.stringify(parse.error.issues);
      assert.match(msg, /childrenAges is required/);
    }
  });

  it('schema rejects mismatched ages count (children=2 but ages="10")', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      query: 'Berlin',
      arrival: '2026-06-15',
      departure: '2026-06-18',
      children: 2,
      childrenAges: '10', // only 1 age but children=2
    });
    assert.strictEqual(parse.success, false);
    if (!parse.success) {
      const msg = JSON.stringify(parse.error.issues);
      assert.match(msg, /exactly one age per child/);
    }
  });

  it('schema accepts children=0 without childrenAges', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      query: 'Berlin',
      arrival: '2026-06-15',
      departure: '2026-06-18',
      children: 0,
    });
    assert.strictEqual(parse.success, true);
  });

  it('schema accepts matching children count and ages', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (trivagoHotelSearchTool.inputSchema as any).safeParse({
      query: 'Berlin',
      arrival: '2026-06-15',
      departure: '2026-06-18',
      children: 3,
      childrenAges: '8-10-12',
    });
    assert.strictEqual(parse.success, true);
  });

  it('answers "No accommodations found" as a regular empty result, not as an outage', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: 'No accommodations found' }],
          structuredContent: { error: 'No accommodations found' },
        },
      }),
    ]);

    const markdown = await run({ ...BASE_INPUT, query: 'Mauritius Inselmitte' }, fetchImpl);

    assert.strictEqual(typeof markdown, 'string');
    assert.match(markdown, /Ergebnisse:\*\* 0/);
    assert.match(markdown, /anderen oder größeren Ort/);
    assert.doesNotMatch(markdown, /unavailable|try again/i);
  });

  it('treats "No accommodations found" with trailing context as empty, too', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { isError: true, content: [{ type: 'text', text: "No accommodations found for 'Atlantis'." }] },
      }),
    ]);

    assert.match(await run(BASE_INPUT, fetchImpl), /anderen oder größeren Ort/);
  });

  it('still reports other structured Trivago errors as an outage', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200, { 'mcp-session-id': 's' }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { structuredContent: { error: 'Upstream search timed out' } },
      }),
    ]);

    await assert.rejects(
      run(BASE_INPUT, fetchImpl),
      (error: unknown) => error instanceof McpToolFailure && /timed out/.test(error.reason),
    );
  });

});
