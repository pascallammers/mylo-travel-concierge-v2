import { dbUncached } from '@/lib/db';
import { failoverEvents } from '@/lib/db/schema';
import { type FailoverEvent, extractFailoverEvent } from '@/lib/observability/failover-metrics';

/**
 * Persists an extracted AI Gateway failover event without throwing to callers.
 *
 * If the chat-id FK fails because the chat row hasn't been written yet (race
 * with saveChat() running in parallel via after()), the event is retried with
 * chat_id=null so the metric survives.
 *
 * @param event - Narrow failover event extracted from provider metadata.
 * @param chatId - Optional chat id associated with the request.
 * @returns Promise that resolves after the best-effort write attempt.
 */
export async function persistFailoverEvent(event: FailoverEvent, chatId?: string | null): Promise<void> {
  const baseValues = {
    originalModelId: event.originalModelId,
    finalProvider: event.finalProvider,
    modelAttemptCount: event.modelAttemptCount,
    primarySucceeded: event.primarySucceeded,
    totalProviderAttemptCount: event.totalProviderAttemptCount,
    fallbackChain: event.fallbackChain,
  };

  try {
    await dbUncached.insert(failoverEvents).values({ ...baseValues, chatId: chatId ?? null });
    return;
  } catch (error) {
    if (chatId && isForeignKeyViolation(error)) {
      try {
        await dbUncached.insert(failoverEvents).values({ ...baseValues, chatId: null });
        return;
      } catch (retryError) {
        console.warn(
          '[failover-observability] Failed to persist failover event after FK retry:',
          retryError instanceof Error ? retryError.message : retryError,
        );
        return;
      }
    }
    console.warn(
      '[failover-observability] Failed to persist failover event:',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Extracts a failover event from provider metadata and persists it best-effort.
 *
 * @param providerMetadata - Raw AI SDK provider metadata.
 * @param chatId - Optional chat id associated with the request.
 * @returns Promise that resolves after the best-effort write attempt.
 */
export async function persistFailoverMetadata(providerMetadata: unknown, chatId?: string | null): Promise<void> {
  const event = extractFailoverEvent(providerMetadata);

  if (!event) {
    return;
  }

  await persistFailoverEvent(event, chatId);
}

/**
 * Records a synthetic failover event when the stream fails before any gateway
 * routing metadata is available (e.g., handshake-level errors, total provider
 * outages, network failures). Without this, the most critical outages stay
 * invisible in the observability pipeline.
 *
 * @param originalModelId - The intended model id, e.g. 'xai/grok-4.3'.
 * @param chatId - Optional chat id associated with the request.
 * @returns Promise that resolves after the best-effort write attempt.
 */
export async function recordGatewayFailure(
  originalModelId: string,
  chatId?: string | null,
): Promise<void> {
  const syntheticEvent: FailoverEvent = {
    originalModelId,
    finalProvider: 'unknown',
    modelAttemptCount: 1,
    primarySucceeded: false,
    totalProviderAttemptCount: 0,
    fallbackChain: [originalModelId],
  };
  await persistFailoverEvent(syntheticEvent, chatId);
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
