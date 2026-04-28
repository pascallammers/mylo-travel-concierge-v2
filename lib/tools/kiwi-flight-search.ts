// lib/tools/kiwi-flight-search.ts
//
// AI SDK tool that wraps Kiwi.com's `search-flight` MCP via the shared
// http-mcp-tool helper. Kiwi requires a session (initialize → mcp-session-id
// header on every subsequent call). The helper handles the session dance.
//
// Schema translation: Kiwi's native API uses dd/mm/yyyy dates, single-letter
// cabin codes (M/W/C/F), and a nested `passengers` object. We expose the same
// LLM-facing shape as the other flight tools (YYYY-MM-DD, plain cabin names,
// flat passenger counts) and translate inside execute(). One format across
// the four MCP wrappers means the LLM doesn't trip over per-vendor quirks.

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool, sanitizeMcpError } from '@/lib/mcp/http-mcp-tool';

const KIWI_URL = 'https://mcp.kiwi.com';

const inputSchema = z
  .object({
    flyFrom: z
      .string()
      .min(1)
      .describe('Departure: city name or IATA code (e.g. "FRA", "Frankfurt", "Berlin").'),
    flyTo: z
      .string()
      .min(1)
      .describe('Arrival: city name or IATA code (e.g. "JFK", "New York", "Bangkok").'),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
      .describe('Departure date in YYYY-MM-DD format.'),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
      .optional()
      .describe('Optional return date in YYYY-MM-DD. Omit for one-way.'),
    adults: z
      .number()
      .int()
      .min(1)
      .max(9)
      .default(1)
      .describe('Adult passengers (over 12). Defaults to 1; min 1, max 9.'),
    children: z
      .number()
      .int()
      .min(0)
      .max(8)
      .default(0)
      .describe('Children aged 3–11. Defaults to 0.'),
    infants: z
      .number()
      .int()
      .min(0)
      .max(4)
      .default(0)
      .describe('Infants under 2. Defaults to 0. Each infant requires an adult.'),
    cabinClass: z
      .enum(['economy', 'premium-economy', 'business', 'first'])
      .default('economy')
      .describe('Cabin class. Defaults to economy.'),
    sort: z
      .enum(['price', 'duration', 'quality', 'date'])
      .default('price')
      .describe(
        'Sort order. "price" cheapest first, "duration" shortest first, "quality" Kiwi quality score, "date" chronological. Defaults to price (most common LLM intent).',
      ),
    currency: z
      .string()
      .min(3)
      .max(3)
      .default('EUR')
      .describe('ISO currency code (default EUR for DACH).'),
    flexDays: z
      .number()
      .int()
      .min(0)
      .max(3)
      .default(0)
      .describe('Flexibility ±days around the chosen dates. Defaults to 0; max 3.'),
  })
  .refine(
    (v) => (v.returnDate ? Date.parse(v.returnDate) > Date.parse(v.departureDate) : true),
    {
      message: 'returnDate must be strictly after departureDate (YYYY-MM-DD).',
      path: ['returnDate'],
    },
  )
  .refine((v) => v.infants <= v.adults, {
    message: 'infants must be <= adults (each infant requires an adult lap).',
    path: ['infants'],
  });

const CABIN_CODE: Record<z.infer<typeof inputSchema>['cabinClass'], 'M' | 'W' | 'C' | 'F'> = {
  economy: 'M',
  'premium-economy': 'W',
  business: 'C',
  first: 'F',
};

function toEuropeDate(iso: string): string {
  // 2026-06-15 → 15/06/2026
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildKiwiArgs(input: z.infer<typeof inputSchema>): Record<string, unknown> {
  const args: Record<string, unknown> = {
    flyFrom: input.flyFrom,
    flyTo: input.flyTo,
    departureDate: toEuropeDate(input.departureDate),
    departureDateFlexRange: input.flexDays,
    passengers: {
      adults: input.adults,
      children: input.children,
      infants: input.infants,
    },
    cabinClass: CABIN_CODE[input.cabinClass],
    sort: input.sort,
    curr: input.currency,
  };
  if (input.returnDate) {
    args.returnDate = toEuropeDate(input.returnDate);
    args.returnDateFlexRange = input.flexDays;
  }
  return args;
}

// MCP best practice: tools return user-readable text content (markdown) even
// on failure. The LLM (xAI Grok) handles markdown gracefully; an
// `{ success: false }` JSON envelope confused it. Tool returns a string in
// both success and failure cases.
//
// TODO: structured renderer — replace JSON-in-codeblock fallback with a real
// markdown table renderer (airline / price / route / duration / source) once
// Kiwi response shape is pinned down. This subagent's scope is error handling
// only; the success path is a best-effort passthrough.
export type KiwiToolResult = string;

/** Render Kiwi raw JSON inside a fenced code block. Best-effort placeholder. */
export function formatKiwiResults(raw: unknown): string {
  let body: string;
  try {
    body = JSON.stringify(raw, null, 2);
  } catch {
    body = String(raw);
  }
  return ['## Kiwi.com Flights', '', '```json', body, '```'].join('\n');
}

/** Markdown error message returned when Kiwi is unreachable / errors out. */
export function formatKiwiError(rawError: string): string {
  const reason = sanitizeMcpError(rawError);
  return [
    '## Kiwi.com search unavailable',
    '',
    `Kiwi.com could not return results right now (reason: ${reason}). Falling back to other flight providers if available; the user can also try again in a moment.`,
  ].join('\n');
}

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

export function createKiwiFlightSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      "Search Kiwi.com for flights including standard schedules, multi-stop, and Kiwi's virtual interlining (combining tickets across airlines for cheaper routes). Use this alongside skiplagged_flight_search for cash-flight options — Kiwi's virtual interlining catches deals Skiplagged misses, especially Europe→Asia. Returns flights[] with airlines, segments, prices in chosen currency, and Kiwi deepLinks. Default sort is price (cheapest first).",
    inputSchema,
    execute: async (input): Promise<KiwiToolResult> => {
      const r = await callMcpTool({
        url: KIWI_URL,
        toolName: 'search-flight',
        args: buildKiwiArgs(input),
        requiresSession: true,
        fetchImpl: deps.fetchImpl,
      });
      if (r.ok) return formatKiwiResults(r.result);
      return formatKiwiError(r.error);
    },
  });
}

export const kiwiFlightSearchTool = createKiwiFlightSearchTool();

// Exported for tests so we can verify the date/cabin translation independently.
export const _kiwiInternals = { toEuropeDate, buildKiwiArgs, CABIN_CODE };
