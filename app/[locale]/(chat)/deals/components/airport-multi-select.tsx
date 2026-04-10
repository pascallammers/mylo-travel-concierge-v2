'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, LoaderCircle, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AirportOption {
  iataCode: string;
  name: string;
  countryCode: string;
}

interface AirportMultiSelectProps {
  emptyText: string;
  initialSelectedAirports: AirportOption[];
  label: string;
  loadingText: string;
  onChange: (value: string) => void;
  placeholder: string;
  removeLabel: string;
  searchPlaceholder: string;
}

/**
 * Multi-select airport search for city names, airport names, and IATA codes.
 *
 * @param props - UI copy plus initial airport selections for the current user.
 * @returns Searchable multi-select field backed by the airport search API.
 */
export function AirportMultiSelect({
  emptyText,
  initialSelectedAirports,
  label,
  loadingText,
  onChange,
  placeholder,
  removeLabel,
  searchPlaceholder,
}: AirportMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 200);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AirportOption[]>([]);
  const [selectedAirports, setSelectedAirports] = useState<AirportOption[]>(initialSelectedAirports);

  useEffect(() => {
    setSelectedAirports(initialSelectedAirports);
  }, [initialSelectedAirports]);

  useEffect(() => {
    onChange(selectedAirports.map((airport) => airport.iataCode).join(', '));
  }, [onChange, selectedAirports]);

  useEffect(() => {
    let cancelled = false;

    const loadAirports = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(`/api/airports/search?q=${encodeURIComponent(debouncedQuery)}`);
        const payload = (await response.json()) as { airports?: AirportOption[] };

        if (!cancelled) {
          setResults(payload.airports ?? []);
        }
      } catch (error) {
        console.error('[AirportMultiSelect] Search failed:', error);
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAirports();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const selectedCodes = useMemo(
    () => new Set(selectedAirports.map((airport) => airport.iataCode)),
    [selectedAirports],
  );

  const triggerText = selectedAirports.length > 0
    ? selectedAirports.map((airport) => airport.iataCode).join(', ')
    : placeholder;

  const toggleAirport = (airport: AirportOption) => {
    setSelectedAirports((currentAirports) => {
      if (currentAirports.some((currentAirport) => currentAirport.iataCode === airport.iataCode)) {
        return currentAirports.filter((currentAirport) => currentAirport.iataCode !== airport.iataCode);
      }

      return [...currentAirports, airport];
    });
  };

  const removeAirport = (iataCode: string) => {
    setSelectedAirports((currentAirports) =>
      currentAirports.filter((airport) => airport.iataCode !== iataCode),
    );
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
          >
            <span className={cn('truncate', selectedAirports.length === 0 && 'text-muted-foreground')}>
              {triggerText}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>{loadingText}</span>
                </div>
              ) : null}

              {!isLoading ? (
                <>
                  <CommandEmpty>{emptyText}</CommandEmpty>
                  <CommandGroup>
                    {results.map((airport) => {
                      const isSelected = selectedCodes.has(airport.iataCode);

                      return (
                        <CommandItem
                          key={airport.iataCode}
                          value={`${airport.iataCode} ${airport.name} ${airport.countryCode}`}
                          onSelect={() => toggleAirport(airport)}
                        >
                          <Check className={cn('size-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {airport.name} ({airport.iataCode})
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {airport.countryCode || airport.iataCode}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedAirports.length > 0 ? (
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border/60 bg-background/40 p-2">
          <div className="flex flex-wrap gap-2">
          {selectedAirports.map((airport) => (
            <div
              key={airport.iataCode}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs"
            >
              <span className="font-medium">{airport.iataCode}</span>
              <span className="text-muted-foreground">{airport.name}</span>
              <button
                type="button"
                onClick={() => removeAirport(airport.iataCode)}
                className="ml-1 rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                aria-label={`${airport.iataCode} ${removeLabel}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
