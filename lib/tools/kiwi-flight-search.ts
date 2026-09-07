// lib/tools/kiwi-flight-search.ts
//
// AI SDK tool that wraps Kiwi.com's `search-flight` MCP via the shared
// http-mcp-tool helper.
//
// Schema translation: Kiwi's native API uses dd/mm/yyyy dates, single-letter
// cabin codes (M/W/C/F), and a nested `passengers` object. We expose the same
// LLM-facing shape as the other flight tools (YYYY-MM-DD, plain cabin names,
// flat passenger counts) and translate inside execute(). One format across
// the four MCP wrappers means the LLM doesn't trip over per-vendor quirks.

import { tool } from 'ai';
import { z } from 'zod';
import { callMcpTool, sanitizeMcpError } from '@/lib/mcp/http-mcp-tool';
import { sanitizeForCodeblock } from './mcp-output-sanitizer';

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

export type KiwiToolResult = string;

const SELF_TRANSFER_WARNING =
  '⚠️ Selbst-Umstieg: Gepäck neu einchecken, Anschluss nicht von der Airline garantiert.';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function readText(record: UnknownRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  if (typeof value !== 'string') return undefined;
  const sanitized = sanitizeForCodeblock(value);
  return typeof sanitized === 'string'
    ? sanitized.replace(/[\r\n]+/g, ' ').trim()
    : undefined;
}

function readNumber(record: UnknownRecord | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds < 0) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')} h`;
}

function getSegments(leg: UnknownRecord | undefined): UnknownRecord[] {
  const segments = leg?.segments;
  return Array.isArray(segments) ? segments.filter(isRecord) : [];
}

function orderedAirlines(segments: UnknownRecord[]): string[] {
  const airlines: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const airline = readText(segment, 'carrierName') ?? readText(segment, 'carrier');
    if (airline && !seen.has(airline)) {
      seen.add(airline);
      airlines.push(airline);
    }
  }

  return airlines;
}

function hasAirlineChange(segments: UnknownRecord[]): boolean {
  const carriers = segments
    .map((segment) => readText(segment, 'carrier'))
    .filter((carrier): carrier is string => carrier !== undefined);
  return new Set(carriers).size > 1;
}

function formatRoute(leg: UnknownRecord | undefined, segments: UnknownRecord[]): string {
  const route = leg?.route;
  if (Array.isArray(route)) {
    const airports = route.filter((airport): airport is string => typeof airport === 'string');
    if (airports.length > 0) {
      return airports.join(' → ');
    }
  }

  const first = segments[0];
  const last = segments.at(-1);
  const from = readText(leg, 'from') ?? readText(first, 'from');
  const to = readText(leg, 'to') ?? readText(last, 'to');
  return from && to ? `${from} → ${to}` : '—';
}

function formatLeg(label: 'Hinflug' | 'Rückflug', value: unknown): {
  line: string;
  hasAirlineChange: boolean;
} | null {
  const leg = asRecord(value);
  if (!leg) return null;

  const segments = getSegments(leg);
  const airlines = orderedAirlines(segments);
  const route = formatRoute(leg, segments);
  const stops = readNumber(leg, 'stops');
  const departure = readText(leg, 'departureTime') ?? '—';
  const arrival = readText(leg, 'arrivalTime') ?? '—';

  return {
    line: `- **${label}:** Route: ${route} · Stops: ${stops ?? '—'} · Airlines: ${airlines.join(', ') || '—'} · Abflug: ${departure} · Ankunft: ${arrival}`,
    hasAirlineChange: hasAirlineChange(segments),
  };
}

function formatBaggage(value: unknown): string {
  const baggage = asRecord(value);
  return [
    `Persönlicher Gegenstand: ${readNumber(baggage, 'personalItem') ?? '—'}`,
    `Handgepäck: ${readNumber(baggage, 'cabinBag') ?? '—'}`,
    `Aufgabegepäck: ${readNumber(baggage, 'checkedBag') ?? '—'}`,
  ].join(' · ');
}

function formatPrice(
  itinerary: UnknownRecord,
  currency: string,
): string {
  const formatted = readText(itinerary, 'priceFormatted');
  if (formatted) return formatted;
  const price = readNumber(itinerary, 'price');
  return price === undefined ? '—' : `${price} ${currency}`;
}

function formatItinerary(
  value: unknown,
  index: number,
  currency: string,
): string {
  const itinerary = asRecord(value) ?? {};
  const outbound = formatLeg('Hinflug', itinerary.outbound);
  const inbound = formatLeg('Rückflug', itinerary.inbound);
  const bookingUrl = readText(itinerary, 'bookingUrl');
  const lines = [
    `### ${index + 1}. ${formatPrice(itinerary, currency)} · Gesamtdauer: ${formatDuration(readNumber(itinerary, 'totalDurationSeconds'))}`,
  ];

  if (outbound) lines.push(outbound.line);
  if (inbound) lines.push(inbound.line);
  lines.push(`- **Gepäck:** ${formatBaggage(itinerary.baggage)}`);
  lines.push(bookingUrl ? `- [Bei Kiwi buchen](${bookingUrl})` : '- Buchungslink: —');

  if (outbound?.hasAirlineChange || inbound?.hasAirlineChange) {
    lines.push(SELF_TRANSFER_WARNING);
  }

  return lines.join('\n');
}

function formatJsonFallback(raw: unknown): string {
  let body: string;
  try {
    const sanitized = sanitizeForCodeblock(raw);
    body = JSON.stringify(sanitized, null, 2) ?? String(sanitized);
  } catch {
    body = String(sanitizeForCodeblock(String(raw)));
  }
  return ['## Kiwi.com Flights', '', '```json', body, '```'].join('\n');
}

/**
 * Renders Kiwi itineraries as compact Markdown.
 *
 * @param raw - Raw MCP tool result.
 * @returns Markdown results or a sanitized JSON fallback for unknown shapes.
 */
export function formatKiwiResults(raw: unknown): string {
  const root = asRecord(raw);
  const structuredContent = asRecord(root?.structuredContent);
  const itineraries = structuredContent?.itineraries;
  if (!Array.isArray(itineraries)) {
    return formatJsonFallback(raw);
  }

  const query = readText(structuredContent, 'query') ?? '—';
  const currency = readText(structuredContent, 'currency') ?? '—';
  const resultsCount = readNumber(structuredContent, 'resultsCount') ?? itineraries.length;
  const blocks = itineraries
    .slice(0, 10)
    .map((itinerary, index) => formatItinerary(itinerary, index, currency));

  return [
    '## Kiwi.com Flights',
    '',
    `**Suche:** ${query} · **Ergebnisse:** ${resultsCount} · **Währung:** ${currency}`,
    ...blocks.flatMap((block) => ['', block]),
  ].join('\n');
}

/**
 * Renders a sanitized Kiwi transport error.
 *
 * @param rawError - Raw transport error.
 * @returns User-readable Markdown error.
 */
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

/**
 * Creates the Kiwi flight-search tool with optional transport dependencies.
 *
 * @param deps - Optional dependencies used by the MCP transport.
 * @returns Configured AI SDK tool.
 */
export function createKiwiFlightSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      "Search Kiwi.com alongside search_flights for cash flights, including standard schedules, multi-stop routes, and virtual interlining that combines tickets from multiple airlines. Returns compact itineraries with prices, routes, airlines, baggage, and Kiwi booking links. Default sort is price.",
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
