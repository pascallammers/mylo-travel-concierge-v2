'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DealKind, DealsPageFilters } from '@/lib/deals';

const DACH_AIRPORTS = [
  { code: 'FRA', label: 'Frankfurt (FRA)' },
  { code: 'MUC', label: 'München (MUC)' },
  { code: 'BER', label: 'Berlin (BER)' },
  { code: 'DUS', label: 'Düsseldorf (DUS)' },
  { code: 'HAM', label: 'Hamburg (HAM)' },
  { code: 'VIE', label: 'Wien (VIE)' },
  { code: 'ZRH', label: 'Zürich (ZRH)' },
  { code: 'CGN', label: 'Köln (CGN)' },
  { code: 'STR', label: 'Stuttgart (STR)' },
];

const KINDS: DealKind[] = ['award', 'cash'];

interface DealFiltersProps {
  filters: DealsPageFilters;
  kindCounts: Record<DealKind, number>;
  preferredOrigins: string[];
}

/**
 * Render kind tabs and compact filters from the server's validated selection.
 * @param props - Active filters, counts before kind filtering, and preferred airports.
 * @returns Mobile-friendly controls that persist the selection in the URL.
 */
export function DealFilters({ filters, kindCounts, preferredOrigins }: DealFiltersProps) {
  const t = useTranslations('deals.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const airports = [
    ...DACH_AIRPORTS,
    ...[...new Set([...preferredOrigins, ...filters.origins])]
      .filter((code) => !DACH_AIRPORTS.some((airport) => airport.code === code))
      .map((code) => ({ code, label: code })),
  ];

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const removed of ['bucket', 'stops', 'tripType']) {
      params.delete(removed);
    }
    if (value === 'all' && key !== 'origin') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const toggleOrigin = (code: string) => {
    const origins = filters.origins.includes(code)
      ? filters.origins.filter((origin) => origin !== code)
      : [...filters.origins, code];
    updateFilter('origin', origins.length > 0 ? origins.join(',') : 'all');
  };

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <Tabs value={filters.kind} onValueChange={(value) => updateFilter('kind', value)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-transparent p-0 sm:w-fit">
          {KINDS.map((kind) => (
            <TabsTrigger
              key={kind}
              value={kind}
              disabled={isPending}
              className="min-h-11 rounded-full border px-3 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4"
            >
              {t(`kinds.${kind}`)} ({kindCounts[kind]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <fieldset disabled={isPending} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('origin')}</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.origins.length === 0 ? 'default' : 'outline'}
            className="min-h-11 rounded-full"
            aria-pressed={filters.origins.length === 0}
            onClick={() => updateFilter('origin', 'all')}
          >
            {t('anywhere')}
          </Button>
          {airports.map((airport) => (
            <Button
              key={airport.code}
              variant={filters.origins.includes(airport.code) ? 'default' : 'outline'}
              className="min-h-11 rounded-full px-3"
              aria-pressed={filters.origins.includes(airport.code)}
              aria-label={airport.label}
              title={airport.label}
              onClick={() => toggleOrigin(airport.code)}
            >
              {airport.code}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
        <Select value={filters.range ?? 'all'} onValueChange={(value) => updateFilter('range', value)} disabled={isPending}>
          <SelectTrigger className="min-h-11 w-full sm:w-44" aria-label={t('range')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allRanges')}</SelectItem>
            <SelectItem value="europe">{t('ranges.europe')}</SelectItem>
            <SelectItem value="long_haul">{t('ranges.long_haul')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(value) => updateFilter('sort', value)} disabled={isPending}>
          <SelectTrigger className="min-h-11 w-full sm:w-44" aria-label={t('sort')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">{t('sortScore')}</SelectItem>
            <SelectItem value="price">{t('sortPrice')}</SelectItem>
            <SelectItem value="date">{t('sortDate')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          className="min-h-11"
          disabled={isPending}
          onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
        >
          {t('reset')}
        </Button>
      </div>
    </div>
  );
}
