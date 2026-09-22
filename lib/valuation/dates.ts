import { DEFAULT_REVIEW_MONTHS } from './types';

/**
 * Parse an actual ISO calendar date without accepting JavaScript's date rollover.
 * @param value - YYYY-MM-DD text.
 * @returns UTC midnight, or undefined for malformed/nonexistent dates.
 */
export function parseCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : undefined;
}

/**
 * Normalize the source's stated month to its first day.
 * @param value - A valid YYYY-MM or YYYY-MM-DD source date.
 * @returns The first day in UTC, or undefined for invalid input.
 */
export function parseSourceMonth(value: string): Date | undefined {
  const date = parseCalendarDate(/^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value);
  if (date) date.setUTCDate(1);
  return date;
}

/**
 * Calculate the default six-month review deadline from a source month.
 * @param sourceAsOf - Source month normalized to its first day.
 * @returns Independent UTC date six calendar months later.
 */
export function defaultReviewDue(sourceAsOf: Date): Date {
  const due = new Date(sourceAsOf);
  due.setUTCMonth(due.getUTCMonth() + DEFAULT_REVIEW_MONTHS);
  return due;
}
