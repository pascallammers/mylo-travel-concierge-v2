'use client';

import { Suspense, use } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LoyaltyConnectButton } from '@/components/awardwallet/connect-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname } from '@/i18n/navigation';
import { findActiveArea } from '@/lib/shell';
import type { RailWertzahl } from '@/lib/valuation/wertzahl-loader';
import { formatValue } from './format-value';
import { useShellSettings } from './shell-settings';

function CompactWertzahl({ wertzahl }: { wertzahl: Promise<RailWertzahl> }) {
  const value = use(wertzahl);
  const t = useTranslations('shell.wertzahl');
  const locale = useLocale();
  const settings = useShellSettings();

  if (value.kind === 'unavailable') return null;

  if (value.kind === 'not_connected') {
    return (
      <LoyaltyConnectButton size="sm" className="h-11 min-w-28 text-xs" showIcon={false}>
        {t('connectShort')}
      </LoyaltyConnectButton>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={value.kind === 'value' ? 'h-11 min-w-28 tabular-nums' : 'h-11 min-w-28 text-xs text-muted-foreground'}
      onClick={() => settings.open('loyalty')}
      aria-label={value.kind === 'value' ? `${t('travel')}: ${formatValue(value.travelEur, locale)}, ${t('breakdown')}` : undefined}
    >
      {value.kind === 'value' ? formatValue(value.travelEur, locale) : t('breakdownShort')}
    </Button>
  );
}

/**
 * Keep the active area and compact loyalty value visible on mobile area pages.
 * @param props - The same server-loaded Wertzahl promise used by the desktop rail.
 * @returns A sticky area header with honest empty states and a compact loading skeleton.
 */
export function MobileAreaHead({ wertzahl }: { wertzahl: Promise<RailWertzahl> }) {
  const t = useTranslations();
  const area = findActiveArea(usePathname());

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:hidden">
      <span className="min-w-0 truncate font-semibold">{area ? t(area.titleKey) : 'FlyMylo'}</span>
      <div className="shrink-0">
        <Suspense fallback={<Skeleton className="h-8 w-28" role="status" aria-label={t('shell.wertzahl.loading')} />}>
          <CompactWertzahl wertzahl={wertzahl} />
        </Suspense>
      </div>
    </header>
  );
}
