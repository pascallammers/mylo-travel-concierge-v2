'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { AwardSeal as AwardSealView } from '@/lib/deals/award-deal-view';

interface AwardSealProps {
  seal: AwardSealView;
  locale: string;
}

const verdictTone = {
  below_travel: 'bg-muted text-muted-foreground',
  above_travel: 'bg-primary/10 text-primary',
  far_above_travel: 'bg-primary text-primary-foreground',
};

/**
 * Show the achieved EUR cents beside the typical value and its travel verdict.
 * @param props - Unrounded seal values and the display locale.
 * @returns A quality seal with a distinct tone for each verdict.
 */
export function AwardSeal({ seal, locale }: AwardSealProps) {
  const t = useTranslations('deals.card');
  const cents = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className={cn('space-y-1 rounded-xl px-3 py-2 text-sm', verdictTone[seal.verdict])}>
      <p className="font-semibold tabular-nums">
        {t('awardSealValues', { achieved: cents.format(seal.achievedCents), typical: cents.format(seal.typicalCents) })}
      </p>
      <p>{t(`awardVerdict.${seal.verdict}`)}</p>
    </div>
  );
}

/**
 * Explain the typical travel rate and its effective month when available.
 * @param props - The same seal displayed on the card and its locale.
 * @returns A footnote without an invented effective date for legacy rows.
 */
export function AwardSealFootnote({ seal, locale }: AwardSealProps) {
  const t = useTranslations('deals.card');
  const typical = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(seal.typicalCents);
  const date = seal.rateValidFrom === null ? null : new Intl.DateTimeFormat(locale, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(seal.rateValidFrom));

  return (
    <p className="text-xs text-muted-foreground">
      {date === null ? t('awardRateFootnoteUndated', { typical }) : t('awardRateFootnote', { typical, date })}
    </p>
  );
}
