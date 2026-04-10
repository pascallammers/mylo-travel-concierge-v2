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
  const query = params.query?.trim() || params.q?.trim() || params.prefill?.trim() || buildRouteQuery(params);

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
