'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PresentedDeal } from '@/lib/deals/deals-page-model';
import { DealCard } from './deal-card';

/**
 * Keep awards without a transfer route or own balance behind an accessible toggle.
 * @param props - Sorted unreachable deals, initial state, freshness-label preference and locale.
 * @returns A group of normal award cards, collapsed unless it is the only content.
 */
export function UnreachableDealsToggle({ deals, defaultOpen, showFreshLabel, showAvailabilityCheck = false, locale }: {
  deals: PresentedDeal[];
  defaultOpen: boolean;
  showFreshLabel: boolean;
  showAvailabilityCheck?: boolean;
  locale: string;
}) {
  const t = useTranslations('deals.card');
  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-6 space-y-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto min-h-11 w-full justify-between gap-3 whitespace-normal py-3 text-left text-muted-foreground [&[data-state=open]>svg]:rotate-180">
          {t('unreachableToggle', { count: deals.length })}
          <ChevronDown className="size-4 shrink-0 transition-transform" aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} showAvailabilityCheck={showAvailabilityCheck} showFreshLabel={showFreshLabel} locale={locale} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
