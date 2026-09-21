import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Plane, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth-utils';
import { getActiveDeals, getUserDealPreferences } from '@/lib/db/deal-queries';
import { hasFlightDealsAccess } from '@/lib/deals/flight-deals-access';
import {
  buildDealsPageData,
  createDealPreferenceSnapshot,
  parseDealsFilters,
} from '@/lib/deals';
import { getAirportDetails } from '@/lib/utils/airport-database';
import { DealCard } from './components/deal-card';
import { DealDigestLine } from './components/deal-digest-line';
import { DealFilters } from './components/deal-filters';
import { DealPreferencesPanel } from './components/deal-preferences-panel';

/**
 * Build localized metadata for the deals page.
 * @param props - Promised locale route parameters.
 * @returns Page title and description.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'deals' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

/**
 * Render the member deals feed with personalized filters.
 * @param props - Promised locale and URL search parameters.
 * @returns The deals page, access notice, or loading error.
 */
export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const rawSearchParams = await searchParams;
  const t = await getTranslations({ locale, namespace: 'deals' });

  try {
    const user = await getUser();
    if (!(await hasFlightDealsAccess(user?.id))) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <Plane className="mb-4 size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('restricted.title')}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t('restricted.description')}
            </p>
            <Button asChild className="mt-6">
              <a href={`/${locale}`}>{t('restricted.cta')}</a>
            </Button>
          </div>
        </div>
      );
    }

    const userPreferences = user ? await getUserDealPreferences(user.id) : null;
    const preferenceSnapshot = createDealPreferenceSnapshot(userPreferences);
    const filters = parseDealsFilters(rawSearchParams, preferenceSnapshot.originAirports);
    const [originAirportOptions, preferredDestinationOptions] = await Promise.all([
      hydrateSelectedAirports(preferenceSnapshot.originAirports),
      hydrateSelectedAirports(preferenceSnapshot.preferredDestinations),
    ]);
    const deals = await getActiveDeals({
      minScore: 60,
      limit: 300,
    });
    const model = await buildDealsPageData(deals, filters, new Date(), preferenceSnapshot, locale);

    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
          </div>
          {model.staleHours !== null && model.staleHours > 24 && (
            <p className="text-sm text-muted-foreground">
              {t('staleNotice', { hours: model.staleHours })}
            </p>
          )}
        </div>

        <div className="mb-8">
          <DealPreferencesPanel
            key={`${preferenceSnapshot.emailDigest}:${preferenceSnapshot.originAirports.join(',')}`}
            locale={locale}
            initialOriginAirports={originAirportOptions}
            initialPreferredDestinations={preferredDestinationOptions}
            initialCabinClass={preferenceSnapshot.cabinClass}
            initialMaxPrice={preferenceSnapshot.maxPrice}
            initialEmailDigest={preferenceSnapshot.emailDigest}
          />
        </div>

        <div className="mb-8">
          <DealFilters
            filters={filters}
            kindCounts={model.kindCounts}
            preferredOrigins={preferenceSnapshot.originAirports}
          />
        </div>

        <DealDigestLine
          locale={locale}
          originAirports={filters.origins}
          emailDigest={preferenceSnapshot.emailDigest}
        />

        {model.deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <Plane className="mb-4 size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t('empty.description')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {model.deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                showScore={true}
                showFreshLabel={filters.sort === 'score'}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <RefreshCcw className="mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('error.title')}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t('error.description')}
          </p>
          <Button asChild className="mt-6">
            <a href={`/${locale}/deals`}>{t('error.retry')}</a>
          </Button>
        </div>
      </div>
    );
  }
}

/**
 * Hydrate persisted airport codes with readable airport labels for the preferences UI.
 *
 * @param airportCodes - Stored IATA codes from the user preferences.
 * @returns Airport labels and metadata for the multi-select trigger and chips.
 */
async function hydrateSelectedAirports(airportCodes: string[]) {
  const airportEntries = await Promise.all(
    airportCodes.map(async (airportCode) => {
      const airport = await getAirportDetails(airportCode);

      return {
        iataCode: airportCode,
        name: airport?.airport ?? airportCode,
        countryCode: airport?.country_code ?? '',
      };
    }),
  );

  return airportEntries;
}
