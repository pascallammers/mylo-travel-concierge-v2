'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DACH_AIRPORTS = [
  { code: 'FRA', label: 'Frankfurt (FRA)' },
  { code: 'MUC', label: 'Muenchen (MUC)' },
  { code: 'BER', label: 'Berlin (BER)' },
  { code: 'DUS', label: 'Duesseldorf (DUS)' },
  { code: 'HAM', label: 'Hamburg (HAM)' },
  { code: 'VIE', label: 'Wien (VIE)' },
  { code: 'ZRH', label: 'Zuerich (ZRH)' },
  { code: 'CGN', label: 'Koeln (CGN)' },
  { code: 'STR', label: 'Stuttgart (STR)' },
];

export function DealFilters() {
  const t = useTranslations('deals.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOrigin = searchParams.get('origin') || '';
  const currentStops = searchParams.get('stops') || '';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={currentOrigin || 'all'} onValueChange={(v) => updateFilter('origin', v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('origin')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anywhere')}</SelectItem>
          {DACH_AIRPORTS.map((airport) => (
            <SelectItem key={airport.code} value={airport.code}>
              {airport.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentStops || 'all'} onValueChange={(v) => updateFilter('stops', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('stops')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anyStops')}</SelectItem>
          <SelectItem value="0">{t('nonstop')}</SelectItem>
          <SelectItem value="1">{t('maxOne')}</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={resetFilters}>
        {t('reset')}
      </Button>
    </div>
  );
}
