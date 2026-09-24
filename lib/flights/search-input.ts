import { z } from 'zod';
import { flightSearchInputSchema } from '@/lib/tools/flight-search-schema';

const fields = flightSearchInputSchema.shape;
export const AWARD_FLEX_DAYS = 3;
export const iataSchema = fields.origin.trim().toUpperCase().regex(/^[A-Z]{3}$/).brand<'IataCode'>();
export const isoDateSchema = fields.departDate.brand<'IsoDate'>();
export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/)
  .refine((month) => fields.departDate.safeParse(`${month}-01`).success).brand<'YearMonth'>();
export type IataCode = z.infer<typeof iataSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type YearMonth = z.infer<typeof yearMonthSchema>;
const searchWindowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('day'), date: isoDateSchema,
    flexDays: fields.flexibility.transform((days): 0 | 3 => days > 0 ? AWARD_FLEX_DAYS : 0) }),
  z.object({ kind: z.literal('month'), month: yearMonthSchema }),
]);
export type SearchWindow = z.infer<typeof searchWindowSchema>;
const searchSchema = z.object({
  origin: iataSchema, destination: iataSchema,
  outbound: searchWindowSchema, inbound: searchWindowSchema.nullable().default(null),
  cabin: fields.cabin, passengers: fields.passengers, nonStop: fields.nonStop,
  loyaltyPrograms: fields.loyaltyPrograms, maxTaxes: fields.maxTaxes,
});
declare const resolved: unique symbol;
export type ResolvedFlightSearch = Readonly<z.infer<typeof searchSchema>> & {
  readonly today: string; readonly [resolved]: true;
};
export type TravelDateIssue = 'depart_in_past' | 'return_in_past' | 'return_before_depart';
export interface SearchIssue {
  field: keyof z.infer<typeof searchSchema>;
  code: 'invalid' | 'same_airport' | 'month_in_past' | TravelDateIssue;
}

/**
 * Format the server-local calendar day (preserves the chat's date boundary).
 * @param now - Current time supplied by the caller.
 * @returns YYYY-MM-DD.
 */
export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Apply the historical chat date checks in their original order.
 * @param dates - Departure and optional return date.
 * @param today - Current calendar day.
 * @returns First violated rule, or null.
 */
export function checkTravelDates(dates: { departDate: string; returnDate?: string | null }, today: string): TravelDateIssue | null {
  if (dates.departDate < today) return 'depart_in_past';
  if (dates.returnDate && dates.returnDate < today) return 'return_in_past';
  if (dates.returnDate && dates.returnDate < dates.departDate) return 'return_before_depart';
  return null;
}

/**
 * Resolve a window without additional provider requests; clip elapsed month days.
 * @param window - Valid day/flex or month selection.
 * @param today - Current calendar day.
 * @returns Inclusive provider date bounds.
 */
export function searchWindowBounds(window: SearchWindow, today: string): { start: string; end: string } {
  if (window.kind === 'month') {
    const first = `${window.month}-01`;
    const [year, month] = window.month.split('-').map(Number);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { start: first < today ? today : first, end };
  }
  const shift = (days: number) => {
    const date = new Date(`${window.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  return { start: shift(-window.flexDays), end: shift(window.flexDays) };
}

/**
 * Construct a validated, branded award search at the chat or URL boundary.
 * @param input - Untrusted fields composed from the unchanged tool validators.
 * @param today - Current calendar day; also used for clipping month windows.
 * @returns Valid search or field-specific issues without throwing.
 */
export function resolveFlightSearch(input: unknown, today: string):
  | { ok: true; search: ResolvedFlightSearch }
  | { ok: false; issues: SearchIssue[] } {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((issue) => ({
    field: issue.path[0] as SearchIssue['field'], code: 'invalid',
  })) };
  const search = parsed.data;
  const issues: SearchIssue[] = [];
  if (search.origin === search.destination) issues.push({ field: 'destination', code: 'same_airport' });
  for (const field of ['outbound', 'inbound'] as const) {
    const window = search[field];
    if (!window) continue;
    if (window.kind === 'month' && searchWindowBounds(window, today).end < today) {
      issues.push({ field, code: 'month_in_past' });
    } else if (window.kind === 'day' && window.date < today) {
      issues.push({ field, code: field === 'outbound' ? 'depart_in_past' : 'return_in_past' });
    }
  }
  if (!issues.length && search.inbound) {
    const out = searchWindowBounds(search.outbound, today);
    const ret = searchWindowBounds(search.inbound, today);
    // Same-month/overlapping windows are independent one-way options, not matched pairs.
    const firstDeparture = search.outbound.kind === 'day' ? search.outbound.date : out.start;
    const lastReturn = search.inbound.kind === 'day' ? search.inbound.date : ret.end;
    if (lastReturn < firstDeparture) issues.push({ field: 'inbound', code: 'return_before_depart' });
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, search: { ...search, today } as ResolvedFlightSearch };
}
