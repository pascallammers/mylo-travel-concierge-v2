// lib/tools/skiplagged-flight-search.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache } from '@/lib/mcp/http-mcp-tool';
import {
  createSkiplaggedFlightSearchTool,
  formatSkiplaggedResults,
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

  it('returns formatted markdown string on happy path (SSE response)', async () => {
    const { fetchImpl } = mockFetch([
      sseResponse({ jsonrpc: '2.0', id: 1, result: FAKE_FLIGHTS_RESULT }),
    ]);

    const r = await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    // Result is a formatted markdown string in both success and error cases.
    // The LLM can pass this through verbatim (NO-HALLUCINATION rule applies).
    assert.strictEqual(typeof r, 'string');
    assert.match(r, /Skiplagged/);
    assert.match(r, /FRA/);
    assert.match(r, /JFK/);
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

  it('returns markdown error string when MCP returns JSON-RPC error', async () => {
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

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Skiplagged search unavailable/);
    assert.match(r, /Invalid IATA/);
  });

  it('returns markdown error string when fetch throws (network failure)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ENETUNREACH');
    };

    const r = await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /## Skiplagged search unavailable/);
    assert.match(r, /ENETUNREACH/);
  });

  it('error response is a markdown string with user-readable language, no raw JSON object', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('boom');
    };

    const r = await run(
      { origin: 'FRA', destination: 'JFK', departureDate: '2026-06-15' },
      fetchImpl,
    );

    assert.strictEqual(typeof r, 'string');
    assert.match(r, /##.*unavailable/i);
    assert.match(r, /Falling back|try again|temporarily/i);
    // Must NOT look like a `{ success: false, error: ... }` JSON envelope.
    assert.doesNotMatch(r, /"success"\s*:\s*false/);
    assert.doesNotMatch(r, /^\s*\{/);
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

describe('formatSkiplaggedResults — markdown contract', () => {
  // Pin down the rendering so the LLM cannot hallucinate <br/>, double-labels,
  // or fabricate a Source attribution.
  const sampleRaw = {
    content: [{ type: 'text', text: 'Found 2 flights' }],
    structuredContent: {
      searchUrl: 'https://skiplagged.com/flights/FRA/JFK/2026-06-15',
      flights: [
        {
          type: 'FlightCard',
          id: 'f-sq26',
          airlines: 'Singapore Airlines',
          departure: { airport: 'FRA', dateTime: '2026-06-15T08:35:00+02:00' },
          arrival: { airport: 'JFK', dateTime: '2026-06-15T11:10:00-04:00' },
          duration: '8h 35m',
          layovers: 0,
          price: { amount: 413, currency: 'USD' },
          deepLink: 'https://skiplagged.com/flights/FRA/JFK/2026-06-15#trip=SQ26',
        },
        {
          type: 'FlightCard',
          id: 'f-lh400h',
          airlines: 'Lufthansa',
          departure: { airport: 'FRA', dateTime: '2026-06-15T10:55:00+02:00' },
          arrival: { airport: 'JFK', dateTime: '2026-06-15T13:35:00-04:00' },
          duration: '8h 40m',
          layovers: 0,
          price: { amount: 1830, currency: 'USD' },
          deepLink: 'https://skiplagged.com/flights/FRA/JFK/2026-06-15#trip=LH400~',
          hiddenCity: true,
        },
      ],
      pagination: { totalAvailable: 50, currentlyShowing: 2, hasMoreResults: true },
    },
  };

  it('renders a markdown table with a Source column citing Skiplagged', () => {
    const md = formatSkiplaggedResults(sampleRaw);
    const headerLine = md.split('\n').find((l) => l.includes('Airline')) ?? '';
    assert.match(headerLine, /Source|Quelle/i, 'table header must declare a source column');
    // Source column on every flight row should literally say "Skiplagged"
    const rowMatches = md.match(/\| Skiplagged \|/g) ?? [];
    assert.ok(rowMatches.length >= 2, 'each flight row must cite Skiplagged');
  });

  it('does NOT emit literal <br/> tags (markdown tables do not render HTML breaks)', () => {
    const md = formatSkiplaggedResults(sampleRaw);
    assert.doesNotMatch(md, /<br\s*\/?>/i, 'no literal <br/> in output');
  });

  it('renders exactly one booking link per row (no [Book](url) [Skiplagged](url) duplicates)', () => {
    const md = formatSkiplaggedResults(sampleRaw);
    // Per row there should be one [Skiplagged](deepLink) link, not two with the same URL.
    const sq26Matches = md.match(/#trip=SQ26/g) ?? [];
    assert.strictEqual(sq26Matches.length, 1, 'SQ26 deepLink must appear exactly once');
    const lhMatches = md.match(/#trip=LH400~/g) ?? [];
    assert.strictEqual(lhMatches.length, 1, 'LH400 deepLink must appear exactly once');
  });

  it('marks hidden-city itineraries with a Hidden-City badge', () => {
    const md = formatSkiplaggedResults(sampleRaw);
    assert.match(md, /Hidden[- ]City/i, 'hidden-city flights must be flagged');
  });

  it('preserves the searchUrl as a "see more results" link', () => {
    const md = formatSkiplaggedResults(sampleRaw);
    assert.match(md, /https:\/\/skiplagged\.com\/flights\/FRA\/JFK\/2026-06-15/);
  });

  it('handles zero flights gracefully', () => {
    const empty = {
      content: [{ type: 'text', text: 'Found 0 flights' }],
      structuredContent: {
        searchUrl: 'https://skiplagged.com/...',
        flights: [],
        pagination: { totalAvailable: 0, currentlyShowing: 0, hasMoreResults: false },
      },
    };
    const md = formatSkiplaggedResults(empty);
    assert.match(md, /no.*results|keine.*ergebnisse/i);
  });
});
