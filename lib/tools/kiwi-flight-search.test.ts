// lib/tools/kiwi-flight-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache } from '@/lib/mcp/http-mcp-tool';
import {
  _internals,
  createKiwiFlightSearchTool,
  kiwiFlightSearchTool,
} from './kiwi-flight-search';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function sseResponse(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream', ...extraHeaders },
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

const FAKE_KIWI_RESULT = {
  content: [{ type: 'text', text: 'Found 2 flights' }],
  structuredContent: {
    flights: [
      { id: 'k1', price: { amount: 380, currency: 'EUR' } },
      { id: 'k2', price: { amount: 420, currency: 'EUR' } },
    ],
  },
};

async function run(rawInput: unknown, fetchImpl?: typeof fetch) {
  const t = fetchImpl ? createKiwiFlightSearchTool({ fetchImpl }) : kiwiFlightSearchTool;
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (t.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (t.execute as any)(parsed, {});
}

describe('kiwiFlightSearchTool — internals', () => {
  it('toEuropeDate converts YYYY-MM-DD to dd/mm/yyyy', () => {
    assert.strictEqual(_internals.toEuropeDate('2026-06-15'), '15/06/2026');
    assert.strictEqual(_internals.toEuropeDate('2026-12-01'), '01/12/2026');
  });

  it('CABIN_CODE maps human names to Kiwi single-letter codes', () => {
    assert.strictEqual(_internals.CABIN_CODE.economy, 'M');
    assert.strictEqual(_internals.CABIN_CODE['premium-economy'], 'W');
    assert.strictEqual(_internals.CABIN_CODE.business, 'C');
    assert.strictEqual(_internals.CABIN_CODE.first, 'F');
  });

  it('buildKiwiArgs nests passengers and translates dates+cabin for one-way', () => {
    const args = _internals.buildKiwiArgs({
      flyFrom: 'FRA',
      flyTo: 'JFK',
      departureDate: '2026-06-15',
      adults: 2,
      children: 1,
      infants: 0,
      cabinClass: 'business',
      sort: 'price',
      currency: 'EUR',
      flexDays: 0,
    });
    assert.strictEqual(args.flyFrom, 'FRA');
    assert.strictEqual(args.departureDate, '15/06/2026');
    assert.strictEqual(args.cabinClass, 'C');
    assert.strictEqual(args.curr, 'EUR');
    assert.strictEqual(args.sort, 'price');
    assert.strictEqual(args.departureDateFlexRange, 0);
    assert.deepStrictEqual(args.passengers, { adults: 2, children: 1, infants: 0 });
    // Round-trip-only fields must be absent
    assert.strictEqual('returnDate' in args, false);
    assert.strictEqual('returnDateFlexRange' in args, false);
  });

  it('buildKiwiArgs adds returnDate + returnDateFlexRange for round trips', () => {
    const args = _internals.buildKiwiArgs({
      flyFrom: 'MUC',
      flyTo: 'BKK',
      departureDate: '2026-09-01',
      returnDate: '2026-09-15',
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: 'economy',
      sort: 'price',
      currency: 'EUR',
      flexDays: 2,
    });
    assert.strictEqual(args.returnDate, '15/09/2026');
    assert.strictEqual(args.returnDateFlexRange, 2);
    assert.strictEqual(args.departureDateFlexRange, 2);
  });
});

describe('kiwiFlightSearchTool', () => {
  afterEach(() => _resetSessionCache());

  it('declares description and zod input schema', () => {
    assert.ok(kiwiFlightSearchTool.description);
    assert.ok(kiwiFlightSearchTool.inputSchema);
  });

  it('initializes session before first tool call (Kiwi requires session header)', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse(
        { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } },
        200,
        { 'mcp-session-id': 'kiwi-sess-123' },
      ),
      sseResponse({ jsonrpc: '2.0', id: 2, result: FAKE_KIWI_RESULT }),
    ]);

    const r = await run(
      { flyFrom: 'FRA', flyTo: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(r.success, true);
    if (r.success) assert.deepStrictEqual(r.result, FAKE_KIWI_RESULT);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(readBody(calls[0]).method, 'initialize');
    assert.strictEqual(readBody(calls[1]).method, 'tools/call');
    assert.strictEqual(readBody(calls[1]).params?.name, 'search-flight');
    const headers = (calls[1].init?.headers ?? {}) as Record<string, string>;
    assert.strictEqual(headers['mcp-session-id'], 'kiwi-sess-123');
  });

  it('translates LLM-shaped input to Kiwi native format end-to-end', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      sseResponse({ jsonrpc: '2.0', id: 2, result: FAKE_KIWI_RESULT }),
    ]);

    await run(
      {
        flyFrom: 'FRA',
        flyTo: 'JFK',
        departureDate: '2026-06-15',
        returnDate: '2026-06-25',
        adults: 2,
        cabinClass: 'business',
        currency: 'USD',
      },
      fetchImpl,
    );

    const args = readBody(calls[1]).params?.arguments ?? {};
    assert.strictEqual(args.departureDate, '15/06/2026');
    assert.strictEqual(args.returnDate, '25/06/2026');
    assert.strictEqual(args.cabinClass, 'C');
    assert.strictEqual(args.curr, 'USD');
    assert.deepStrictEqual(args.passengers, { adults: 2, children: 0, infants: 0 });
  });

  it('applies DACH-friendly defaults: currency=EUR, sort=price, cabin=economy', async () => {
    const { fetchImpl, calls } = mockFetch([
      sseResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      sseResponse({ jsonrpc: '2.0', id: 2, result: FAKE_KIWI_RESULT }),
    ]);

    await run(
      { flyFrom: 'FRA', flyTo: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    const args = readBody(calls[1]).params?.arguments ?? {};
    assert.strictEqual(args.curr, 'EUR');
    assert.strictEqual(args.sort, 'price');
    assert.strictEqual(args.cabinClass, 'M'); // economy
    assert.strictEqual(args.departureDateFlexRange, 0);
  });

  it('returns error when MCP returns JSON-RPC error', async () => {
    const { fetchImpl } = mockFetch([
      sseResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's' },
      ),
      sseResponse({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32602, message: 'Invalid airport code' },
      }),
    ]);

    const r = await run(
      { flyFrom: 'XXX', flyTo: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(r.success, false);
    if (!r.success) assert.match(r.error, /Invalid airport/);
  });

  it('returns error when fetch throws', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const r = await run(
      { flyFrom: 'FRA', flyTo: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );
    assert.strictEqual(r.success, false);
    if (!r.success) assert.match(r.error, /ECONNRESET/);
  });

  it('schema rejects malformed departureDate', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (kiwiFlightSearchTool.inputSchema as any).safeParse({
      flyFrom: 'FRA',
      flyTo: 'JFK',
      departureDate: '15/06/2026', // wrong format - this is Kiwi's format, not ours
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects invalid cabinClass', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (kiwiFlightSearchTool.inputSchema as any).safeParse({
      flyFrom: 'FRA',
      flyTo: 'JFK',
      departureDate: '2026-06-15',
      cabinClass: 'M', // raw Kiwi code rejected — wrapper expects human name
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects flexDays out of range', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (kiwiFlightSearchTool.inputSchema as any).safeParse({
      flyFrom: 'FRA',
      flyTo: 'JFK',
      departureDate: '2026-06-15',
      flexDays: 5,
    });
    assert.strictEqual(parse.success, false);
  });
});
