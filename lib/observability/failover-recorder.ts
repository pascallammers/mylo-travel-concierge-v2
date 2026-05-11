import { dbUncached } from '@/lib/db';
import { failoverEvents } from '@/lib/db/schema';
import { type FailoverEvent, extractFailoverEvent } from '@/lib/observability/failover-metrics';

interface PersistFailoverOptions {
  recoveryUsed?: boolean;
  streamId?: string | null;
  userId?: string | null;
}

/**
 * Persists an extracted AI Gateway failover event without throwing to callers.
 *
 * If the chat-id FK fails because the chat row hasn't been written yet (race
 * with saveChat() running in parallel via after()), the event is retried with
 * chat_id=null so the metric survives.
 *
 * @param event - Narrow failover event extracted from provider metadata.
 * @param chatId - Optional chat id associated with the request.
 * @param options - Optional recovery and request metadata.
 * @returns Promise resolving true when a row was persisted.
 */
export async function persistFailoverEvent(
  event: FailoverEvent,
  chatId?: string | null,
  options: PersistFailoverOptions = {},
): Promise<boolean> {
  const baseValues = {
    originalModelId: event.originalModelId,
    finalProvider: event.finalProvider,
    modelAttemptCount: event.modelAttemptCount,
    primarySucceeded: event.primarySucceeded,
    totalProviderAttemptCount: event.totalProviderAttemptCount,
    fallbackChain: event.fallbackChain,
    recoveryUsed: event.recoveryUsed ?? options.recoveryUsed ?? false,
    streamId: event.streamId ?? options.streamId ?? null,
    userId: event.userId ?? options.userId ?? null,
  };

  try {
    await dbUncached.insert(failoverEvents).values({ ...baseValues, chatId: chatId ?? null });
    return true;
  } catch (error) {
    if (chatId && isForeignKeyViolation(error)) {
      try {
        await dbUncached.insert(failoverEvents).values({ ...baseValues, chatId: null });
        return true;
      } catch (retryError) {
        console.warn(
          '[failover-observability] Failed to persist failover event after FK retry:',
          retryError instanceof Error ? retryError.message : retryError,
        );
        return false;
      }
    }
    console.warn(
      '[failover-observability] Failed to persist failover event:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Extracts a failover event from provider metadata and persists it best-effort.
 *
 * @param providerMetadata - Raw AI SDK provider metadata.
 * @param chatId - Optional chat id associated with the request.
 * @param options - Optional recovery and request metadata.
 * @returns Promise resolving true when a row was persisted.
 */
export async function persistFailoverMetadata(
  providerMetadata: unknown,
  chatId?: string | null,
  options: PersistFailoverOptions = {},
): Promise<boolean> {
  const event = extractFailoverEvent(providerMetadata);

  if (!event) {
    return false;
  }

  return await persistFailoverEvent(event, chatId, options);
}

/**
 * Records a synthetic failover event when the stream fails before any gateway
 * routing metadata is available (e.g., handshake-level errors, total provider
 * outages, network failures). Without this, the most critical outages stay
 * invisible in the observability pipeline.
 *
 * @param originalModelId - The intended model id, e.g. 'xai/grok-4.3'.
 * @param chatId - Optional chat id associated with the request.
 * @param options - Optional recovery and request metadata.
 * @returns Promise resolving true when a row was persisted.
 */
export async function recordGatewayFailure(
  originalModelId: string,
  chatId?: string | null,
  options: PersistFailoverOptions = {},
): Promise<boolean> {
  const syntheticEvent: FailoverEvent = {
    originalModelId,
    finalProvider: 'unknown',
    modelAttemptCount: 1,
    primarySucceeded: false,
    totalProviderAttemptCount: 0,
    fallbackChain: [originalModelId],
    recoveryUsed: options.recoveryUsed ?? false,
    streamId: options.streamId ?? null,
    userId: options.userId ?? null,
  };
  return await persistFailoverEvent(syntheticEvent, chatId, options);
}

function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  // PostgreSQL error code 23503 = foreign_key_violation. node-postgres surfaces
  // this on `.code`; some drivers wrap inside `.cause`.
  const code = (error as { code?: unknown }).code;
  if (code === '23503') return true;
  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object' && (cause as { code?: unknown }).code === '23503') {
    return true;
  }
  return false;
}
