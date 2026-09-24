'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SearchWindowFieldProps {
  id: string; label: string; date: string | null; month: string | null; today: string; error?: string;
  onChange: (date: string | null, month: string | null) => void;
}

/**
 * Edit one leg as a calendar date or whole month using native mobile pickers.
 * @param props - Controlled date values and the current day for the minimum.
 * @returns A labelled, required date/month input with inline issues.
 */
export function SearchWindowField({ id, label, date, month, today, error, onChange }: SearchWindowFieldProps) {
  const t = useTranslations('flights.mask');
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
      <Input id={id} type={mode === 'month' ? 'month' : 'date'} className="min-h-12 min-w-0" required
        value={(mode === 'month' ? month : date) ?? ''} min={mode === 'month' ? today.slice(0, 7) : today}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(mode === 'day' ? event.target.value || null : null, mode === 'month' ? event.target.value || null : null)} />
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
