'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { subscribeWeeklyDigestAction } from '../actions';

interface DealDigestLineProps {
  locale: string;
  originAirports: string[];
  emailDigest: 'none' | 'weekly' | 'daily';
}

/**
 * Offer a weekly digest for the active departure filter with one click.
 * @param props - Locale, selected airports, and current persisted digest frequency.
 * @returns Subscription prompt, inline confirmation, or nothing for existing subscribers.
 */
export function DealDigestLine({ locale, originAirports, emailDigest }: DealDigestLineProps) {
  const t = useTranslations('deals.digest');
  const [isPending, startTransition] = useTransition();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (isSubscribed) {
    return <p role="status" className="mb-4 text-sm text-primary">{t('subscribed')}</p>;
  }
  if (emailDigest === 'weekly' || emailDigest === 'daily') {
    return null;
  }

  const subscribe = () => {
    setHasError(false);
    startTransition(async () => {
      try {
        await subscribeWeeklyDigestAction({ locale, originAirports });
        setIsSubscribed(true);
      } catch {
        setHasError(true);
      }
    });
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-3 rounded-2xl border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {originAirports.length > 0
            ? t('withOrigins', { airports: originAirports.join(', ') })
            : t('generic')}
        </p>
        <Button onClick={subscribe} disabled={isPending} className="min-h-11 shrink-0">
          {isPending ? t('subscribing') : t('subscribe')}
        </Button>
      </div>
      {hasError && <p role="alert" className="text-sm text-destructive">{t('error')}</p>}
    </div>
  );
}
