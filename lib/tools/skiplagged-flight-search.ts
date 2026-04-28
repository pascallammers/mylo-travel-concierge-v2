// lib/tools/skiplagged-flight-search.ts
//
// AI SDK tool that wraps Skiplagged's `sk_flights_search` via the shared HTTP
// MCP helper. Skiplagged is stateless (no session) and returns Server-Sent
// Events. The helper handles both transparently.
//
// We expose a deliberately narrow zod schema — Skiplagged's full schema has
// 23 inputs, most of which an LLM won't use well. This wrapper exposes the 9
// fields that matter for DACH travel-concierge use cases. Hidden-city is
// enabled by default because that's Skiplagged's signature value prop.
//
// The tool returns FORMATTED MARKDOWN (not raw JSON) so the NO-HALLUCINATION
// rule in lib/chat/mylo-system-prompt.ts can protect the rendering verbatim.
// Source column ("Skiplagged") + Hidden-City badge are deterministic so the
// LLM never has to invent attribution.

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool, sanitizeMcpError } from '@/lib/mcp/http-mcp-tool';

const SKIPLAGGED_URL = 'https://mcp.skiplagged.com/mcp';

const inputSchema = z.object({
  origin: z
    .string()
    .min(1)
    .describe('Departure: IATA airport code preferred (e.g. "FRA", "MUC", "VIE", "ZRH"), city name accepted.'),
  destination: z
    .string()
    .min(1)
    .describe('Arrival: IATA airport code preferred (e.g. "JFK", "BKK", "LIM"), city name accepted.'),
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
    .describe('Number of adult passengers. Defaults to 1.'),
  children: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(0)
    .describe('Number of children. Defaults to 0.'),
  fareClass: z
    .enum(['basic-economy', 'economy', 'premium', 'business', 'first'])
    .default('economy')
    .describe('Cabin class. Defaults to economy.'),
  maxStops: z
    .enum(['none', 'one', 'many'])
    .optional()
    .describe('Limit stops: "none" for nonstop, "one" for 1 stop, "many" for 2+. Omit for any.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(8)
    .describe('Number of flights to return. Defaults to 8 to keep responses tight; max 20.'),
  includeHiddenCity: z
    .boolean()
    .default(true)
    .describe(
      'Include hidden-city itineraries (Skiplagged\'s signature feature — book A→B→C, exit at B). Default true; these often save 30%+.',
    ),
});

// MCP best practice: tools return user-readable text content even on failure.
// The LLM (xAI Grok) handles markdown gracefully; an `{ success: false }` JSON
// envelope confused it (vague "technical error" responses). Tool now returns
// markdown string in BOTH success and failure cases.
export type SkiplaggedToolResult = string;

/**
 * Build a markdown-formatted error message that the LLM can read and explain
 * to the user. Mentions a fallback so the model knows it's allowed to keep
 * working with other providers instead of bailing out.
 */
export function formatSkiplaggedError(rawError: string): string {
  const reason = sanitizeMcpError(rawError);
  return [
    '## Skiplagged search unavailable',
    '',
    `Skiplagged could not return results right now (reason: ${reason}). Falling back to other flight providers if available; the user can also try again in a moment.`,
  ].join('\n');
}

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Format Skiplagged's structuredContent into a markdown table that the LLM
 * can pass through verbatim. Source column = "Skiplagged" per row,
 * Hidden-City badge in the Type column when applicable, single deepLink per
 * row (no double-labeling), no literal <br/> in cells.
 *
 * Exported so unit tests can pin down the contract.
 */
export function formatSkiplaggedResults(raw: unknown): string {
  const r = (raw ?? {}) as {
    structuredContent?: {
      searchUrl?: string;
      flights?: Array<{
        airlines?: string;
        departure?: { airport?: string; dateTime?: string };
        arrival?: { airport?: string; dateTime?: string };
        duration?: string;
        layovers?: number;
        price?: { amount?: number; currency?: string };
        deepLink?: string;
        hiddenCity?: boolean;
      }>;
      pagination?: { totalAvailable?: number; hasMoreResults?: boolean };
    };
  };

  const flights = r.structuredContent?.flights ?? [];
  const searchUrl = r.structuredContent?.searchUrl;
  const total = r.structuredContent?.pagination?.totalAvailable;

  if (flights.length === 0) {
    return 'Skiplagged returned no results for this search. Try different dates or relaxing the cabin / stops filter.';
  }

  const lines: string[] = [];
  lines.push(`## Skiplagged Flights (${flights.length}${total && total > flights.length ? ` of ${total}+` : ''} results)`);
  lines.push('');
  lines.push('| No. | Airline | Price | Departure | Arrival | Duration | Stops | Type | Booking | Source |');
  lines.push('|-----|---------|-------|-----------|---------|----------|-------|------|---------|--------|');

  flights.forEach((f, idx) => {
    const airline = f.airlines ?? '—';
    const price = f.price?.amount != null && f.price?.currency
      ? `${f.price.currency} ${f.price.amount}`
      : '—';
    const depAirport = f.departure?.airport ?? '—';
    const arrAirport = f.arrival?.airport ?? '—';
    const depTime = formatTime(f.departure?.dateTime);
    const arrTime = formatTime(f.arrival?.dateTime);
    const duration = f.duration ?? '—';
    const stops = f.layovers === 0 ? 'Nonstop' : f.layovers != null ? `${f.layovers} stop(s)` : '—';
    const type = f.hiddenCity ? 'Hidden-City' : 'Standard';
    const booking = f.deepLink ? `[Skiplagged](${f.deepLink})` : '—';

    lines.push(
      `| ${idx + 1} | ${airline} | ${price} | ${depAirport} ${depTime} | ${arrAirport} ${arrTime} | ${duration} | ${stops} | ${type} | ${booking} | Skiplagged |`,
    );
  });

  if (searchUrl) {
    lines.push('');
    lines.push(`[Open full search on Skiplagged](${searchUrl})`);
  }

  return lines.join('\n');
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  // Skiplagged returns ISO with timezone offset like "2026-06-15T08:35:00+02:00".
  // Extract HH:MM without forcing locale conversion (keep the local time
  // Skiplagged shows in its UI).
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return iso;
}

export function createSkiplaggedFlightSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      "Search Skiplagged for flights including hidden-city itineraries. Use this when the user asks for flight options, prices, schedules, or wants to compare cash prices across dates. Returns a formatted markdown table with airlines, departure/arrival, duration, price, hidden-city badges, and a Skiplagged deepLink per row. Hidden-city is on by default because that's Skiplagged's key edge over other engines. Combine with cpp_calculator to evaluate cash-vs-points trade-offs.",
    inputSchema,
    execute: async (input): Promise<SkiplaggedToolResult> => {
      const r = await callMcpTool({
        url: SKIPLAGGED_URL,
        toolName: 'sk_flights_search',
        args: input as Record<string, unknown>,
        requiresSession: false,
        fetchImpl: deps.fetchImpl,
      });
      if (r.ok) return formatSkiplaggedResults(r.result);
      return formatSkiplaggedError(r.error);
    },
  });
}

export const skiplaggedFlightSearchTool = createSkiplaggedFlightSearchTool();
