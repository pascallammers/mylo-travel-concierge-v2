'use client';

import { Suspense, use } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LoyaltyConnectButton } from '@/components/awardwallet/connect-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import type { ProgrammeValue } from '@/lib/valuation/portfolio-value';
import type { RailWertzahl as RailWertzahlData } from '@/lib/valuation/wertzahl-loader';

const PROGRAM_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

function ProgrammeBar({ programs }: { programs: ProgrammeValue[] }) {
  const total = programs.reduce((sum, program) => sum + program.travelEur, 0);
  if (programs.length <= 1 || total === 0) return null;

  return (
    <div className="flex h-1.5 overflow-hidden rounded-full">
      {programs.map((program, index) => (
        <span
          key={program.programId}
          className={PROGRAM_COLORS[index % PROGRAM_COLORS.length]}
          style={{ width: `${(program.travelEur / total) * 100}%` }}
          role="img"
          title={program.name}
          aria-label={program.name}
        />
      ))}
    </div>
  );
}

function WertzahlContent({ wertzahl }: { wertzahl: Promise<RailWertzahlData> }) {
  const value = use(wertzahl);
  const t = useTranslations('shell.wertzahl');
  const locale = useLocale();
  const euro = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const formatValue = (eur: number) => `${eur === 0 ? '' : '~'}${euro.format(eur)}`;

  if (value.kind === 'not_connected') {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-snug">{t('connectPrompt')}</p>
        <LoyaltyConnectButton size="sm" className="w-full text-xs" showIcon={false}>
          {t('connect')}
        </LoyaltyConnectButton>
      </div>
    );
  }

  if (value.kind === 'unavailable') {
    return <p className="text-muted-foreground">{t('unavailable')}</p>;
  }

  return (
    <div className="space-y-3">
      {value.kind === 'value' ? (
        <>
          <div className="space-y-1">
            <p className="text-muted-foreground">{t('travel')}</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatValue(value.travelEur)}</p>
            {value.noPlan !== null && (
              <p className="text-muted-foreground tabular-nums">
                {t('noPlan', { value: formatValue(value.noPlan.eur) })}
                {value.noPlan.coveredPrograms < value.noPlan.totalPrograms && (
                  <> · {t('coverage', { covered: value.noPlan.coveredPrograms, total: value.noPlan.totalPrograms })}</>
                )}
              </p>
            )}
          </div>
          <ProgrammeBar programs={value.programs} />
        </>
      ) : (
        <p className="text-sm font-medium">{t('noRateableAccount')}</p>
      )}
      {value.unreadableCount > 0 && (
        <p className="text-muted-foreground">
          {t('unreadable', { count: value.unreadableCount })} ·{' '}
          <a
            href="https://awardwallet.com/account/list"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {t('repair')}
          </a>
        </p>
      )}
      <p className="text-muted-foreground">
        {value.kind === 'value' && value.ratedAccounts !== value.totalAccounts && (
          <>{t('rated', { rated: value.ratedAccounts, total: value.totalAccounts })} · </>
        )}
        <Link href="/?tab=loyalty#settings" className="underline-offset-4 hover:underline">
          {t('breakdown')}
        </Link>
      </p>
    </div>
  );
}

/**
 * Stream the Wertzahl into the same rail frame for loaded, empty and pending states.
 * @param props - Promise started in the authenticated server layout.
 * @returns Rail-Kopf with a Suspense skeleton until its server data is available.
 */
export function RailWertzahl({ wertzahl }: { wertzahl: Promise<RailWertzahlData> }) {
  const t = useTranslations('shell.wertzahl');

  return (
    <div className="min-h-28 rounded-lg border p-3 text-xs">
      <Suspense
        fallback={
          <div className="space-y-3" role="status" aria-label={t('loading')}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        }
      >
        <WertzahlContent wertzahl={wertzahl} />
      </Suspense>
    </div>
  );
}
