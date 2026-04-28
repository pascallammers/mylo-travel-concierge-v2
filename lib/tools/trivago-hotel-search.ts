// lib/tools/trivago-hotel-search.ts
//
// AI SDK tool that wraps Trivago's `trivago-accommodation-radius-search` MCP
// via the shared http-mcp-tool helper. Trivago requires session init and
// returns raw JSON (not SSE). The helper handles both transparently.
//
// Tool selection note: the original Phase 1b plan called for
// `trivago-accommodation-search`, but after pulling the live schema we found
// it requires (ns, id) which can only be obtained via the separate
// `trivago-search-suggestions` tool — meaning a 2-call flow per query. The
// radius-search tool takes (lat, lon, radius) directly. LLMs reliably know
// coordinates for major cities and landmarks from training data, and this
// tool also unlocks "hotels near {landmark/neighborhood}" queries that the
// city-ID flow can't express. One HTTP call beats two.
//
// Filter translation: Trivago's hotel_rating, review_rating, and filters
// are nested objects with per-key booleans. We expose a flat, LLM-friendly
// shape (minStars, minReviewRating, freeCancellation, breakfastIncluded)
// and rebuild the nested shape inside execute().

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool } from '@/lib/mcp/http-mcp-tool';

const TRIVAGO_URL = 'https://mcp.trivago.com/mcp';

const REVIEW_TIERS = ['7.0', '7.5', '8.0', '8.5'] as const;

const inputSchema = z.object({
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .describe(
      'Latitude of the search target (city, landmark, neighborhood, address). E.g. Berlin: 52.52, Brandenburg Gate: 52.516, Bali (Ubud): -8.506.',
    ),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .describe('Longitude of the search target. E.g. Berlin: 13.405, Brandenburg Gate: 13.378.'),
  radiusMeters: z
    .number()
    .int()
    .min(500)
    .max(50000)
    .default(5000)
    .describe('Search radius in meters around the coordinates. Defaults to 5km; max 50km.'),
  arrival: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
    .describe('Check-in date YYYY-MM-DD. Must be in the future.'),
  departure: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
    .describe('Check-out date YYYY-MM-DD. Must be after arrival.'),
  adults: z
    .number()
    .int()
    .min(1)
    .max(9)
    .default(2)
    .describe('Adult guests. Defaults to 2 (most common booking).'),
  children: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(0)
    .describe('Children. Defaults to 0.'),
  childrenAges: z
    .string()
    .regex(/^\d{1,2}(-\d{1,2})*$/, 'Dash-separated ages, e.g. "10-12-14"')
    .optional()
    .describe('Required if children > 0: dash-separated ages (e.g. "10-12-14").'),
  rooms: z
    .number()
    .int()
    .min(1)
    .max(9)
    .default(1)
    .describe('Number of rooms. Defaults to 1. Must be ≤ adults.'),
  minStars: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe('Minimum hotel star rating (1–5). Filters to that tier and above.'),
  minReviewRating: z
    .enum(REVIEW_TIERS)
    .optional()
    .describe('Minimum guest review rating. Allowed: "7.0", "7.5", "8.0", "8.5". Filters to that tier and above.'),
  freeCancellation: z
    .boolean()
    .default(false)
    .describe('Filter to hotels with free cancellation.'),
  breakfastIncluded: z
    .boolean()
    .default(false)
    .describe('Filter to hotels that include breakfast.'),
});

type Input = z.infer<typeof inputSchema>;

function buildHotelRating(min: number | undefined): Record<string, boolean> | undefined {
  if (!min) return undefined;
  const out: Record<string, boolean> = {};
  for (let s = min; s <= 5; s++) out[`${s}star`] = true;
  return out;
}

function buildReviewRating(min: (typeof REVIEW_TIERS)[number] | undefined):
  | Record<string, boolean>
  | undefined {
  if (!min) return undefined;
  const startIdx = REVIEW_TIERS.indexOf(min);
  const tierKey = (tier: string) => `rating${tier.replace('.', '')}`;
  const out: Record<string, boolean> = {};
  for (let i = startIdx; i < REVIEW_TIERS.length; i++) out[tierKey(REVIEW_TIERS[i])] = true;
  return out;
}

function buildTrivagoArgs(input: Input): Record<string, unknown> {
  const args: Record<string, unknown> = {
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radiusMeters,
    arrival: input.arrival,
    departure: input.departure,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
  };
  if (input.childrenAges) args.children_ages = input.childrenAges;

  const hotelRating = buildHotelRating(input.minStars);
  if (hotelRating) args.hotel_rating = hotelRating;

  const reviewRating = buildReviewRating(input.minReviewRating);
  if (reviewRating) args.review_rating = reviewRating;

  if (input.freeCancellation || input.breakfastIncluded) {
    args.filters = {
      freeCancellation: input.freeCancellation,
      breakfastIncluded: input.breakfastIncluded,
    };
  }

  return args;
}

type TrivagoToolSuccess = { success: true; result: unknown };
type TrivagoToolError = { success: false; error: string };
export type TrivagoToolResult = TrivagoToolSuccess | TrivagoToolError;

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

export function createTrivagoHotelSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      'Search Trivago for hotels and accommodations within a radius around given coordinates (city center, landmark, or address). Use when the user asks "find me a hotel in/near X" — derive lat/lon from the place. Defaults to 5km radius, 2 adults, 1 room. Filter by minimum stars, minimum guest rating, free cancellation, and breakfast included. Returns hotel cards with name, address, price per night/stay, advertiser, deepLink, image, distance to city center, and amenities.',
    inputSchema,
    execute: async (input): Promise<TrivagoToolResult> => {
      const r = await callMcpTool({
        url: TRIVAGO_URL,
        toolName: 'trivago-accommodation-radius-search',
        args: buildTrivagoArgs(input),
        requiresSession: true,
        fetchImpl: deps.fetchImpl,
      });
      if (r.ok) return { success: true, result: r.result };
      return { success: false, error: r.error };
    },
  });
}

export const trivagoHotelSearchTool = createTrivagoHotelSearchTool();

export const _internals = { buildHotelRating, buildReviewRating, buildTrivagoArgs, REVIEW_TIERS };
