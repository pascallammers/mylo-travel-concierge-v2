'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AirportSearchResult } from '@/lib/utils/airport-database';

interface AirportComboboxProps {
  label: string; value: string | null; valueLabel: string | null;
  error?: string; onChange: (iata: string, label: string) => void;
}

/**
 * Select a single IATA airport using the existing local airport search endpoint.
 * @param props - Selected airport, accessible label and selection callback.
 * @returns Keyboard-accessible airport combobox with stale-request cancellation.
 */
export function AirportCombobox({ label, value, valueLabel, error, onChange }: AirportComboboxProps) {
  const t = useTranslations('flights.airport');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AirportSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    if (!open || query.trim().length < 2) { setStatus('idle'); return () => controller.abort(); }
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/airports/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Airport search unavailable');
        const payload = await response.json() as { airports: AirportSearchResult[] };
        if (!controller.signal.aborted) { setResults(payload.airports); setStatus('idle'); }
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open}
            aria-controls={`${id}-options`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            className="h-auto min-h-12 w-full justify-between gap-2 text-left">
            <span className="min-w-0 truncate">{value ? `${value} · ${valueLabel ?? value}` : t('placeholder')}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 max-w-[calc(100vw-2rem)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder={t('search')} aria-label={t('search')} />
            <CommandList id={`${id}-options`}>
              <CommandEmpty><span role="status">{status === 'loading' ? t('loading') : status === 'error' ? t('error') : query.trim().length < 2 ? t('hint') : t('empty')}</span></CommandEmpty>
              <CommandGroup>
                {results.map((airport) => (
                  <CommandItem key={airport.iataCode} value={airport.iataCode} className="min-h-11"
                    onSelect={() => { onChange(airport.iataCode, airport.name); setOpen(false); setQuery(''); }}>
                    <Check className={`size-4 shrink-0 ${value === airport.iataCode ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                    <span className="min-w-0"><strong>{airport.iataCode}</strong> · {airport.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
