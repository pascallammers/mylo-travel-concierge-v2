// lib/mcp/http-mcp-tool.test.ts
import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { _resetSessionCache, callMcpTool } from './http-mcp-tool';

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

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
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
      throw new Error(`unexpected fetch call ${i + 1}: no more mock responses`);
    }
    const r = responses[i];
    i++;
    return r;
  };
  return { fetchImpl, calls };
}

function readBody(call: FetchCall): { method: string; params?: Record<string, unknown> } {
  return JSON.parse(call.init?.body as string);
}

function readHeaders(call: FetchCall): Record<string, string> {
  return (call.init?.headers ?? {}) as Record<string, string>;
}

describe('callMcpTool', () => {
  afterEach(() => _resetSessionCache());

  it('stateless server with JSON response returns parsed result', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: 'flight data' }] },
      }),
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.example.com/mcp',
      toolName: 'sk_flights_search',
      args: { from: 'FRA', to: 'JFK' },
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, true);
    if (r.ok) {
      assert.deepStrictEqual(r.result, {
        content: [{ type: 'text', text: 'flight data' }],
      });
    }
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, 'https://mcp.example.com/mcp');
    const body = readBody(calls[0]);
    assert.strictEqual(body.method, 'tools/call');
    assert.deepStrictEqual(body.params, {
      name: 'sk_flights_search',
      arguments: { from: 'FRA', to: 'JFK' },
    });
  });

  it('parses SSE response with event:message data line', async () => {
    const { fetchImpl } = mockFetch([
      sseResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: 'sse data' }] },
      }),
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.skiplagged.com/mcp',
      toolName: 'sk_flights_search',
      args: {},
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, true);
    if (r.ok) {
      assert.deepStrictEqual(r.result, {
        content: [{ type: 'text', text: 'sse data' }],
      });
    }
  });

  it('initializes session on first call and reuses cached session on second', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        {
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05', capabilities: {} },
        },
        200,
        { 'mcp-session-id': 'session-abc' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: { ok: 1 } }),
      jsonResponse({ jsonrpc: '2.0', id: 3, result: { ok: 2 } }),
    ]);

    const a = await callMcpTool({
      url: 'https://mcp.kiwi.com',
      toolName: 'search-flight',
      args: { x: 1 },
      requiresSession: true,
      fetchImpl,
    });
    const b = await callMcpTool({
      url: 'https://mcp.kiwi.com',
      toolName: 'search-flight',
      args: { x: 2 },
      requiresSession: true,
      fetchImpl,
    });

    assert.strictEqual(a.ok, true);
    assert.strictEqual(b.ok, true);
    assert.strictEqual(calls.length, 3); // 1 init + 2 tool calls (no re-init)
    assert.strictEqual(readBody(calls[0]).method, 'initialize');
    assert.strictEqual(readBody(calls[1]).method, 'tools/call');
    assert.strictEqual(readBody(calls[2]).method, 'tools/call');
    assert.strictEqual(readHeaders(calls[1])['mcp-session-id'], 'session-abc');
    assert.strictEqual(readHeaders(calls[2])['mcp-session-id'], 'session-abc');
  });

  it('retries with fresh session when tool call returns 404 (session expired)', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 'old-session' },
      ),
      jsonResponse(
        { jsonrpc: '2.0', id: 2, error: { code: -1, message: 'session expired' } },
        404,
      ),
      jsonResponse(
        { jsonrpc: '2.0', id: 3, result: {} },
        200,
        { 'mcp-session-id': 'new-session' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 4, result: { ok: 1 } }),
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.kiwi.com',
      toolName: 'search-flight',
      args: {},
      requiresSession: true,
      fetchImpl,
    });

    assert.strictEqual(r.ok, true);
    assert.strictEqual(calls.length, 4);
    assert.strictEqual(readHeaders(calls[1])['mcp-session-id'], 'old-session');
    assert.strictEqual(readBody(calls[2]).method, 'initialize');
    assert.strictEqual(readHeaders(calls[3])['mcp-session-id'], 'new-session');
  });

  it('does not retry stateless 404 (no session to refresh)', async () => {
    const { fetchImpl, calls } = mockFetch([
      jsonResponse({ error: 'not found' }, 404),
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.example.com',
      toolName: 'x',
      args: {},
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /404/);
    }
    assert.strictEqual(calls.length, 1);
  });

  it('expires cached session after TTL and re-initializes', async () => {
    let now = 1_000_000;
    const { fetchImpl, calls } = mockFetch([
      jsonResponse(
        { jsonrpc: '2.0', id: 1, result: {} },
        200,
        { 'mcp-session-id': 's1' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: { x: 1 } }),
      jsonResponse(
        { jsonrpc: '2.0', id: 3, result: {} },
        200,
        { 'mcp-session-id': 's2' },
      ),
      jsonResponse({ jsonrpc: '2.0', id: 4, result: { x: 2 } }),
    ]);

    await callMcpTool({
      url: 'https://mcp.trivago.com/mcp',
      toolName: 't',
      args: {},
      requiresSession: true,
      fetchImpl,
      now: () => now,
    });

    now += 6 * 60 * 1000; // jump past 5min TTL

    await callMcpTool({
      url: 'https://mcp.trivago.com/mcp',
      toolName: 't',
      args: {},
      requiresSession: true,
      fetchImpl,
      now: () => now,
    });

    assert.strictEqual(calls.length, 4);
    assert.strictEqual(readBody(calls[0]).method, 'initialize');
    assert.strictEqual(readBody(calls[2]).method, 'initialize'); // re-init
    assert.strictEqual(readHeaders(calls[3])['mcp-session-id'], 's2');
  });

  it('returns error response on JSON-RPC error from server', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Invalid params' },
      }),
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.example.com',
      toolName: 'x',
      args: {},
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /Invalid params/);
    }
  });

  it('returns error on HTTP 5xx', async () => {
    const { fetchImpl } = mockFetch([jsonResponse({ error: 'server error' }, 500)]);

    const r = await callMcpTool({
      url: 'https://mcp.example.com',
      toolName: 'x',
      args: {},
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /500/);
    }
  });

  it('returns error when fetch throws', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };

    const r = await callMcpTool({
      url: 'https://mcp.example.com',
      toolName: 'x',
      args: {},
      requiresSession: false,
      fetchImpl,
    });

    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /ECONNREFUSED/);
    }
  });

  it('throws/errors when initialize response lacks mcp-session-id header', async () => {
    const { fetchImpl } = mockFetch([
      jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, 200), // no header
    ]);

    const r = await callMcpTool({
      url: 'https://mcp.example.com',
      toolName: 'x',
      args: {},
      requiresSession: true,
      fetchImpl,
    });

    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /mcp-session-id/i);
    }
  });
});
