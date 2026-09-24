export type NewChatParams = Record<string, string | string[] | undefined>;
export type ChatNewRequest = { kind: 'render' } | { kind: 'redirect'; url: string };

/**
 * Normalize supported handoff parameters in their existing priority order.
 * @param params - Incoming query parameters; repeated values use the first entry.
 * @returns Trimmed chat input, or an empty string without usable context.
 */
export function normalizeNewChatQuery(params: NewChatParams): string {
  const values = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return values.query?.trim() || values.q?.trim() || values.prefill?.trim() || buildRouteQuery(values);
}

/**
 * Render canonical new-chat requests and redirect aliases to the canonical URL.
 * @param locale - Active locale segment for the new chat route.
 * @param params - Incoming query parameters, including aliases and repeated values.
 * @returns A render decision or a localized redirect containing only normalized input.
 */
export function resolveChatNewRequest(locale: string, params: NewChatParams): ChatNewRequest {
  const keys = Object.keys(params);
  const query = normalizeNewChatQuery(params);
  if (keys.length === 0 || (keys.length === 1 && keys[0] === 'query' && query && params.query === query)) {
    return { kind: 'render' };
  }

  const url = new URL(`/${locale || 'en'}/chat/new`, 'https://example.com');
  if (query) url.searchParams.set('query', query);
  return { kind: 'redirect', url: `${url.pathname}${url.search}` };
}

/**
 * Build the localized redirect URL for starting a new chat with optional prefilled input.
 *
 * @param locale - Active locale segment used for the chat home route.
 * @param params - Query parameters received by the /new route.
 * @returns Localized redirect target with normalized `query` param when available.
 */
export function buildNewChatRedirectUrl(
  locale: string,
  params: Record<string, string | undefined>,
): string {
  const normalizedLocale = locale || 'en';
  const url = new URL(`/${normalizedLocale}`, 'https://example.com');
  const query = normalizeNewChatQuery(params);

  if (query) {
    url.searchParams.set('query', query);
  }

  return `${url.pathname}${url.search}`;
}

export interface DealPrefillMessageInput {
  origin: string;
  destinationName: string;
  price: number;
  averagePrice: number | null;
  currency: string;
  travelMonthLabel: string;
}

/**
 * Build the prefilled user message for the deal-to-chat handoff.
 *
 * @param input - Human-readable deal details shown on the deal card.
 * @returns Chat-ready message that preserves deal context for MYLO.
 */
export function buildDealPrefillMessage(
  input: DealPrefillMessageInput,
): string {
  const priceLabel = isPointsCurrency(input.currency)
    ? `${Math.round(input.price)} Punkte`
    : `${Math.round(input.price)} ${input.currency}`;
  const averagePriceSegment =
    input.averagePrice !== null ? ` (statt ${Math.round(input.averagePrice)})` : '';

  return `Ich habe einen Flight Deal gesehen: ${input.origin} → ${input.destinationName}, ${priceLabel}${averagePriceSegment}, ${input.travelMonthLabel}. Ist das ein guter Deal? Kannst du mir Optionen zeigen und die Reise planen?`;
}

function buildRouteQuery(params: Record<string, string | undefined>): string {
  const origin = params.origin?.trim();
  const destination = params.destination?.trim();

  if (origin && destination) {
    return `${origin} to ${destination}`;
  }

  return origin || destination || '';
}

function isPointsCurrency(currency: string): boolean {
  return currency === 'PTS' || currency === 'MIL';
}

/**
 * Build the /new handoff consumed by buildNewChatRedirectUrl.
 * @param locale - Active route locale.
 * @param prefill - Current search or other user-facing context.
 * @returns Encoded new-chat URL, or a blank new chat without context.
 */
export function buildNewChatHref(locale: string, prefill: string | null): string {
  const text = prefill?.trim();
  return `/${locale}/new${text ? `?${new URLSearchParams({ prefill: text })}` : ''}`;
}
