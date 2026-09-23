/** Daily seats.aero call budget as last reported by the API. */
export interface SeatsAeroQuota {
  limit: number;
  remaining: number;
  resetsAt: Date;
}

export const SEATS_AERO_USER_RESERVE = 300;
export const SEATS_AERO_LOW_REMAINING_WARN = 100;

/**
 * Parse the daily budget reported in the response headers.
 * @param headers - Provider response headers.
 * @param now - Time at which the headers were observed.
 * @returns The reported budget, or null for missing or invalid values.
 */
export function parseSeatsAeroQuota(headers: Headers, now: Date): SeatsAeroQuota | null {
  const values = ['limit', 'remaining', 'reset'].map((name) => {
    const raw = headers.get(`x-ratelimit-${name}`);
    return raw === null || raw.trim() === '' ? NaN : Number(raw);
  });
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const [limit, remaining, resetSeconds] = values;
  const resetsAt = new Date(now.getTime() + resetSeconds * 1000);
  return Number.isFinite(resetsAt.getTime()) ? { limit, remaining, resetsAt } : null;
}

/**
 * Thrown when seats.aero answers 429 (daily budget used up). Never retried.
 * @param resetsAt - Reported or estimated reset time, if known.
 * @returns A typed daily-quota error.
 */
export class SeatsAeroQuotaExhaustedError extends Error {
  readonly resetsAt: Date | null;

  constructor(resetsAt: Date | null = null) {
    super('Seats.aero daily quota exhausted');
    this.name = 'SeatsAeroQuotaExhaustedError';
    this.resetsAt = resetsAt;
  }
}

/**
 * Check that a scanner step leaves the user reserve intact. Unknown quota permits scanning.
 * @param quota - Last known budget, or null when unknown.
 * @param callsNeeded - Calls required for the next scanner step.
 * @param reserve - Calls reserved for user searches.
 * @returns Whether the scanner can afford the step.
 */
export function hasScannerBudget(
  quota: SeatsAeroQuota | null,
  callsNeeded: number,
  reserve = SEATS_AERO_USER_RESERVE,
): boolean {
  return quota === null || quota.remaining - callsNeeded >= reserve;
}
