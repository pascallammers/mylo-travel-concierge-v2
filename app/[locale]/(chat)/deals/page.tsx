import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Plane, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth-utils';
import { getActiveDeals, getUserDealPreferences } from '@/lib/db/deal-queries';
import {
  buildDealsPageData,
  createDealPreferenceSnapshot,
  type DealBucket,
  type DealsPageFilters,
} from '@/lib/deals';
import { getAirportDetails } from '@/lib/utils/airport-database';
import { DealCard } from './components/deal-card';
import { DealFilters } from './components/deal-filters';
import { DealPreferencesPanel } from './components/deal-preferences-panel';
import { FeaturedDealHero } from './components/featured-deal-hero';

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
  const normalizedSearchParams = Object.fromEntries(
    Object.entries(rawSearchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const filters = parseDealsFilters(normalizedSearchParams);

  try {
    const user = await getUser();
    const userPreferences = user ? await getUserDealPreferences(user.id) : null;
    const preferenceSnapshot = createDealPreferenceSnapshot(userPreferences);
    const [originAirportOptions, preferredDestinationOptions] = await Promise.all([
      hydrateSelectedAirports(preferenceSnapshot.originAirports),
      hydrateSelectedAirports(preferenceSnapshot.preferredDestinations),
    ]);
    const deals = await getActiveDeals({
      origin: filters.origin,
      minScore: 60,
      limit: 120,
    });
    const model = await buildDealsPageData(deals, filters, new Date(), preferenceSnapshot, locale);
    const visibleSections = model.activeBucket === 'all'
      ? (['weekend_escape', 'long_haul', 'points'] as DealBucket[])
      : [model.activeBucket];
    const hasVisibleDeals = visibleSections.some((bucket) => model.visibleBuckets[bucket].length > 0);

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
            locale={locale}
            initialOriginAirports={originAirportOptions}
            initialPreferredDestinations={preferredDestinationOptions}
            initialCabinClass={preferenceSnapshot.cabinClass}
            initialMaxPrice={preferenceSnapshot.maxPrice}
            initialEmailDigest={preferenceSnapshot.emailDigest}
          />
        </div>

        {model.hasPersonalization && model.featuredDeal ? (
          <div className="mb-8">
            <FeaturedDealHero locale={locale} deal={model.featuredDeal} />
          </div>
        ) : null}

        <div className="mb-8">
          <DealFilters bucketCounts={model.bucketCounts} />
        </div>

        {!hasVisibleDeals ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <Plane className="mb-4 size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t('empty.description')}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleSections.map((bucket) => (
              <section key={bucket} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {t(`bucketsMeta.${bucket}.title`)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(`bucketsMeta.${bucket}.description`)}
                  </p>
                </div>

                {model.visibleBuckets[bucket].length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-4 py-10 text-sm text-muted-foreground">
                    {t(`bucketsMeta.${bucket}.empty`)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {model.visibleBuckets[bucket].map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        showScore={true}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </section>
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

function parseDealsFilters(
  searchParams: Record<string, string | undefined>,
): DealsPageFilters {
  const bucket = searchParams.bucket;
  const sort = searchParams.sort;
  const tripType = searchParams.tripType;
  const stops = searchParams.stops ? Number.parseInt(searchParams.stops, 10) : undefined;

  return {
    origin: searchParams.origin || undefined,
    bucket: isDealBucket(bucket) ? bucket : 'all',
    sort: isSortOption(sort) ? sort : 'score',
    tripType: tripType === 'roundtrip' || tripType === 'oneway' ? tripType : undefined,
    stops: Number.isFinite(stops) ? stops : undefined,
  };
}

function isDealBucket(value: string | undefined): value is DealBucket | 'all' {
  return value === 'all' || value === 'weekend_escape' || value === 'long_haul' || value === 'points';
}

function isSortOption(value: string | undefined): value is DealsPageFilters['sort'] {
  return value === 'score' || value === 'price' || value === 'savings';
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
