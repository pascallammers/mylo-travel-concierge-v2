'use client';

import { useTranslations } from 'next-intl';
import type { AwardDealView } from '@/lib/deals/award-deal-view';

/**
 * Display mileage cost, EUR surcharges and a sufficiently sampled cash comparison.
 * @param props - Prepared award details and the active number-formatting locale.
 * @returns A wrapping price block suitable for narrow cards.
 */
export function AwardDealPrice({ award, locale }: { award: AwardDealView; locale: string }) {
  const t = useTranslations('deals.card');
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-muted/50 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold tabular-nums">
        <span className="text-2xl">{t('awardMiles', { miles: number.format(award.miles) })}</span>
        {award.taxesEur !== null && (
          <span className="text-base">{t('awardSurcharges', { taxes: euros.format(award.taxesEur) })}</span>
        )}
      </div>
      {award.cashReferenceEur !== null && (
        <span className="text-sm text-muted-foreground">
          {t('awardCashReference', { price: euros.format(award.cashReferenceEur) })}
        </span>
      )}
    </div>
  );
}
