import { flightSearchInputSchema } from '@/lib/tools/flight-search-schema';
import { KNOWN_PROGRAM_SLUGS } from '@/lib/api/award-search/program-registry';
import {
  AWARD_FLEX_DAYS, iataSchema, isoDateSchema, yearMonthSchema, resolveFlightSearch,
  type ResolvedFlightSearch, type SearchIssue,
} from './search-input';

/** URL keys have a single home, shared by all readers and writers. */
export const FLIGHTS_PARAMS = {
  origin: 'from', destination: 'to', departDate: 'date', returnDate: 'return', month: 'month', returnMonth: 'returnMonth',
  flexible: 'flex', cabin: 'cabin', passengers: 'pax', nonStop: 'direct', programs: 'program',
} as const;
export interface FlightsDraft {
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departDate: string | null;
  readonly returnDate: string | null;
  readonly month: string | null;
  readonly returnMonth: string | null;
  readonly flexible: boolean;
  readonly cabin: ResolvedFlightSearch['cabin'];
  readonly passengers: number;
  readonly nonStop: boolean;
  readonly programs: readonly string[];
}
export const EMPTY_FLIGHTS_DRAFT: FlightsDraft = {
  origin: null, destination: null, departDate: null, returnDate: null, month: null, returnMonth: null,
  flexible: false, cabin: 'BUSINESS', passengers: 1, nonStop: false, programs: [],
};
export interface FlightsIssue {
  readonly field: keyof FlightsDraft;
  readonly code: SearchIssue['code'] | 'ambiguous_window';
}
export type FlightsQuery =
  | { status: 'draft'; draft: FlightsDraft; issues: FlightsIssue[] }
  | { status: 'ready'; draft: FlightsDraft; search: ResolvedFlightSearch };

/**
 * Parse the URL once; incomplete links prefill and valid complete links search immediately.
 * @param params - Untrusted query values; repeated keys use the first value.
 * @param today - Current calendar date.
 * @returns Normalized form draft, with either issues or a validated core search.
 */
export function parseFlightsQuery(params: Record<string, string | string[] | undefined>, today: string): FlightsQuery {
  const issues: FlightsIssue[] = [];
  const value = (field: keyof FlightsDraft) => {
    const raw = params[FLIGHTS_PARAMS[field]];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const invalid = (field: keyof FlightsDraft) => issues.push({ field, code: 'invalid' });
  const parseString = (field: 'origin' | 'destination' | 'departDate' | 'returnDate' | 'month' | 'returnMonth') => {
    const raw = value(field);
    if (raw === undefined) return null;
    const schema = field === 'origin' || field === 'destination' ? iataSchema
      : field === 'month' || field === 'returnMonth' ? yearMonthSchema : isoDateSchema;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    invalid(field); return null;
  };
  const fields = flightSearchInputSchema.shape;
  const cabin = fields.cabin.safeParse(value('cabin')?.toUpperCase() ?? 'BUSINESS');
  const passengers = fields.passengers.safeParse(value('passengers') === undefined ? 1 : Number(value('passengers')));
  const flex = fields.flexibility.safeParse(value('flexible') === undefined ? 0 : Number(value('flexible')));
  if (!cabin.success) invalid('cabin');
  if (!passengers.success) invalid('passengers');
  if (!flex.success || value('flexible') === '') invalid('flexible');
  if (value('nonStop') !== undefined && value('nonStop') !== '1') invalid('nonStop');
  const draft: FlightsDraft = {
    origin: parseString('origin'), destination: parseString('destination'),
    departDate: parseString('departDate'), returnDate: parseString('returnDate'),
    month: parseString('month'), returnMonth: parseString('returnMonth'),
    cabin: cabin.success ? cabin.data : 'BUSINESS', passengers: passengers.success ? passengers.data : 1,
    flexible: flex.success && flex.data > 0, nonStop: value('nonStop') === '1',
    programs: [...new Set((value('programs') ?? '').split(',').map((p) => p.trim().toLowerCase())
      .filter((p) => KNOWN_PROGRAM_SLUGS.includes(p)))].sort().slice(0, 5),
  };
  for (const [day, month] of [['departDate', 'month'], ['returnDate', 'returnMonth']] as const) {
    if (value(day) !== undefined && value(month) !== undefined) issues.push({ field: day, code: 'ambiguous_window' });
  }
  const complete = draft.origin && draft.destination && (draft.departDate || draft.month);
  if (!complete || issues.length) return { status: 'draft', draft, issues };
  const resolved = resolveFlightSearch({
    origin: draft.origin, destination: draft.destination,
    outbound: draft.month ? { kind: 'month', month: draft.month }
      : { kind: 'day', date: draft.departDate, flexDays: draft.flexible ? AWARD_FLEX_DAYS : 0 },
    inbound: draft.returnMonth ? { kind: 'month', month: draft.returnMonth }
      : draft.returnDate ? { kind: 'day', date: draft.returnDate, flexDays: draft.flexible ? AWARD_FLEX_DAYS : 0 } : null,
    cabin: draft.cabin, passengers: draft.passengers, nonStop: draft.nonStop, loyaltyPrograms: [...draft.programs],
  }, today);
  if (resolved.ok) return { status: 'ready', draft, search: resolved.search };
  return { status: 'draft', draft, issues: resolved.issues.map((issue) => ({
    field: issue.field === 'outbound' ? (draft.month ? 'month' : 'departDate')
      : issue.field === 'inbound' ? (draft.returnMonth ? 'returnMonth' : 'returnDate')
      : issue.field === 'loyaltyPrograms' ? 'programs' : issue.field as keyof FlightsDraft,
    code: issue.code,
  })) };
}

/**
 * Serialize a draft in canonical order, omitting defaults and unknown programs.
 * @param draft - Form or deal selection.
 * @returns Query string, also used as the Suspense and form reset key.
 */
export function flightsQueryString(draft: FlightsDraft): string {
  const values: Record<keyof FlightsDraft, string | null> = {
    origin: draft.origin?.trim().toUpperCase() ?? null, destination: draft.destination?.trim().toUpperCase() ?? null,
    departDate: draft.departDate, returnDate: draft.returnDate, month: draft.month, returnMonth: draft.returnMonth,
    flexible: draft.flexible ? String(AWARD_FLEX_DAYS) : null,
    cabin: draft.cabin === 'BUSINESS' ? null : draft.cabin.toLowerCase(),
    passengers: draft.passengers === 1 ? null : String(draft.passengers), nonStop: draft.nonStop ? '1' : null,
    programs: [...new Set(draft.programs.filter((p) => KNOWN_PROGRAM_SLUGS.includes(p)))].sort().slice(0, 5).join(',') || null,
  };
  const params = new URLSearchParams();
  for (const field of Object.keys(FLIGHTS_PARAMS) as Array<keyof FlightsDraft>) {
    const value = values[field];
    if (value !== null) params.set(FLIGHTS_PARAMS[field], value);
  }
  return params.toString();
}

/**
 * Build a locale-aware mask link without speculative search prefetching.
 * @param locale - App locale.
 * @param draft - Search selection.
 * @returns Flights URL.
 */
export function buildFlightsHref(locale: string, draft: FlightsDraft): string {
  const query = flightsQueryString(draft);
  return `/${locale}/flights${query ? `?${query}` : ''}`;
}

/**
 * Prefill the deal route, date, cabin and program with a three-day flex window.
 * @param deal - Award deal fields, including its seats.aero program when known.
 * @returns Searchable one-way draft.
 */
export function flightsDraftFromDeal(deal: {
  origin: string; destination: string; departureDate: Date; cabinClass: string; programId: string | null;
}): FlightsDraft {
  const cabin = flightSearchInputSchema.shape.cabin.safeParse(deal.cabinClass.toUpperCase());
  return { ...EMPTY_FLIGHTS_DRAFT, origin: deal.origin.toUpperCase(), destination: deal.destination.toUpperCase(),
    departDate: deal.departureDate.toISOString().slice(0, 10), flexible: true,
    cabin: cabin.success ? cabin.data : 'BUSINESS',
    programs: deal.programId && KNOWN_PROGRAM_SLUGS.includes(deal.programId) ? [deal.programId] : [] };
}
