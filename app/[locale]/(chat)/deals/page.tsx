import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getActiveDeals } from '@/lib/db/deal-queries';
import { DealCard } from './components/deal-card';
import { DealFilters } from './components/deal-filters';
import { Plane } from 'lucide-react';

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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const t = await getTranslations({ locale, namespace: 'deals' });

  const origin = filters.origin || undefined;
  const stopsFilter = filters.stops ? parseInt(filters.stops, 10) : undefined;

  const deals = await getActiveDeals({
    origin,
    minScore: 60,
    limit: 50,
  });

  const filteredDeals = stopsFilter !== undefined
    ? deals.filter((d) => (d.stops ?? 0) <= stopsFilter)
    : deals;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <DealFilters />
      </div>

      {/* Deal List */}
      {filteredDeals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Plane className="mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t('empty.description')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              showScore={true}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
