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

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool } from '@/lib/mcp/http-mcp-tool';

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

type SkiplaggedToolSuccess = { success: true; result: unknown };
type SkiplaggedToolError = { success: false; error: string };
export type SkiplaggedToolResult = SkiplaggedToolSuccess | SkiplaggedToolError;

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

export function createSkiplaggedFlightSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      'Search Skiplagged for flights including hidden-city itineraries. Use this when the user asks for flight options, prices, schedules, or wants to compare cash prices across dates. Returns flights[] with airlines, departure/arrival, duration, price, and Skiplagged deepLink. Hidden-city is on by default because that\'s Skiplagged\'s key edge over other engines. Combine with cppCalculatorTool to evaluate cash-vs-points trade-offs.',
    inputSchema,
    execute: async (input): Promise<SkiplaggedToolResult> => {
      const r = await callMcpTool({
        url: SKIPLAGGED_URL,
        toolName: 'sk_flights_search',
        args: input as Record<string, unknown>,
        requiresSession: false,
        fetchImpl: deps.fetchImpl,
      });
      if (r.ok) return { success: true, result: r.result };
      return { success: false, error: r.error };
    },
  });
}

export const skiplaggedFlightSearchTool = createSkiplaggedFlightSearchTool();
