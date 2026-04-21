import { Search, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { buildDealPrefillMessage } from '@/lib/chat/new-chat-handoff';
import type { PresentedDeal } from '@/lib/deals';
import { DealScoreBadge } from './deal-score-badge';

interface FeaturedDealHeroProps {
  locale: string;
  deal: PresentedDeal;
}

/**
 * Compact hero panel for the best personalized deal on the page.
 *
 * @param props - Locale and already-presented top deal.
 * @returns Highlight section shown above the feed.
 */
export async function FeaturedDealHero({ locale, deal }: FeaturedDealHeroProps) {
  const t = await getTranslations({ locale, namespace: 'deals.featured' });
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const travelMonthLabel = monthFormatter.format(new Date(deal.departureDate));
  const prefillMessage = buildDealPrefillMessage({
    origin: deal.origin,
    destinationName: deal.destinationName || deal.destination,
    price: deal.price,
    averagePrice: deal.averagePrice,
    currency: deal.currency,
    travelMonthLabel,
  });
  const chatHref = `/${locale}/new?prefill=${encodeURIComponent(prefillMessage)}`;
  const reasonsLabel = deal.personalizationReasons.slice(0, 2).join(' · ');

  return (
    <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>{t('eyebrow')}</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t('title', { destination: deal.destinationName || deal.destination })}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <DealScoreBadge score={deal.personalizedScore ?? deal.dealScore} />
            <span className="font-medium">
              {deal.origin} → {deal.destinationName || deal.destination}
            </span>
            <span className="text-muted-foreground">{travelMonthLabel}</span>
          </div>
          {reasonsLabel ? (
            <p className="text-sm text-muted-foreground">{reasonsLabel}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="text-3xl font-bold">
            {deal.currency === 'PTS'
              ? `${Math.round(deal.price).toLocaleString(locale)} ${t('points')}`
              : `${Math.round(deal.price).toLocaleString(locale)} ${deal.currency}`}
          </div>
          <Button asChild>
            <a href={chatHref}>
              <Search className="mr-1.5 size-4" />
              {t('cta')}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
