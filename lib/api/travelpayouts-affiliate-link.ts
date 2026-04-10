export interface TravelpayoutsAffiliateLinkParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
  marker?: string;
  locale?: string;
  currency?: string;
  tripClass?: 0 | 1 | 2;
}

/**
 * Build a Travelpayouts-powered search link for a cached flight deal.
 *
 * @param params - Route, dates, and optional affiliate metadata.
 * @returns A bootstrap search URL that redirects into a live Travelpayouts results page.
 */
export function buildTravelpayoutsAffiliateLink(
  params: TravelpayoutsAffiliateLinkParams,
): string {
  const url = new URL('https://hydra.aviasales.ru/searches/new');
  url.searchParams.set('origin_iata', params.origin.toUpperCase());
  url.searchParams.set('destination_iata', params.destination.toUpperCase());
  url.searchParams.set('depart_date', params.departDate);
  url.searchParams.set('adults', String(params.adults ?? 1));
  url.searchParams.set('children', '0');
  url.searchParams.set('infants', '0');
  url.searchParams.set('trip_class', String(params.tripClass ?? 0));
  url.searchParams.set('with_request', 'true');
  url.searchParams.set('currency', (params.currency ?? 'EUR').toLowerCase());
  url.searchParams.set('locale', params.locale ?? 'en');
  url.searchParams.set('oneway', params.returnDate ? '0' : '1');

  if (params.returnDate) {
    url.searchParams.set('return_date', params.returnDate);
  }

  if (params.marker) {
    url.searchParams.set('marker', params.marker);
  }

  return url.toString();
}
