// lib/mcp/http-mcp-tool.ts
//
// Shared helper for the four flight/hotel/ferry MCP servers (Skiplagged, Kiwi,
// Trivago, Ferryhopper). Each ai-sdk tool wrapper calls into this module so we
// don't reimplement the JSON-RPC plumbing four times.
//
// Servers that accept initialize without returning `mcp-session-id` are
// stateless; caching that result avoids an initialize request for every call.
//
// Two response formats observed:
//   - SSE: `event: message\ndata: {jsonrpc...}\n\n` (Skiplagged, Kiwi)
//   - Raw JSON: `{jsonrpc...}` (Trivago, Ferryhopper)
//
// We send `Accept: application/json, text/event-stream` and let the server pick.
// On 404 with a session, the session was likely evicted server-side: clear
// cache, re-init once, retry. Sessions cache for 5 minutes to bound staleness.

const PROTOCOL_VERSION = '2024-11-05';
const SESSION_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const CLIENT_INFO = { name: 'mylo-travel-concierge', version: '0.1.0' };

/**
 * Thrown by MCP-backed tools when the upstream server could not deliver a
 * result. `message` is the Markdown the model reads (unchanged wording from
 * the previous string return), `reason` is the short sanitized cause that
 * lands in `tool_calls.error`.
 */
export class McpToolFailure extends Error {
  override readonly name = 'McpToolFailure';

  constructor(
    readonly provider: string,
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

interface SessionEntry {
  sessionId: string | null;
  expiresAt: number;
}

const sessionCache = new Map<string, SessionEntry>();

let requestIdCounter = 0;
function nextId(): number {
  requestIdCounter += 1;
  return requestIdCounter;
}

export interface CallMcpToolParams {
  url: string;
  toolName: string;
  args: Record<string, unknown>;
  requiresSession: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Per-call timeout in ms. Defaults to REQUEST_TIMEOUT_MS (15s). */
  timeoutMs?: number;
}

export type McpToolResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

/**
 * Strip internal details (stack traces, hostnames, auth headers, file paths)
 * from an error string before it's surfaced to the LLM. Keeps the message
 * compact and free of sensitive transport-layer detail.
 *
 * Exported so per-tool wrappers can apply the same sanitation to messages
 * they construct themselves (e.g., when wrapping callMcpTool errors into
 * markdown).
 */
export function sanitizeMcpError(input: string): string {
  if (!input) return 'unknown error';
  // Take only the first line — strips stack traces appended after \n.
  let s = input.split('\n')[0];
  // Drop URLs (could leak hostnames / paths / query strings).
  s = s.replace(/https?:\/\/\S+/gi, '<url>');
  // Drop auth-like header tokens: "authorization: Bearer xxx" or "Bearer abc.def".
  s = s.replace(/(authorization|x-api-key|api[-_]?key)\s*[:=]\s*\S+/gi, '<auth>');
  s = s.replace(/\bBearer\s+[A-Za-z0-9._\-]+/gi, '<auth>');
  // Drop bare hostnames like "mcp.kiwi.com" or "internal.example.local:443".
  s = s.replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\b/gi, '<host>');
  // Drop POSIX-ish absolute paths (/Users/.../file.ts).
  s = s.replace(/(?:^|\s)\/[\w./-]+/g, ' <path>');
  // Cap length so bad upstream errors can't blow up the prompt.
  if (s.length > 240) s = `${s.slice(0, 240)}…`;
  return s.trim() || 'unknown error';
}

/**
 * Reads an application-level failure out of a JSON-RPC `result` that arrived
 * with `ok: true`. MCP servers flag those with `isError: true` and put the
 * explanation into `content[].text`; Kiwi additionally sets
 * `structuredContent.error`. Returns the raw explanation, callers sanitize.
 *
 * @param result - The `result` member of a successful tools/call envelope.
 * @returns The upstream error text, or undefined for a real result.
 */
export function readMcpUpstreamError(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) return undefined;
  const root = result as Record<string, unknown>;
  const structured = root.structuredContent;
  const structuredError =
    typeof structured === 'object' && structured !== null
      ? (structured as Record<string, unknown>).error
      : undefined;
  if (typeof structuredError === 'string' && structuredError.length > 0) {
    return structuredError;
  }
  if (root.isError !== true) return undefined;
  const content = Array.isArray(root.content) ? root.content : [];
  const text = content.find(
    (part): part is { text: string } =>
      typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string',
  );
  return text?.text || 'unknown error';
}

export async function callMcpTool(params: CallMcpToolParams): Promise<McpToolResponse> {
  const { url, toolName, args, requiresSession } = params;
  const fetchImpl = params.fetchImpl ?? globalThis.fetch;
  const now = params.now ?? Date.now;
  const timeoutMs = params.timeoutMs ?? REQUEST_TIMEOUT_MS;

  try {
    let sessionId: string | undefined;
    if (requiresSession) {
      sessionId = await getOrCreateSession(url, fetchImpl, now, timeoutMs);
    }

    const callBody = JSON.stringify({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });

    let response = await fetchImpl(url, {
      method: 'POST',
      headers: buildHeaders(sessionId),
      body: callBody,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404 && sessionId) {
      sessionCache.delete(url);
      sessionId = await getOrCreateSession(url, fetchImpl, now, timeoutMs);
      response = await fetchImpl(url, {
        method: 'POST',
        headers: buildHeaders(sessionId),
        body: callBody,
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      return { ok: false, error: sanitizeMcpError(`HTTP ${response.status}${statusText}`) };
    }

    const payload = await readJsonRpcResponse(response);
    if (payload.error) {
      return {
        ok: false,
        error: sanitizeMcpError(payload.error.message ?? String(payload.error)),
      };
    }
    return { ok: true, result: payload.result };
  } catch (err) {
    // AbortSignal.timeout throws TimeoutError (DOMException) on expiry.
    // Surface a stable, LLM-friendly error so the agent can retry or fall back.
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: `MCP request timed out after ${timeoutMs}ms` };
    }
    return {
      ok: false,
      error: sanitizeMcpError(err instanceof Error ? err.message : String(err)),
    };
  }
}

async function getOrCreateSession(
  url: string,
  fetchImpl: typeof fetch,
  now: () => number,
  timeoutMs: number,
): Promise<string | undefined> {
  const cached = sessionCache.get(url);
  if (cached && cached.expiresAt > now()) {
    return cached.sessionId ?? undefined;
  }

  const initBody = JSON.stringify({
    jsonrpc: '2.0',
    id: nextId(),
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
  });

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: buildHeaders(undefined),
    body: initBody,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`MCP initialize failed: HTTP ${response.status}`);
  }

  const payload = await readJsonRpcResponse(response).catch(() => ({}) as JsonRpcEnvelope);
  if (payload.error) {
    throw new Error(`MCP initialize failed: ${payload.error.message ?? 'JSON-RPC error'}`);
  }

  const sessionId = response.headers.get('mcp-session-id');

  sessionCache.set(url, {
    sessionId,
    expiresAt: now() + SESSION_TTL_MS,
  });
  return sessionId ?? undefined;
}

function buildHeaders(sessionId: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) h['mcp-session-id'] = sessionId;
  return h;
}

interface JsonRpcEnvelope {
  result?: unknown;
  error?: { code?: number; message?: string };
}

async function readJsonRpcResponse(response: Response): Promise<JsonRpcEnvelope> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (contentType.includes('text/event-stream')) {
    return parseSseFrame(text);
  }
  return JSON.parse(text) as JsonRpcEnvelope;
}

// MCP servers using SSE typically emit a single `event: message` frame followed
// by one or more `data:` lines. Per the SSE spec, multiple data lines are
// joined with newline; in practice MCP servers send one data line carrying the
// full JSON-RPC envelope. We handle both shapes.
function parseSseFrame(text: string): JsonRpcEnvelope {
  const dataLines = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  if (dataLines.length === 0) {
    throw new Error('SSE response had no data lines');
  }
  return JSON.parse(dataLines.join('\n')) as JsonRpcEnvelope;
}

// Test helper. Module-level cache means tests must reset between runs to stay
// isolated. Not exported as part of the public API — underscore-prefixed.
export function _resetSessionCache(): void {
  sessionCache.clear();
}
