export type SourceProgramId = 'amex_dach' | 'payback';
export type CheckOutcome = 'unchanged' | 'applied' | 'held' | 'source_error';
export type Resolution = 'approved' | 'rejected';

export interface RateValues {
  sourcePoints: number;
  partnerUnits: number;
  minTransfer: number;
  transferIncrement: number;
  transferDurationDe: string;
}

export interface CurrentRate extends RateValues {
  partnerKey: string;
}

export interface Observation {
  sourceName: string;
  sourceCode: string;
  partnerKey?: string;
  sourcePoints: number;
  partnerUnits: number;
  minTransfer: number;
  transferIncrement?: number;
  transferDurationDe?: string;
}

export type TransferChange =
  | { type: 'rate_changed'; partnerKey: string; before: RateValues; after: RateValues }
  | { type: 'terms_changed'; partnerKey: string; before: RateValues; after: RateValues }
  | { type: 'partner_removed'; partnerKey: string; before: RateValues }
  | { type: 'partner_added'; partnerKey?: string; observation: Observation };

export interface TransferCheck {
  id: string;
  sourceProgramId: SourceProgramId;
  checkedAt: Date;
  outcome: CheckOutcome;
  changes: TransferChange[];
  error: string | null;
  resolution: Resolution | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export type NewCheck = Omit<TransferCheck, 'id' | 'resolution' | 'resolvedAt' | 'resolvedBy'>;

export interface RateVersion extends CurrentRate {
  id: string;
  sourceProgramId: SourceProgramId;
  validFrom: Date;
  validTo: Date | null;
  origin: 'seed' | 'check';
  checkId: string | null;
}

export interface SourceTransaction {
  hasHistory(): Promise<boolean>;
  currentRows(): Promise<RateVersion[]>;
  insertRates(rows: CurrentRate[], at: Date, origin: 'seed' | 'check', checkId: string | null): Promise<void>;
  closeRates(keys: string[], at: Date): Promise<void>;
  insertCheck(check: NewCheck): Promise<TransferCheck>;
  getCheck(id: string): Promise<TransferCheck | undefined>;
  resolveCheck(id: string, resolution: Resolution, at: Date, adminUserId: string): Promise<void>;
  supersedeOpenHeldChecks(at: Date): Promise<void>;
}

export interface TransferRepository {
  withSourceTransaction<T>(source: SourceProgramId, work: (tx: SourceTransaction) => Promise<T>): Promise<T>;
  getCheck(id: string): Promise<TransferCheck | undefined>;
  loadSnapshot(): Promise<{ rows: RateVersion[]; checks: TransferCheck[] }>;
  loadDashboard(): Promise<{ latest: TransferCheck[]; held: TransferCheck[] }>;
}

export interface CheckSummary {
  sourceProgramId: SourceProgramId;
  /** `null` when the check could not be persisted at all. */
  checkId: string | null;
  outcome: CheckOutcome | 'check_failed';
  changeCount: number;
  mailError?: string;
}

/** `resolvedBy` marker for a held check replaced by a newer reading of the same source. */
export const SUPERSEDED_BY_NEWER_CHECK = 'superseded';
