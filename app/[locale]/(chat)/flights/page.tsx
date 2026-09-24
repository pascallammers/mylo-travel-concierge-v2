import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth-utils';
import { checkUserAccess } from '@/lib/access-control';
import { hasFlightSearchAccess } from '@/lib/flights/flight-search-access';
import { searchSeatsAeroTrips } from '@/lib/api/seats-aero-client';
import { getProgramBookingUrl, getProgramDisplayName, getProgramCaveat } from '@/lib/api/award-search/program-registry';
import { formatTransferRatio } from '@/lib/config/transfer-engine';
import { getAirportDetails } from '@/lib/utils/airport-database';
import { loadAwardProgramSourceResolver } from '@/lib/transfer-table/award-sources';
import { readDachPartnerMaps } from '@/lib/transfer-table/runtime';
import { buildNewChatHref } from '@/lib/chat/new-chat-handoff';
import { searchAwards, parseFlightsQuery, flightsQueryString, todayIso, buildAwardResultsView,
  type ResolvedFlightSearch, type FlightsDraft } from '@/lib/flights';
import { Button } from '@/components/ui/button';
import { ChatEscapeCard } from '@/components/shell/chat-escape-card';
import { FlightSearchMask, AwardResults, AwardResultsSkeleton } from './components';

interface FlightsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Build the localized flights page title.
 * @param props - Promised locale route parameters.
 * @returns Area title and description.
 */
export async function generateMetadata({ params }: FlightsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'flights' });
  return { title: t('title'), description: t('subtitle') };
}

function sentence(text: string): string {
  return text ? ` ${text}.` : '';
}

async function AwardResultsSection({ search, draft, locale }: { search: ResolvedFlightSearch; draft: FlightsDraft; locale: string }) {
  const language = locale === 'en' ? 'en' : 'de';
  const [result, sources] = await Promise.all([
    searchAwards(search, { searchTrips: searchSeatsAeroTrips }, { locale: language }),
    loadAwardProgramSourceResolver(readDachPartnerMaps),
  ]);
  const view = buildAwardResultsView(result, search, language, {
    getProgramDisplayName, getProgramBookingUrl, getProgramCaveat, formatTransferRatio,
    getTransferSourcesForAwardProgram: sources,
  });
  return <AwardResults view={view} draft={draft} locale={locale} />;
}

/**
 * Authorize before resolving the URL and streaming the award-only result.
 * @param props - Async route and query parameters (Next.js 16.3).
 * @returns Search mask, keyed result boundary and contextual chat escape.
 */
export default async function FlightsPage({ params, searchParams }: FlightsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'flights' });
  const user = await getUser();
  if (!(await hasFlightSearchAccess(user?.id, checkUserAccess))) {
    return <div className="mx-auto max-w-3xl space-y-3 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">{t('restricted.title')}</h1>
      <p className="text-muted-foreground">{t('restricted.description')}</p>
      <Button asChild className="min-h-11"><a href={`/${locale}`}>{t('restricted.cta')}</a></Button>
    </div>;
  }
  const today = todayIso(new Date());
  const query = parseFlightsQuery(await searchParams, today);
  const key = flightsQueryString(query.draft);
  const airportLabels = Object.fromEntries(await Promise.all(
    [query.draft.origin, query.draft.destination].filter((code): code is string => Boolean(code))
      .map(async (code) => [code, (await getAirportDetails(code))?.airport ?? code]),
  ));
  const programLabels = Object.fromEntries(query.draft.programs.map((slug) => [slug, getProgramDisplayName(slug, locale === 'en' ? 'en' : 'de')]));
  const context = query.draft.origin && query.draft.destination ? t('escape.prefill', {
    origin: query.draft.origin, destination: query.draft.destination,
    dates: [query.draft.departDate ?? query.draft.month, query.draft.returnDate ?? query.draft.returnMonth].filter(Boolean).join(' / '),
    cabin: t(`cabins.${query.draft.cabin}`), passengers: query.draft.passengers,
    preferences: sentence([query.draft.flexible ? t('mask.flexible') : '', query.draft.nonStop ? t('mask.direct') : '',
      ...Object.values(programLabels)].filter(Boolean).join(', ')),
  }) : null;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('title')}</h1><p className="mt-2 text-muted-foreground">{t('subtitle')}</p></header>
      <FlightSearchMask key={`mask:${key}`} locale={locale} today={today} draft={query.draft}
        issues={query.status === 'draft' ? query.issues : []} airportLabels={airportLabels} programLabels={programLabels} />
      {query.status === 'ready' && <Suspense key={`results:${key}`} fallback={<AwardResultsSkeleton label={t('mask.searching')} />}>
        <AwardResultsSection search={query.search} draft={query.draft} locale={locale} />
      </Suspense>}
      <ChatEscapeCard href={buildNewChatHref(locale, context)} title={t('escape.title')} body={t('escape.body')} cta={t('escape.cta')} />
    </div>
  );
}
