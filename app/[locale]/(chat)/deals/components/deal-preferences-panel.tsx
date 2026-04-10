'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveDealPreferencesAction } from '../actions';
import { AirportMultiSelect } from './airport-multi-select';

interface SelectedAirport {
  iataCode: string;
  name: string;
  countryCode: string;
}

interface DealPreferencesPanelProps {
  locale: string;
  initialOriginAirports: SelectedAirport[];
  initialPreferredDestinations: SelectedAirport[];
  initialCabinClass: 'economy' | 'premium_economy' | 'business' | 'first' | null;
  initialMaxPrice: number | null;
  initialEmailDigest: 'none' | 'weekly' | 'daily';
}

/**
 * Lightweight preferences form for saving personalization and digest settings.
 *
 * @param props - Current persisted preference values for the signed-in user.
 * @returns Client-side form with a single save action.
 */
export function DealPreferencesPanel({
  locale,
  initialOriginAirports,
  initialPreferredDestinations,
  initialCabinClass,
  initialMaxPrice,
  initialEmailDigest,
}: DealPreferencesPanelProps) {
  const t = useTranslations('deals.preferences');
  const [isPending, startTransition] = useTransition();
  const [originAirports, setOriginAirports] = useState(initialOriginAirports.map((airport) => airport.iataCode).join(', '));
  const [preferredDestinations, setPreferredDestinations] = useState(
    initialPreferredDestinations.map((airport) => airport.iataCode).join(', '),
  );
  const [cabinClass, setCabinClass] = useState<'any' | 'economy' | 'premium_economy' | 'business' | 'first'>(
    initialCabinClass ?? 'any',
  );
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice?.toString() ?? '');
  const [emailDigest, setEmailDigest] = useState<'none' | 'weekly' | 'daily'>(initialEmailDigest);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveDealPreferencesAction({
          locale,
          originAirports,
          preferredDestinations,
          cabinClass,
          maxPrice,
          emailDigest,
        });
        toast.success(t('saved'));
      } catch (error) {
        console.error(error);
        toast.error(t('saveError'));
      }
    });
  };

  return (
    <section className="rounded-2xl border bg-card/60 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <Bell className="size-3.5" />
          <span>{t(`digestStatus.${emailDigest}`)}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AirportMultiSelect
            label={t('originAirports')}
            placeholder={t('originAirportsPlaceholder')}
            searchPlaceholder={t('airportSearchPlaceholder')}
            emptyText={t('airportSearchEmpty')}
            loadingText={t('airportSearchLoading')}
            removeLabel={t('removeSelection')}
            initialSelectedAirports={initialOriginAirports}
            onChange={setOriginAirports}
          />
        </div>

        <div className="lg:col-span-5">
          <AirportMultiSelect
            label={t('preferredDestinations')}
            placeholder={t('preferredDestinationsPlaceholder')}
            searchPlaceholder={t('airportSearchPlaceholder')}
            emptyText={t('airportSearchEmpty')}
            loadingText={t('airportSearchLoading')}
            removeLabel={t('removeSelection')}
            initialSelectedAirports={initialPreferredDestinations}
            onChange={setPreferredDestinations}
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label>{t('cabinClass')}</Label>
          <Select value={cabinClass} onValueChange={(value) => setCabinClass(value as typeof cabinClass)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('cabinClassOptions.any')}</SelectItem>
              <SelectItem value="economy">{t('cabinClassOptions.economy')}</SelectItem>
              <SelectItem value="premium_economy">{t('cabinClassOptions.premium_economy')}</SelectItem>
              <SelectItem value="business">{t('cabinClassOptions.business')}</SelectItem>
              <SelectItem value="first">{t('cabinClassOptions.first')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:max-w-xs lg:col-span-3 lg:max-w-none">
          <Label htmlFor="deal-max-price">{t('maxPrice')}</Label>
          <Input
            id="deal-max-price"
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder={t('maxPricePlaceholder')}
          />
        </div>

        <div className="space-y-2 lg:col-span-5">
          <Label>{t('emailDigest')}</Label>
          <Select value={emailDigest} onValueChange={(value) => setEmailDigest(value as typeof emailDigest)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('emailDigestOptions.none')}</SelectItem>
              <SelectItem value="daily">{t('emailDigestOptions.daily')}</SelectItem>
              <SelectItem value="weekly">{t('emailDigestOptions.weekly')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('emailDigestHelp')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('helper')}</p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </section>
  );
}
