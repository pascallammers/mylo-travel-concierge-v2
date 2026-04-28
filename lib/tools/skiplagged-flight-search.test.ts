// lib/tools/skiplagged-flight-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache } from '@/lib/mcp/http-mcp-tool';
import {
  createSkiplaggedFlightSearchTool,
  skiplaggedFlightSearchTool,
} from './skiplagged-flight-search';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function sseResponse(payload: unknown, status = 200): Response {
  const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
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
      throw new Error(`unexpected fetch call: no more mock responses`);
    }
    const r = responses[i];
    i++;
    return r;
  };
  return { fetchImpl, calls };
}

function readBody(call: FetchCall): {
  method: string;
  params: { name: string; arguments: Record<string, unknown> };
} {
  return JSON.parse(call.init?.body as string);
}

const FAKE_FLIGHTS_RESULT = {
  content: [{ type: 'text', text: 'Found 3 flights' }],
  structuredContent: {
    searchUrl: 'https://skiplagged.com/...',
    flights: [
      {
        type: 'FlightCard',
        id: 'f1',
        airlines: 'LH',
        departure: { airport: 'FRA', dateTime: '2026-06-15T10:00' },
        arrival: { airport: 'JFK', dateTime: '2026-06-15T13:30' },
        duration: '8h 30m',
        layovers: 0,
        price: { amount: 450, currency: 'EUR' },
        deepLink: 'https://skiplagged.com/...',
      },
    ],
    pagination: { totalAvailable: 50, currentlyShowing: 1, offset: 0, limit: 8, hasMoreResults: true },
  },
};

async function run(rawInput: unknown, fetchImpl?: typeof fetch) {
  const t = fetchImpl ? createSkiplaggedFlightSearchTool({ fetchImpl }) : skiplaggedFlightSearchTool;
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (t.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (t.execute as any)(parsed, {});
}

describe('skiplaggedFlightSearchTool', () => {
  afterEach(() => _resetSessionCache());

  it('declares description and zod input schema', () => {
    assert.ok(skiplaggedFlightSearchTool.description);
    assert.ok(skiplaggedFlightSearchTool.inputSchema);
  });

  it('returns success with parsed result on happy path (SSE response)', async () => {
    const { fetchImpl } = mockFetch([
      sseResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FLIGHTS_RESULT }),
    ]);

    const r = await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.deepStrictEqual(r.result, FAKE_FLIGHTS_RESULT);
    }
  });

  it('sends POST to Skiplagged MCP endpoint with tools/call payload', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FLIGHTS_RESULT }),
    ]);

    await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, 'https://mcp.skiplagged.com/mcp');
    assert.strictEqual((calls[0].init?.method ?? '').toUpperCase(), 'POST');
    const body = readBody(calls[0]);
    assert.strictEqual(body.method, 'tools/call');
    assert.strictEqual(body.params.name, 'sk_flights_search');
    assert.strictEqual(body.params.arguments.origin, 'FRA');
    assert.strictEqual(body.params.arguments.destination, 'JFK');
    assert.strictEqual(body.params.arguments.departureDate, '2026-06-15');
  });

  it('applies DACH-friendly defaults: adults=1, children=0, fareClass=economy, limit=8, includeHiddenCity=true', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FLIGHTS_RESULT }),
    ]);

    await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    const args = readBody(calls[0]).params.arguments;
    assert.strictEqual(args.adults, 1);
    assert.strictEqual(args.children, 0);
    assert.strictEqual(args.fareClass, 'economy');
    assert.strictEqual(args.limit, 8);
    assert.strictEqual(args.includeHiddenCity, true);
  });

  it('passes through user-supplied fareClass and maxStops', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FLIGHTS_RESULT }),
    ]);

    await run(
      {
        origin: 'MUC',
        destination: 'BKK',
        departureDate: '2026-09-01',
        returnDate: '2026-09-15',
        fareClass: 'business',
        maxStops: 'one',
        adults: 2,
      },
      fetchImpl,
    );

    const args = readBody(calls[0]).params.arguments;
    assert.strictEqual(args.fareClass, 'business');
    assert.strictEqual(args.maxStops, 'one');
    assert.strictEqual(args.adults, 2);
    assert.strictEqual(args.returnDate, '2026-09-15');
  });

  it('returns error response when MCP returns JSON-RPC error', async () => {
    const { fetchImpl } = mockFetch([
      sseResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Invalid IATA code' },
      }),
    ]);

    const r = await run(
      { origin: 'XXX', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(r.success, false);
    if (!r.success) {
      assert.match(r.error, /Invalid IATA/);
    }
  });

  it('returns error when fetch throws (network failure)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ENETUNREACH');
    };

    const r = await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(r.success, false);
    if (!r.success) {
      assert.match(r.error, /ENETUNREACH/);
    }
  });

  it('schema rejects malformed departureDate before execute runs', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (skiplaggedFlightSearchTool.inputSchema as any).safeParse({
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2026/06/15',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects empty origin', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (skiplaggedFlightSearchTool.inputSchema as any).safeParse({
      origin: '',
      destination: 'JFK',
      departureDate: '2026-06-15',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects adults out of range', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (skiplaggedFlightSearchTool.inputSchema as any).safeParse({
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2026-06-15',
      adults: 10,
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects invalid maxStops value', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (skiplaggedFlightSearchTool.inputSchema as any).safeParse({
      origin: 'FRA',
      destination: 'JFK',
      departureDate: '2026-06-15',
      maxStops: 'two',
    });
    assert.strictEqual(parse.success, false);
  });
});
