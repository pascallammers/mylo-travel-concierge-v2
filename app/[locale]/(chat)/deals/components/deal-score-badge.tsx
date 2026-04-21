'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DealScoreBadgeProps {
  score: number;
  className?: string;
}

export function DealScoreBadge({ score, className }: DealScoreBadgeProps) {
  const t = useTranslations('deals.card');

  const category = score >= 90 ? 'exceptional' : score >= 70 ? 'veryGood' : 'good';

  const colorClasses = {
    exceptional: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    veryGood: 'bg-blue-100 text-blue-800 border-blue-200',
    good: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
        colorClasses[category],
        className,
      )}
    >
      <span className="tabular-nums">{score}%</span>
      <span>{t('dealScore')}</span>
    </div>
  );
}
