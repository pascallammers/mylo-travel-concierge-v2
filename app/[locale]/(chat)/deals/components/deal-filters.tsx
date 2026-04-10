'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DealBucket } from '@/lib/deals';

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

const BUCKETS: DealBucket[] = ['weekend_escape', 'long_haul', 'points'];

interface DealFiltersProps {
  bucketCounts: Record<DealBucket, number>;
}

export function DealFilters({ bucketCounts }: DealFiltersProps) {
  const t = useTranslations('deals.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentOrigin = searchParams.get('origin') || 'all';
  const currentStops = searchParams.get('stops') || 'all';
  const currentTripType = searchParams.get('tripType') || 'all';
  const currentSort = searchParams.get('sort') || 'score';
  const currentBucket = searchParams.get('bucket') || 'all';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      const nextSearch = params.toString();
      router.push(nextSearch ? `${pathname}?${nextSearch}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  return (
    <div className="space-y-4">
      <Tabs value={currentBucket} onValueChange={(value) => updateFilter('bucket', value)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="rounded-full border px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t('allDeals')}
          </TabsTrigger>
          {BUCKETS.map((bucket) => (
            <TabsTrigger
              key={bucket}
              value={bucket}
              className="rounded-full border px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t(`buckets.${bucket}`)} ({bucketCounts[bucket]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={currentOrigin} onValueChange={(value) => updateFilter('origin', value)}>
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

        <Select value={currentTripType} onValueChange={(value) => updateFilter('tripType', value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('tripType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTripTypes')}</SelectItem>
            <SelectItem value="roundtrip">{t('roundtrip')}</SelectItem>
            <SelectItem value="oneway">{t('oneway')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentStops} onValueChange={(value) => updateFilter('stops', value)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('stops')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('anyStops')}</SelectItem>
            <SelectItem value="0">{t('nonstop')}</SelectItem>
            <SelectItem value="1">{t('maxOne')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentSort} onValueChange={(value) => updateFilter('sort', value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('sort')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">{t('sortScore')}</SelectItem>
            <SelectItem value="price">{t('sortPrice')}</SelectItem>
            <SelectItem value="savings">{t('sortSavings')}</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={resetFilters}>
          {t('reset')}
        </Button>
      </div>
    </div>
  );
}
