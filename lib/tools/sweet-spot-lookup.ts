// lib/tools/sweet-spot-lookup.ts
//
// AI SDK tool that searches borski's curated sweet-spots data — the "where to
// burn your points" knowledge base. Tier=legendary entries are the redemptions
// that routinely beat 3¢/point and define MYLO's value-add over generic
// flight search.
//
// Hotels are off by default to keep responses focused on the more frequent
// flight-sweet-spot use case. Set includeHotels=true to also search hotels.

import { tool } from 'ai';
import { z } from 'zod';
import { loadSweetSpots } from '@/lib/data/borski-toolkit-adapter';
import type {
  BorskiFlightSweetSpot,
  BorskiHotelSweetSpot,
} from '@/lib/data/borski-toolkit-adapter';

const inputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Free-text query — substring-matched against name, airline, program, route keys, and "why" text. Examples: "japan", "tokyo", "ANA", "europe to asia".',
    ),
  alliance: z
    .enum(['Star Alliance', 'Oneworld', 'SkyTeam'])
    .optional()
    .describe('Filter by alliance. Case-insensitive, accepts spaces or underscores.'),
  tier: z
    .enum(['legendary', 'excellent', 'good'])
    .optional()
    .describe('Filter by sweet-spot tier. legendary = best-of-the-best (3+ cpp routinely).'),
  cabin: z
    .enum(['first', 'business', 'premium_economy', 'economy'])
    .optional()
    .describe('Filter by flight cabin class.'),
  includeHotels: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to also return matching hotel sweet spots. Default false.'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe('Max flights returned. Default 5. Hotels are not capped.'),
});

interface FlightEntry {
  name: string;
  tier: string;
  program: string;
  airline: string;
  alliance: string | null;
  cabin: string;
  routes: BorskiFlightSweetSpot['routes'];
  surcharge_estimate: string | null;
  why: string | null;
  transfer_partners: string[];
  booking_tips: string[];
}

interface HotelEntry {
  name: string;
  program: string | null;
  why: string | null;
}

type Result =
  | { success: true; count: number; flights: FlightEntry[]; hotels: HotelEntry[] }
  | { success: false; error: string };

export const sweetSpotLookupTool = tool({
  description:
    "Look up high-value award redemption opportunities (sweet spots) from borski's curated database. Returns flights matching route, airline, alliance, cabin, or tier filters with their mileage cost, surcharges, transfer-partner sources, and booking tips. Use when the user asks about award charts, sweet spots, where to redeem miles, or how to get to a specific destination cheaply with points.",
  inputSchema,
  execute: async (input): Promise<Result> => {
    const data = loadSweetSpots();
    const allFlights = data.flights ?? [];
    const allHotels = data.hotels ?? [];

    const matchedFlights = allFlights.filter((f) => matchesFlightFilters(f, input));
    const matchedHotels = input.includeHotels ? allHotels.filter((h) => matchesHotelQuery(h, input.query)) : [];

    const flights = matchedFlights.slice(0, input.limit).map(formatFlight);
    const hotels = matchedHotels.map(formatHotel);

    return {
      success: true,
      count: matchedFlights.length,
      flights,
      hotels,
    };
  },
});

function matchesFlightFilters(
  f: BorskiFlightSweetSpot,
  filters: { query?: string; alliance?: string; tier?: string; cabin?: string },
): boolean {
  if (filters.query) {
    const haystack = `${f.name} ${f.airline} ${f.program} ${Object.keys(f.routes).join(' ')} ${f.why ?? ''}`.toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }
  if (filters.alliance) {
    const fAlliance = (f.alliance ?? '').toLowerCase().replace(/_/g, ' ');
    if (!fAlliance.includes(filters.alliance.toLowerCase())) return false;
  }
  if (filters.tier && f.tier !== filters.tier) return false;
  if (filters.cabin && f.cabin !== filters.cabin) return false;
  return true;
}

function matchesHotelQuery(h: BorskiHotelSweetSpot, query: string | undefined): boolean {
  if (!query) return true;
  const haystack = `${h.name} ${h.program ?? ''} ${h.why ?? ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function formatFlight(f: BorskiFlightSweetSpot): FlightEntry {
  return {
    name: f.name,
    tier: typeof f.tier === 'string' ? f.tier : 'unknown',
    program: f.program,
    airline: f.airline,
    alliance: f.alliance ?? null,
    cabin: f.cabin,
    routes: f.routes,
    surcharge_estimate: f.surcharge_estimate ?? null,
    why: f.why ?? null,
    transfer_partners: f.transfer_partners ?? [],
    booking_tips: f.booking?.tips ?? [],
  };
}

function formatHotel(h: BorskiHotelSweetSpot): HotelEntry {
  return {
    name: h.name,
    program: h.program ?? null,
    why: h.why ?? null,
  };
}
