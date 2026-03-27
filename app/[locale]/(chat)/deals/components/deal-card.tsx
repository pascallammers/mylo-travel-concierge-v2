'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Search, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DealScoreBadge } from './deal-score-badge';
import type { FlightDeal } from '@/lib/db/schema';

interface DealCardProps {
  deal: FlightDeal;
  showScore?: boolean;
  locale: string;
}

export function DealCard({ deal, showScore = false, locale }: DealCardProps) {
  const t = useTranslations('deals');

  const departureDate = new Date(deal.departureDate);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const travelMonth = monthFormatter.format(departureDate);

  const priceFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: deal.currency,
    maximumFractionDigits: 0,
  });

  const stopsLabel =
    deal.stops === 0
      ? t('card.stops_zero')
      : deal.stops === 1
        ? t('card.stops_one')
        : t('card.stops_other', { count: deal.stops });

  return (
    <div className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Route Info */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{deal.origin}</span>
            <Plane className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-lg">
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

        {/* Right: Price */}
        <div className="text-right shrink-0">
          {deal.averagePrice && deal.averagePrice > deal.price && (
            <div className="text-sm text-muted-foreground line-through">
              {priceFormatter.format(deal.averagePrice)}
            </div>
          )}
          <div className="text-2xl font-bold">{priceFormatter.format(deal.price)}</div>
          {deal.priceChangePercent && deal.priceChangePercent > 0 && (
            <div className="text-sm font-medium text-emerald-600">
              -{Math.round(deal.priceChangePercent)}% {t('card.savings')}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Score + Actions */}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          {showScore && <DealScoreBadge score={deal.dealScore} />}
          <span className="text-xs text-muted-foreground">{t('ad')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/${locale}/new?origin=${deal.origin}&destination=${deal.destination}`}>
              <Search className="mr-1.5 size-3.5" />
              {t('card.searchInMylo')}
            </a>
          </Button>
          {deal.affiliateLink && (
            <Button size="sm" asChild>
              <a href={deal.affiliateLink} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink className="mr-1.5 size-3.5" />
                {t('card.book')}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
