export type Anchor = 'travel' | 'no_plan';
export const CABINS = ['all', 'economy', 'premium_economy', 'business', 'first'] as const;
export type Cabin = (typeof CABINS)[number];
export const DEFAULT_REVIEW_MONTHS = 6;

export interface RateKey {
  programId: string;
  anchor: Anchor;
  cabin: Cabin;
}

export interface RateValues {
  centsPerUnit: number;
  source: string;
  sourceUrl: string | null;
  sourceAsOf: Date;
  reviewDue: Date;
  note: string | null;
}

export interface RateVersion extends RateKey, RateValues {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  origin: 'seed' | 'admin';
  createdBy: string | null;
}

export interface NewRate extends RateKey, RateValues {
  createdBy: string | null;
}

export interface ResolvedRate extends Omit<RateValues, 'note'> {
  cabin: Cabin;
  stale: boolean;
}

export interface ValuationTable {
  /**
   * Resolve the requested cabin, falling back to the programme-wide rate.
   * @param programId - Registry programme ID.
   * @param anchor - Travel or no-plan value.
   * @param cabin - Requested cabin, defaulting to all.
   * @returns Current resolved rate, if available.
   */
  rateFor(programId: string, anchor: Anchor, cabin?: Cabin): ResolvedRate | undefined;
  /**
   * Test membership in the current travel/all allowlist.
   * @param programId - Registry programme ID.
   * @returns Whether the programme can be valued.
   */
  isRatable(programId: string): boolean;
  /** @returns Current allowlisted programme IDs in stable order. */
  programIds(): string[];
  /** @returns All overdue current rows, including their exact keys. */
  staleRates(): (ResolvedRate & RateKey)[];
  /** Oldest current travel/all source month, or an empty string for an empty allowlist. */
  tableAsOf: string;
}

export interface ValuationTransaction {
  /** @returns Whether even closed historical rows exist. */
  hasHistory(): Promise<boolean>;
  /** @returns All current rate versions. */
  currentRows(): Promise<RateVersion[]>;
  /**
   * Insert successors without overwriting history.
   * @param rows - New rate values and actors.
   * @param at - Effective timestamp.
   * @param origin - Seed or administrator provenance.
   * @returns Inserted versions.
   */
  insertRates(rows: readonly NewRate[], at: Date, origin: RateVersion['origin']): Promise<RateVersion[]>;
  /**
   * Close the current version of one key.
   * @param key - Exact rate identity.
   * @param at - End of validity.
   * @returns Completion after updating validity only.
   */
  closeRate(key: RateKey, at: Date): Promise<void>;
  /**
   * Read one current version under the write lock.
   * @param key - Exact rate identity.
   * @returns Current version, if present.
   */
  currentRow(key: RateKey): Promise<RateVersion | undefined>;
}

export interface ValuationRepository {
  /**
   * Serialize valuation mutations, including first seeding.
   * @param work - Work within the advisory-locked transaction.
   * @returns The callback result after commit.
   */
  withTransaction<T>(work: (tx: ValuationTransaction) => Promise<T>): Promise<T>;
  /** @returns Current versions through a read-only query. */
  loadCurrentRows(): Promise<RateVersion[]>;
  /**
   * Seed exactly once, including concurrent first visits.
   * @param now - Effective seed timestamp.
   * @returns Completion after verifying historical presence.
   */
  ensureSeeded(now: Date): Promise<void>;
  /**
   * Close and replace a rate, checking deviation under the same lock.
   * @param newRate - Successor and authenticated actor.
   * @param now - Effective replacement timestamp.
   * @param options - Explicit administrator confirmation for deviations above 25 percent.
   * @returns The newly inserted version.
   */
  replaceRate(newRate: NewRate, now: Date, options?: { confirmDeviation?: boolean }): Promise<RateVersion>;
}
