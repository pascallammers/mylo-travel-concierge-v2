'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS_AHEAD = 12;

function upcomingMonths(today: string, locale: string): { value: string; label: string }[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: MONTHS_AHEAD }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return {
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
}

interface SearchWindowFieldProps {
  id: string; label: string; date: string | null; month: string | null; today: string; error?: string;
  onChange: (date: string | null, month: string | null) => void;
}

/**
 * Edit one leg as a calendar date (native picker) or one of the next twelve months.
 * @param props - Controlled date values and the current day for the minimum.
 * @returns A labelled, required date/month input with inline issues.
 */
export function SearchWindowField({ id, label, date, month, today, error, onChange }: SearchWindowFieldProps) {
  const t = useTranslations('flights.mask');
  const locale = useLocale();
  const [mode, setMode] = useState<'day' | 'month'>(month ? 'month' : 'day');
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex gap-1" aria-label={label}>
        {(['day', 'month'] as const).map((option) => (
          <Button type="button" key={option} variant={mode === option ? 'secondary' : 'ghost'} className="min-h-11 flex-1"
            aria-pressed={mode === option} onClick={() => {
              setMode(option);
              onChange(option === 'day' ? (month ? (month === today.slice(0, 7) ? today : `${month}-01`) : date) : null, option === 'month' ? (date?.slice(0, 7) ?? month) : null);
            }}>{t(option)}</Button>
        ))}
      </div>
      <Label htmlFor={id} className="sr-only">{label} · {t(mode)}</Label>
      {mode === 'month' ? (
        <Select value={month ?? undefined} onValueChange={(value) => onChange(null, value)}>
          <SelectTrigger id={id} className="min-h-12 w-full min-w-0" aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}><SelectValue placeholder={t('pickMonth')} /></SelectTrigger>
          <SelectContent>{upcomingMonths(today, locale).map((option) => (
            <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>
          ))}</SelectContent>
        </Select>
      ) : (
        <Input id={id} type="date" className="min-h-12 min-w-0" required value={date ?? ''} min={today}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value || null, null)} />
      )}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
