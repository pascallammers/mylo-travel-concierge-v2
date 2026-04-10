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

export interface TravelpayoutsLocalization {
  locale: 'de' | 'en';
  currency: 'EUR' | 'USD';
}

/**
 * Resolve the Travelpayouts locale and currency pair for the current UI locale.
 *
 * @param locale - Active app locale segment.
 * @returns Locale-aware Travelpayouts language and currency values.
 */
export function resolveTravelpayoutsLocalization(
  locale?: string,
): TravelpayoutsLocalization {
  if (locale?.toLowerCase().startsWith('de')) {
    return {
      locale: 'de',
      currency: 'EUR',
    };
  }

  return {
    locale: 'en',
    currency: 'USD',
  };
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
  const url = new URL(`https://www.aviasales.com/search/${buildAviasalesSearchCode(params)}`);

  if (params.marker) {
    url.searchParams.set('marker', params.marker);
  }

  if (params.locale) {
    url.searchParams.set('locale', params.locale);
  }

  if (params.currency) {
    url.searchParams.set('currency', params.currency.toUpperCase());
  }

  return url.toString();
}

function buildAviasalesSearchCode(params: TravelpayoutsAffiliateLinkParams): string {
  const departureCode = formatDateForSearchCode(params.departDate);
  const returnCode = params.returnDate ? formatDateForSearchCode(params.returnDate) : '';
  const classCode = mapTripClassToSearchCode(params.tripClass ?? 0);
  const adults = String(params.adults ?? 1);

  return [
    params.origin.toUpperCase(),
    departureCode,
    params.destination.toUpperCase(),
    returnCode,
    classCode,
    adults,
  ].join('');
}

function formatDateForSearchCode(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    throw new Error(`Invalid Travelpayouts date: ${value}`);
  }

  return `${day}${month}`;
}

function mapTripClassToSearchCode(tripClass: 0 | 1 | 2): '' | 'c' | 'f' {
  if (tripClass === 1) {
    return 'c';
  }

  if (tripClass === 2) {
    return 'f';
  }

  return '';
}
