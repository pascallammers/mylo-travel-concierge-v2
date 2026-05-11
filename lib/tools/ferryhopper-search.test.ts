// lib/tools/ferryhopper-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache } from '@/lib/mcp/http-mcp-tool';
import {
  createFerryhopperSearchTool,
  ferryhopperSearchTool,
} from './ferryhopper-search';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

const FAKE_FERRY_RESULT = {
  foundDirectItinerariesForTrip: [
    {
      segments: [
        {
          vehicleIsMandatory: false,
          departurePort: { name: 'Piraeus' },
          arrivalPort: { name: 'Mykonos' },
          departureDateTime: '2026-07-15T07:30:00+03:00',
          arrivalDateTime: '2026-07-15T13:00:00+03:00',
          ownerCompany: { name: 'Blue Star Ferries' },
          marketingCompany: { name: 'Blue Star Ferries', iconURL: 'https://...' },
          vessel: { name: 'Blue Star Delos' },
          accommodations: [
            { type: 'DECK', expectedPrice: { totalPriceInCents: 4500 } },
          ],
        },
      ],
      hasVehicles: true,
      hasPets: true,
      hasETicket: true,
      deepLink: 'https://www.ferryhopper.com/...',
    },
  ],
};

async function run(rawInput: unknown, fetchImpl?: typeof fetch) {
  const t = fetchImpl ? createFerryhopperSearchTool({ fetchImpl }) : ferryhopperSearchTool;
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (t.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (t.execute as any)(parsed, {});
}

describe('ferryhopperSearchTool', () => {
  afterEach(() => _resetSessionCache());

  it('declares description and zod input schema', () => {
    assert.ok(ferryhopperSearchTool.description);
    assert.ok(ferryhopperSearchTool.inputSchema);
  });

  it('passes input straight through to search_trips (no translation)', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FERRY_RESULT }),
    ]);

    const r = await run(
      {
        departureLocation: 'Athens',
        arrivalLocation: 'Mykonos',
        date: '2026-07-15',
      },
      fetchImpl,
    );

    // Tool now returns a markdown string in both success and failure cases.
    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Ferryhopper Trips/);
    assert.match(r, /```json/);
    assert.match(r, /Blue Star Ferries/);
    assert.strictEqual(calls.length, 1); // stateless — no init call
    assert.strictEqual(calls[0].url, 'https://mcp.ferryhopper.com/mcp');
    const body = readBody(calls[0]);
    assert.strictEqual(body.method, 'tools/call');
    assert.strictEqual(body.params?.name, 'search_trips');
    assert.deepStrictEqual(body.params?.arguments, {
      departureLocation: 'Athens',
      arrivalLocation: 'Mykonos',
      date: '2026-07-15',
    });
  });

  it('returns markdown error string when MCP returns JSON-RPC error', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'No ferry route between these ports' },
      }),
    ]);

    const r = await run(
      {
        departureLocation: 'Athens',
        arrivalLocation: 'Tokyo',
        date: '2026-07-15',
      },
      fetchImpl,
    );

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Ferryhopper search unavailable/);
    assert.match(r, /No ferry route/);
  });

  it('returns markdown error string when fetch throws', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ETIMEDOUT');
    };
    const r = await run(
      {
        departureLocation: 'Athens',
        arrivalLocation: 'Mykonos',
        date: '2026-07-15',
      },
      fetchImpl,
    );
    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Ferryhopper search unavailable/);
    assert.match(r, /ETIMEDOUT/);
  });

  it('error response is a markdown string with user-readable language, no raw JSON object', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('boom');
    };

    const r = await run(
      {
        departureLocation: 'Athens',
        arrivalLocation: 'Mykonos',
        date: '2026-07-15',
      },
      fetchImpl,
    );

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /##.*unavailable/i);
    assert.match(r, /Falling back|try again|temporarily/i);
    assert.doesNotMatch(r, /"success"\s*:\s*false/);
    assert.doesNotMatch(r, /^\s*\{/);
  });

  it('schema rejects malformed date', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (ferryhopperSearchTool.inputSchema as any).safeParse({
      departureLocation: 'Athens',
      arrivalLocation: 'Mykonos',
      date: 'July 15 2026',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects empty departureLocation', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (ferryhopperSearchTool.inputSchema as any).safeParse({
      departureLocation: '',
      arrivalLocation: 'Mykonos',
      date: '2026-07-15',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects empty arrivalLocation', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (ferryhopperSearchTool.inputSchema as any).safeParse({
      departureLocation: 'Athens',
      arrivalLocation: '',
      date: '2026-07-15',
    });
    assert.strictEqual(parse.success, false);
  });
});
