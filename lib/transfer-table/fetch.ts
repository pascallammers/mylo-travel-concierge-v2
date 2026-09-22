export const TRANSFER_FETCH_TIMEOUT_MS = 15_000;
export const TRANSFER_FETCH_ATTEMPTS = 3;
export const TRANSFER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** A response that will not improve on retry: a definite status or the wrong content type. */
class PermanentFetchError extends Error {}

const isTransientStatus = (status: number) => status >= 500 || status === 408 || status === 429;

async function fetchOnce(fetcher: typeof fetch, url: string): Promise<string> {
  const response = await fetcher(url, {
    headers: { 'User-Agent': TRANSFER_USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(TRANSFER_FETCH_TIMEOUT_MS),
    cache: 'no-store',
  }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.name : 'unbekannt';
    throw new Error(`Die Quelle konnte nicht abgerufen werden (Verbindungsfehler oder Zeitüberschreitung: ${reason}).`);
  });
  if (!response.ok) {
    const message = `Quelle nicht erreichbar (HTTP ${response.status}).`;
    throw isTransientStatus(response.status) ? new Error(message) : new PermanentFetchError(message);
  }
  if (!response.headers.get('content-type')?.includes('text/html'))
    throw new PermanentFetchError('Die Quelle hat keine HTML-Seite geliefert.');
  return response.text().catch(() => {
    throw new Error('Der Quelltext konnte nicht vollständig gelesen werden.');
  });
}

/**
 * Load source HTML with a desktop browser identity and a bounded request lifetime.
 * The Amex page stalls single connections now and then, and the cron runs only monthly,
 * so a failed attempt is repeated before the check is logged as a source error.
 * @param fetcher - Injected HTTP fetch implementation.
 * @param retryDelayMs - Pause between attempts.
 * @returns Source loader enforcing status and content-type checks.
 */
export function createFetchHtml(fetcher: typeof fetch, retryDelayMs = 2_000): (url: string) => Promise<string> {
  return async (url) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= TRANSFER_FETCH_ATTEMPTS; attempt++) {
      try {
        return await fetchOnce(fetcher, url);
      } catch (error) {
        lastError = error;
        if (error instanceof PermanentFetchError) throw error;
        if (attempt < TRANSFER_FETCH_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
    throw lastError;
  };
}
