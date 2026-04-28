// lib/tools/ferryhopper-search.ts
//
// AI SDK tool wrapping Ferryhopper's `search_trips` MCP. Stateless server,
// raw JSON response — the simplest of the four Phase 1b wrappers. The shared
// http-mcp-tool helper handles the JSON-RPC plumbing.
//
// No schema translation needed: Ferryhopper accepts human-readable location
// names natively (no IATA-style codes, no nested passenger objects, no
// dd/mm/yyyy quirks). The wrapper passes input straight through.

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool } from '@/lib/mcp/http-mcp-tool';

const FERRYHOPPER_URL = 'https://mcp.ferryhopper.com/mcp';

const inputSchema = z.object({
  departureLocation: z
    .string()
    .min(1)
    .describe(
      'Departure location: city or port name (e.g. "Athens", "Piraeus", "Naples", "Split"). Not a code.',
    ),
  arrivalLocation: z
    .string()
    .min(1)
    .describe('Arrival location: city or port name (e.g. "Mykonos", "Santorini", "Corfu").'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
    .describe('Departure date in YYYY-MM-DD format.'),
});

type FerryhopperToolSuccess = { success: true; result: unknown };
type FerryhopperToolError = { success: false; error: string };
export type FerryhopperToolResult = FerryhopperToolSuccess | FerryhopperToolError;

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

export function createFerryhopperSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      'Search Ferryhopper for ferry trips between two ports on a specific date. Use this when the user asks about ferries (Greek islands, Italy↔Croatia, Adriatic, Mediterranean ferry routes). Returns direct itineraries with segments (departure/arrival times, vessel, operating company, accommodations and prices in cents), pets/vehicle availability, and a Ferryhopper booking deepLink. Locations are human-readable names — no port codes needed.',
    inputSchema,
    execute: async (input): Promise<FerryhopperToolResult> => {
      const r = await callMcpTool({
        url: FERRYHOPPER_URL,
        toolName: 'search_trips',
        args: input as Record<string, unknown>,
        requiresSession: false,
        fetchImpl: deps.fetchImpl,
      });
      if (r.ok) return { success: true, result: r.result };
      return { success: false, error: r.error };
    },
  });
}

export const ferryhopperSearchTool = createFerryhopperSearchTool();
