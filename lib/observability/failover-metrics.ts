export interface FailoverEvent {
  originalModelId: string;
  finalProvider: string;
  modelAttemptCount: number;
  primarySucceeded: boolean;
  totalProviderAttemptCount: number;
  fallbackChain: string[];
  recoveryUsed?: boolean;
  streamId?: string | null;
  userId?: string | null;
}

type UnknownRecord = Record<string, unknown>;

/**
 * Extracts stable AI Gateway failover fields from raw provider metadata.
 *
 * @param providerMetadata - Raw AI SDK provider metadata from streamText/generateText.
 * @returns A narrow failover event, or null when Gateway routing metadata is absent.
 */
export function extractFailoverEvent(providerMetadata: unknown): FailoverEvent | null {
  const routing = getRecord(getRecord(providerMetadata)?.gateway)?.routing;
  const routingRecord = getRecord(routing);

  if (!routingRecord) {
    return null;
  }

  const modelAttempts = getRecordArray(routingRecord.modelAttempts);
  const providerAttempts = modelAttempts.flatMap((attempt) =>
    getRecordArray(attempt.providerAttempts),
  );
  const flatAttempts = getRecordArray(routingRecord.attempts);
  const attempts = providerAttempts.length > 0 ? providerAttempts : flatAttempts;

  const originalModelId =
    getString(routingRecord.originalModelId) ??
    getString(routingRecord.canonicalSlug) ??
    getString(modelAttempts[0]?.modelId) ??
    getString(modelAttempts[0]?.canonicalSlug);
  const finalProvider =
    getString(routingRecord.finalProvider) ??
    getSuccessfulProvider(attempts) ??
    getString(routingRecord.resolvedProvider);

  if (!originalModelId || !finalProvider) {
    return null;
  }

  const fallbackChain = getFallbackChain(modelAttempts, originalModelId);
  const firstModelSucceeded = getBoolean(modelAttempts[0]?.success);
  const firstProviderSucceeded = getBoolean(attempts[0]?.success);
  // When attempts arrays are missing (schema drift / partial metadata), derive
  // primary success from the model id vs final provider. originalModelId is
  // formatted as 'xai/grok-4.3'; finalProvider is the bare slug 'xai'. If they
  // don't match, the gateway routed away from the primary even with no attempt
  // arrays present.
  const primarySucceeded =
    firstModelSucceeded ??
    firstProviderSucceeded ??
    derivePrimarySuccessFromIds(originalModelId, finalProvider);

  return {
    originalModelId,
    finalProvider,
    modelAttemptCount:
      getFiniteNumber(routingRecord.modelAttemptCount) ?? Math.max(fallbackChain.length, 1),
    primarySucceeded,
    totalProviderAttemptCount:
      getFiniteNumber(routingRecord.totalProviderAttemptCount) ?? Math.max(attempts.length, 1),
    fallbackChain,
  };
}

function getRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function getRecordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(getRecord).filter((record): record is UnknownRecord => record !== null);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function getFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function derivePrimarySuccessFromIds(originalModelId: string, finalProvider: string): boolean {
  // originalModelId follows 'provider/model' format per Vercel docs.
  const originalProvider = originalModelId.split('/')[0];
  return originalProvider === finalProvider;
}

function getSuccessfulProvider(attempts: UnknownRecord[]): string | null {
  const successfulAttempt = attempts.find((attempt) => attempt.success === true);
  return getString(successfulAttempt?.provider);
}

function getFallbackChain(modelAttempts: UnknownRecord[], originalModelId: string): string[] {
  const chain = modelAttempts
    .map((attempt) => getString(attempt.modelId) ?? getString(attempt.canonicalSlug))
    .filter((modelId): modelId is string => modelId !== null);

  return chain.length > 0 ? chain : [originalModelId];
}
