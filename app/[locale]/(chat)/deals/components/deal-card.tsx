'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { track } from '@vercel/analytics';
import { ChevronDown, ChevronUp, ExternalLink, Search, Plane, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { buildDealPrefillMessage } from '@/lib/chat/new-chat-handoff';
import { DealScoreBadge } from './deal-score-badge';
import type { PresentedDeal } from '@/lib/deals';

interface DealCardProps {
  deal: PresentedDeal;
  showScore?: boolean;
  locale: string;
}

export function DealCard({ deal, showScore = false, locale }: DealCardProps) {
  const t = useTranslations('deals');
  const [isExpanded, setIsExpanded] = useState(false);
  const hasTrackedViewRef = useRef(false);
  const departureDate = new Date(deal.departureDate);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const travelMonth = monthFormatter.format(departureDate);
  const isPointsDeal = deal.source.toLowerCase().includes('seats');
  const priceFormatter =
    !isPointsDeal && deal.currency === 'EUR'
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: deal.currency,
          maximumFractionDigits: 0,
        })
      : null;
  const priceLabel =
    isPointsDeal
      ? `${Math.round(deal.price).toLocaleString(locale)} ${t('card.pointsUnit')}`
      : priceFormatter
      ? priceFormatter.format(deal.price)
      : `${Math.round(deal.price).toLocaleString(locale)} ${deal.currency}`;
  const averagePriceLabel =
    !isPointsDeal && deal.averagePrice !== null
      ? priceFormatter
        ? priceFormatter.format(deal.averagePrice)
        : `${Math.round(deal.averagePrice).toLocaleString(locale)} ${deal.currency}`
      : null;
  const prefillMessage = buildDealPrefillMessage({
    origin: deal.origin,
    destinationName: deal.destinationName || deal.destination,
    price: deal.price,
    averagePrice: deal.averagePrice,
    currency: deal.currency,
    travelMonthLabel: travelMonth,
  });
  const chatHref = `/${locale}/new?prefill=${encodeURIComponent(prefillMessage)}`;
  const stops = deal.stops ?? 0;
  const stopsLabel =
    stops === 0
      ? t('card.stops_zero')
      : stops === 1
        ? t('card.stops_one')
        : t('card.stops_other', { count: stops });
  const historyToneClass =
    deal.priceHistoryBar.tone === 'good'
      ? 'bg-emerald-500'
      : deal.priceHistoryBar.tone === 'high'
        ? 'bg-rose-500'
        : 'bg-amber-500';

  useEffect(() => {
    if (hasTrackedViewRef.current) {
      return;
    }

    hasTrackedViewRef.current = true;
    track('deal_view', {
      destination: deal.destination,
      source: deal.source,
      bucket: deal.bucket,
    });
  }, [deal.bucket, deal.destination, deal.source]);

  return (
    <div className="group rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {showScore && <DealScoreBadge score={deal.dealScore} className="w-fit" />}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{deal.origin}</span>
              <Plane className="size-3.5 text-muted-foreground" />
              <span className="text-lg font-semibold">
                {deal.destinationName || deal.destination}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{travelMonth}</span>
              <span>·</span>
              <span>{stopsLabel}</span>
              {deal.airline && (
                <>
                  <span>·</span>
                  <span>{deal.airline}</span>
                </>
              )}
              <span>·</span>
              <span>{deal.tripType === 'roundtrip' ? t('card.roundtrip') : t('card.oneway')}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-left sm:min-w-44 sm:text-right">
            {averagePriceLabel && deal.averagePrice !== null && deal.averagePrice > deal.price && (
              <div className="text-sm text-muted-foreground line-through">
                {averagePriceLabel}
              </div>
            )}
            <div className="text-2xl font-bold">{priceLabel}</div>
            {deal.priceChangePercent && deal.priceChangePercent > 0 && (
              <div className="text-sm font-medium text-emerald-600">
                -{Math.round(deal.priceChangePercent)}% {t('card.savings')}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-background/60 p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('card.why')}
            </p>
            <p className="text-sm font-medium">{deal.insight.why}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('card.forWhom')}
            </p>
            <p className="text-sm font-medium">{deal.insight.forWhom}</p>
          </div>
        </div>

        {deal.personalizationReasons.length > 0 ? (
          <div className="rounded-2xl bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t('card.personalized')}</span>{' '}
            {deal.personalizationReasons.join(' · ')}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Collapsible
            open={isExpanded}
            onOpenChange={(open) => {
              setIsExpanded(open);
              if (open) {
                track('deal_expand', {
                  destination: deal.destination,
                  source: deal.source,
                  bucket: deal.bucket,
                });
              }
            }}
            className="space-y-3"
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-fit px-0">
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1.5 size-4" />
                    {t('card.lessDetails')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1.5 size-4" />
                    {t('card.moreDetails')}
                  </>
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-3">
              {deal.priceHistoryBar.visible && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>{t('card.priceHistory')}</span>
                    <span>{deal.priceHistoryBar.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', historyToneClass)}
                      style={{ width: `${deal.priceHistoryBar.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium">
                <Sparkles className="size-4 text-amber-500" />
                <span>
                  {deal.insight.recommendation.kind === 'book'
                    ? t('card.recommendationBook', { percent: deal.insight.recommendation.confidence })
                    : t('card.recommendationWatch', { percent: deal.insight.recommendation.confidence })}
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col gap-2 sm:min-w-52">
            <Button size="sm" asChild>
              <a
                href={chatHref}
                onClick={() =>
                  track('chat_start_from_deal', {
                    destination: deal.destination,
                    source: deal.source,
                  })
                }
              >
                <Search className="mr-1.5 size-3.5" />
                {t('card.checkWithMylo')}
              </a>
            </Button>
            {deal.affiliateLink && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={deal.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={() =>
                    track('affiliate_click', {
                      destination: deal.destination,
                      source: deal.source,
                    })
                  }
                >
                  <ExternalLink className="mr-1.5 size-3.5" />
                  {t('card.book')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
