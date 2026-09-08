// lib/tools/trivago-hotel-search.ts
//
// AI SDK tool that wraps Trivago's `trivago-accommodation-radius-search` MCP
// via the shared http-mcp-tool helper. Trivago requires session init and
// returns raw JSON (not SSE). The helper handles both transparently.
//
// Requests always use the German market, EUR, and German text. Trivago's
// system_message and photos are deliberately dropped because the model must
// follow MYLO's prompt, not provider-supplied instructions.
//
// Filter translation: Trivago's hotel_rating, review_rating, and filters
// are nested objects with per-key booleans. We expose a flat, LLM-friendly
// shape (minStars, minReviewRating, freeCancellation, breakfastIncluded)
// and rebuild the nested shape inside execute().

import { tool } from 'ai';
import { z } from 'zod';
import {
  callMcpTool,
  McpToolFailure,
  readMcpUpstreamError,
  sanitizeMcpError,
} from '@/lib/mcp/http-mcp-tool';
import { sanitizeForCodeblock } from './mcp-output-sanitizer';

const TRIVAGO_URL = 'https://mcp.trivago.com/mcp';
const TRIVAGO_MARKET = { country: 'DE', currency: 'EUR', language: 'DE_DE' } as const;
const MAX_ACCOMMODATIONS = 10;
const TRIVAGO_HOSTNAME = /^([a-z0-9-]+\.)*trivago\.[a-z]{2,}(\.[a-z]{2})?$/;
const MARKDOWN_SYNTAX = /[\\[\]()<>*_!#`]/g;
const GROUPED_COUNT = /^\d{1,3}(,\d{3})+$/;

const REVIEW_TIERS = ['7.0', '7.5', '8.0', '8.5'] as const;

const inputSchema = z
  .object({
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
  })
  .refine((v) => (v.children > 0 ? !!v.childrenAges : true), {
    message:
      'childrenAges is required when children > 0 (dash-separated ages, e.g. "10-12-14").',
    path: ['childrenAges'],
  })
  .refine(
    (v) => {
      if (v.children === 0) return true;
      if (!v.childrenAges) return true; // already caught by previous refine
      const count = v.childrenAges.split('-').length;
      return count === v.children;
    },
    {
      message:
        'childrenAges must list exactly one age per child (separated by dashes). E.g. children=2 → "10-12".',
      path: ['childrenAges'],
    },
  )
  .refine((v) => Date.parse(v.departure) > Date.parse(v.arrival), {
    message: 'departure must be strictly after arrival (YYYY-MM-DD).',
    path: ['departure'],
  })
  .refine((v) => v.rooms <= v.adults, {
    message: 'rooms must be <= adults (Trivago rejects bookings with more rooms than adults).',
    path: ['rooms'],
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
    ...TRIVAGO_MARKET,
    latitude: input.latitude,
    longitude: input.longitude,
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

export type TrivagoToolResult = string;

type UnknownRecord = Record<string, unknown>;

interface TrivagoAccommodation {
  name?: string;
  stars?: number;
  reviewRating?: string;
  reviewCount?: string;
  pricePerNight?: string;
  pricePerStay?: string;
  currency?: string;
  advertiser?: string;
  distance?: string;
  amenities?: string;
  url?: string;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : undefined;
}

function readText(record: UnknownRecord | undefined, key: string, maxLength = 80): string | undefined {
  const value = record?.[key];
  if (typeof value !== 'string') return undefined;
  const sanitized = sanitizeForCodeblock(value);
  if (typeof sanitized !== 'string') return undefined;
  const text = sanitized
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return text || undefined;
}

function readMarkdownText(record: UnknownRecord | undefined, key: string, maxLength = 80): string | undefined {
  return readText(record, key, maxLength)?.replace(MARKDOWN_SYNTAX, (character) => `\\${character}`);
}

function readReviewCount(record: UnknownRecord): string | undefined {
  const count = readMarkdownText(record, 'review_count');
  return count && GROUPED_COUNT.test(count) ? count.replace(/,/g, '.') : count;
}

function readNumber(record: UnknownRecord | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readTrivagoUrl(record: UnknownRecord): string | undefined {
  const raw = readText(record, 'accommodation_url', 2_048);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  return url.protocol === 'https:' && TRIVAGO_HOSTNAME.test(url.hostname.toLowerCase()) ? url.href : undefined;
}

function parseAccommodation(value: unknown): TrivagoAccommodation | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    name: readMarkdownText(record, 'accommodation_name', 120),
    stars: readNumber(record, 'hotel_rating'),
    reviewRating: readMarkdownText(record, 'review_rating'),
    reviewCount: readReviewCount(record),
    pricePerNight: readMarkdownText(record, 'price_per_night'),
    pricePerStay: readMarkdownText(record, 'price_per_stay'),
    currency: readMarkdownText(record, 'currency'),
    advertiser: readMarkdownText(record, 'advertisers'),
    distance: readMarkdownText(record, 'distance'),
    amenities: readMarkdownText(record, 'top_amenities', 200),
    url: readTrivagoUrl(record),
  };
}

function bookingLink(accommodation: TrivagoAccommodation): string {
  if (!accommodation.url) return '- Buchungslink: —';
  const href = accommodation.url
    .replace(/\]/g, '%5D')
    .replace(/[()]/g, (character) => (character === '(' ? '%28' : '%29'));
  return `- [Bei trivago ansehen](${href})`;
}

function formatRating(accommodation: TrivagoAccommodation): string {
  const stars = accommodation.stars;
  const starLabel = stars === undefined || stars <= 0 ? 'ohne Sterne' : stars === 1 ? '1 Stern' : `${stars} Sterne`;
  if (!accommodation.reviewRating) return starLabel;
  const reviewCount = accommodation.reviewCount ? ` (${accommodation.reviewCount} Bewertungen)` : '';
  return `${starLabel} · ${accommodation.reviewRating}/10${reviewCount}`;
}

function formatAccommodation(accommodation: TrivagoAccommodation, index: number): string {
  return [
    `### ${index + 1}. ${accommodation.name ?? '—'}`,
    `- **Preis:** ${accommodation.pricePerNight ?? '—'} pro Nacht · ${accommodation.pricePerStay ?? '—'} gesamt · Anbieter: ${accommodation.advertiser ?? '—'}`,
    `- **Bewertung:** ${formatRating(accommodation)}`,
    `- **Lage:** ${accommodation.distance ?? '—'}`,
    `- **Ausstattung:** ${accommodation.amenities ?? '—'}`,
    bookingLink(accommodation),
  ].join('\n');
}

function withoutTrivagoPayload(raw: unknown): unknown {
  const root = asRecord(raw);
  if (!root) return raw;
  const fallback: UnknownRecord = { ...root };
  delete fallback.content;

  const structuredContent = asRecord(fallback.structuredContent);
  if (structuredContent) {
    const safeStructuredContent = { ...structuredContent };
    delete safeStructuredContent.system_message;
    fallback.structuredContent = safeStructuredContent;
  }
  return fallback;
}

function formatJsonFallback(raw: unknown): string {
  let body: string;
  try {
    const sanitized = sanitizeForCodeblock(withoutTrivagoPayload(raw));
    body = JSON.stringify(sanitized, null, 2) ?? String(sanitized);
  } catch {
    body = String(sanitizeForCodeblock(String(withoutTrivagoPayload(raw))));
  }
  return ['## Trivago Hotels', '', '```json', body, '```'].join('\n');
}

export function formatTrivagoResults(raw: unknown): string {
  const root = asRecord(raw);
  const structuredContent = asRecord(root?.structuredContent);
  const rawAccommodations = structuredContent?.accommodations;
  if (!Array.isArray(rawAccommodations)) return formatJsonFallback(raw);

  const accommodations = rawAccommodations
    .map(parseAccommodation)
    .filter((value): value is TrivagoAccommodation => value !== undefined);
  const shown = accommodations.slice(0, MAX_ACCOMMODATIONS);
  const countLabel =
    accommodations.length > shown.length
      ? `${accommodations.length} (${shown.length} gezeigt)`
      : `${accommodations.length}`;
  const currency = accommodations[0]?.currency ?? '—';
  const blocks = shown.map(formatAccommodation);

  return [
    '## Trivago Hotels',
    '',
    `**Ergebnisse:** ${countLabel} · **Währung:** ${currency}`,
    ...(shown.length === 0 ? ['', 'Keine Hotels für diese Suche gefunden. Andere Daten, ein größerer Umkreis oder weniger Filter können helfen.'] : []),
    ...blocks.flatMap((block) => ['', block]),
  ].join('\n');
}

function trivagoFailure(rawError: string): McpToolFailure {
  const reason = sanitizeMcpError(rawError);
  const message = [
    '## Trivago search unavailable',
    '',
    `Trivago could not return results right now (reason: ${reason}). The user can try again in a moment, or we can fall back to other accommodation sources if available.`,
  ].join('\n');
  return new McpToolFailure('Trivago', reason, message);
}

interface ToolDeps {
  fetchImpl?: typeof fetch;
}

export function createTrivagoHotelSearchTool(deps: ToolDeps = {}) {
  return tool({
    description:
      'Search Trivago for hotels around given coordinates (city centre, landmark, or address); derive lat/lon from the place the user names. Prices come back in EUR for the German market, texts in German. Filter by minimum stars, minimum guest rating, free cancellation, and breakfast. Returns up to 10 hotels as Markdown cards (name, stars, guest rating, price per night and per stay, distance, amenities, trivago link). Present each hotel as its own card with its trivago link; never invent prices or links that are not in the result.',
    inputSchema,
    execute: async (input): Promise<TrivagoToolResult> => {
      const r = await callMcpTool({
        url: TRIVAGO_URL,
        toolName: 'trivago-accommodation-radius-search',
        args: buildTrivagoArgs(input),
        requiresSession: true,
        fetchImpl: deps.fetchImpl,
      });
      if (!r.ok) throw trivagoFailure(r.error);
      const upstreamError = readMcpUpstreamError(r.result);
      if (upstreamError) throw trivagoFailure(upstreamError);
      return formatTrivagoResults(r.result);
    },
  });
}

export const trivagoHotelSearchTool = createTrivagoHotelSearchTool();

export const _trivagoInternals = { buildHotelRating, buildReviewRating, buildTrivagoArgs, REVIEW_TIERS };
