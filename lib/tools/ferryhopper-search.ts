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
import { callMcpTool, sanitizeMcpError } from '@/lib/mcp/http-mcp-tool';
import { sanitizeForCodeblock } from './mcp-output-sanitizer';

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

// MCP best practice: tools return user-readable text content (markdown) even
// on failure. The LLM (xAI Grok) handles markdown gracefully; an
// `{ success: false }` JSON envelope confused it. Tool returns a string in
// both success and failure cases.
//
// TODO: structured renderer — replace JSON-in-codeblock fallback with a real
// markdown table renderer (route / departure / arrival / vessel / price /
// source) once we pin the desired columns. This subagent's scope is error
// handling only.
export type FerryhopperToolResult = string;

/** Render Ferryhopper raw JSON inside a fenced code block. Best-effort placeholder. */
export function formatFerryhopperResults(raw: unknown): string {
  let body: string;
  try {
    // sanitizeForCodeblock neutralizes triple-backticks inside string values
    // so a compromised provider can't escape the fence and inject markdown
    // directives or fake assistant turns into the LLM context.
    body = JSON.stringify(sanitizeForCodeblock(raw), null, 2);
  } catch {
    body = String(raw);
  }
  return ['## Ferryhopper Trips', '', '```json', body, '```'].join('\n');
}

/** Markdown error message returned when Ferryhopper is unreachable / errors out. */
export function formatFerryhopperError(rawError: string): string {
  const reason = sanitizeMcpError(rawError);
  return [
    '## Ferryhopper search unavailable',
    '',
    `Ferryhopper could not return results right now (reason: ${reason}). The user can try again in a moment; falling back to other transport options if relevant.`,
  ].join('\n');
}

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
      if (r.ok) return formatFerryhopperResults(r.result);
      return formatFerryhopperError(r.error);
    },
  });
}

export const ferryhopperSearchTool = createFerryhopperSearchTool();
