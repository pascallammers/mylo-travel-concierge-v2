'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft, LoaderCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { buildFlightsHref, flightsQueryString, parseFlightsQuery, type FlightsDraft, type FlightsIssue } from '@/lib/flights/flights-query';
import { trackGoal } from '@/lib/analytics/track-goal';
import { AirportCombobox } from './airport-combobox';
import { SearchWindowField } from './search-window-field';

interface FlightSearchMaskProps {
  locale: string; today: string; draft: FlightsDraft; issues: readonly FlightsIssue[];
  airportLabels: Readonly<Record<string, string>>; programLabels: Readonly<Record<string, string>>;
}

/**
 * Edit a local draft and navigate to its canonical URL to execute an award search.
 * @param props - Parsed URL state, field issues and display labels.
 * @returns Mobile-first search form; URL changes reset it through the page key.
 */
export function FlightSearchMask({ locale, today, draft: initial, issues: initialIssues, airportLabels, programLabels }: FlightSearchMaskProps) {
  const t = useTranslations('flights');
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [labels, setLabels] = useState(airportLabels);
  const [issues, setIssues] = useState<readonly FlightsIssue[]>(initialIssues);
  const [required, setRequired] = useState(false);
  const [roundtrip, setRoundtrip] = useState(Boolean(initial.returnDate || initial.returnMonth));
  const [pending, startTransition] = useTransition();
  const change = (patch: Partial<FlightsDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setIssues((current) => current.filter((issue) => !(issue.field in patch)));
  };
  const error = (...fields: Array<keyof FlightsDraft>) => {
    const issue = issues.find((item) => fields.includes(item.field));
    return issue ? t(`issues.${issue.code}`) : undefined;
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = parseFlightsQuery(Object.fromEntries(new URLSearchParams(flightsQueryString(draft))), today);
    if (query.status !== 'ready') {
      setIssues(query.issues); setRequired(true); return;
    }
    setRequired(false);
    trackGoal('flight_search', { origin: query.search.origin, destination: query.search.destination,
      cabin: query.search.cabin, trip: query.search.inbound ? 'roundtrip' : 'oneway', flexible: draft.flexible ? 'yes' : 'no' });
    startTransition(() => router.push(buildFlightsHref(locale, query.draft)));
  };
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
          <div className="flex items-center gap-3">
            <Switch id="flight-roundtrip" checked={roundtrip} onCheckedChange={(checked) => {
              setRoundtrip(checked); if (!checked) change({ returnDate: null, returnMonth: null });
            }} />
            <Label htmlFor="flight-roundtrip" className="min-h-11 content-center">{t('mask.roundtrip')}</Label>
          </div>
          <div className="grid min-w-0 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <AirportCombobox label={t('mask.origin')} value={draft.origin} valueLabel={draft.origin ? labels[draft.origin] : null}
              error={error('origin') ?? (required && !draft.origin ? t('issues.required') : undefined)}
              onChange={(iata, label) => { change({ origin: iata }); setLabels((old) => ({ ...old, [iata]: label })); }} />
            <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11 justify-self-center sm:mt-6"
              aria-label={t('mask.swap')} onClick={() => change({ origin: draft.destination, destination: draft.origin })}>
              <ArrowRightLeft className="size-4" aria-hidden="true" />
            </Button>
            <AirportCombobox label={t('mask.destination')} value={draft.destination} valueLabel={draft.destination ? labels[draft.destination] : null}
              error={error('destination') ?? (required && !draft.destination ? t('issues.required') : undefined)}
              onChange={(iata, label) => { change({ destination: iata }); setLabels((old) => ({ ...old, [iata]: label })); }} />
          </div>
          <div className={`grid min-w-0 gap-4 ${roundtrip ? 'sm:grid-cols-2' : ''}`}>
            <SearchWindowField id="flight-outbound" label={t('mask.outbound')} date={draft.departDate} month={draft.month} today={today}
              error={error('departDate', 'month')} onChange={(departDate, month) => change({ departDate, month })} />
            {roundtrip && <SearchWindowField id="flight-inbound" label={t('mask.inbound')} date={draft.returnDate} month={draft.returnMonth} today={today}
              error={error('returnDate', 'returnMonth')} onChange={(returnDate, returnMonth) => change({ returnDate, returnMonth })} />}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flight-cabin">{t('mask.cabin')}</Label>
              <Select value={draft.cabin} onValueChange={(cabin: FlightsDraft['cabin']) => change({ cabin })}>
                <SelectTrigger id="flight-cabin" className="min-h-12 w-full" aria-invalid={Boolean(error('cabin'))} aria-describedby={error('cabin') ? 'flight-cabin-error' : undefined}><SelectValue /></SelectTrigger>
                <SelectContent>{(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const).map((cabin) => (
                  <SelectItem key={cabin} value={cabin} className="min-h-11">{t(`cabins.${cabin}`)}</SelectItem>
                ))}</SelectContent>
              </Select>
              {error('cabin') && <p id="flight-cabin-error" className="text-sm text-destructive">{error('cabin')}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="flight-passengers">{t('mask.passengers')}</Label>
              <Select value={String(draft.passengers)} onValueChange={(passengers) => change({ passengers: Number(passengers) })}>
                <SelectTrigger id="flight-passengers" className="min-h-12 w-full" aria-invalid={Boolean(error('passengers'))} aria-describedby={error('passengers') ? 'flight-passengers-error' : undefined}><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 9 }, (_, index) => index + 1).map((count) => (
                  <SelectItem key={count} value={String(count)} className="min-h-11">{t('mask.travellers', { count })}</SelectItem>
                ))}</SelectContent>
              </Select>
              {error('passengers') && <p id="flight-passengers-error" className="text-sm text-destructive">{error('passengers')}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={draft.flexible ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={draft.flexible}
              disabled={Boolean(draft.month && (!roundtrip || draft.returnMonth))} onClick={() => change({ flexible: !draft.flexible })}>{t('mask.flexible')}</Button>
            <Button type="button" variant={draft.nonStop ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={draft.nonStop}
              onClick={() => change({ nonStop: !draft.nonStop })}>{t('mask.direct')}</Button>
            {draft.programs.map((program) => (
              <Button key={program} type="button" variant="secondary" className="min-h-11 max-w-full whitespace-normal"
                aria-label={t('mask.removeProgram', { program: programLabels[program] ?? program })}
                onClick={() => change({ programs: draft.programs.filter((slug) => slug !== program) })}>
                {programLabels[program] ?? program}<X className="size-4 shrink-0" aria-hidden="true" />
              </Button>
            ))}
          </div>
          {(draft.month || draft.returnMonth) && <p className="text-sm text-muted-foreground">{t('mask.monthHint')}</p>}
          {(error('flexible', 'nonStop') || required) && <p role="alert" className="text-sm text-destructive">{error('flexible', 'nonStop') ?? t('issues.required')}</p>}
          <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
            {pending ? t('mask.searching') : t('mask.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
