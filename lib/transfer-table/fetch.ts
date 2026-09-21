export const TRANSFER_FETCH_TIMEOUT_MS = 20_000;
export const TRANSFER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * Load source HTML with a desktop browser identity and a bounded request lifetime.
 * @param fetcher - Injected HTTP fetch implementation.
 * @returns Source loader enforcing status and content-type checks.
 */
export function createFetchHtml(fetcher: typeof fetch): (url: string) => Promise<string> {
  return async (url) => {
    const response = await fetcher(url, {
      headers: { 'User-Agent': TRANSFER_USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(TRANSFER_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    }).catch(() => {
      throw new Error('Die Quelle konnte nicht abgerufen werden (Verbindungsfehler oder Zeitüberschreitung).');
    });
    if (!response.ok) throw new Error(`Quelle nicht erreichbar (HTTP ${response.status}).`);
    if (!response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Die Quelle hat keine HTML-Seite geliefert.');
    return response.text().catch(() => {
      throw new Error('Der Quelltext konnte nicht vollständig gelesen werden.');
    });
  };
}
