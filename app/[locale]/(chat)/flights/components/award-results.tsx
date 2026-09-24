import { getTranslations } from 'next-intl/server';
import { ExternalLink, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AwardOptionView, AwardResultsView } from '@/lib/flights/award-results-view';
import { buildFlightsHref, type FlightsDraft } from '@/lib/flights/flights-query';

type Copy = Awaited<ReturnType<typeof getTranslations<'flights.results'>>>;
function FlightRow({ row, locale, t }: { row: AwardOptionView; locale: string; t: Copy }) {
  const number = (value: number) => value.toLocaleString(locale);
  const date = new Date(`${row.date}T00:00:00Z`);
  const dateLabel = Number.isNaN(date.getTime()) ? row.date : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = (value: string) => value.includes('T') ? value.slice(11, 16) : '—';
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium">{dateLabel}</p>
          <Badge variant={row.stops === 0 ? 'secondary' : 'outline'}>{row.stops === 0 ? t('direct') : t('stops', { count: row.stops })}</Badge>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-semibold tabular-nums">
          <span>{row.miles !== null ? t('miles', { miles: number(row.miles) }) : t('priceUnknown')}</span>
          <span className="text-sm font-normal text-muted-foreground">{row.taxes.amount !== null && row.taxes.currency
            ? `+ ${number(row.taxes.amount)} ${row.taxes.currency}` : t('taxesUnknown')}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t('perPerson')}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
          <span>{row.departure.airport} <strong>{time(row.departure.at)}</strong></span><span aria-hidden="true">→</span>
          <span>{row.arrival.airport} <strong>{time(row.arrival.at)}</strong></span>
          <span className="text-muted-foreground">· {row.duration || '—'}</span>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Plane className="size-4 shrink-0" aria-hidden="true" />{row.airline} · {row.flightNumbers || '—'}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className={`text-sm ${row.enoughSeats ? 'text-muted-foreground' : 'font-medium text-destructive'}`}>
            {row.seatsLeft === null ? t('seatsUnknown') : row.enoughSeats ? t('seats', { count: row.seatsLeft }) : t('notEnoughSeats', { count: row.seatsLeft })}
          </p>
          {row.bookingUrl ? <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <a href={row.bookingUrl} target="_blank" rel="noopener noreferrer">{t('book')}<ExternalLink className="size-4" aria-hidden="true" /><span className="sr-only">{t('newTab')}</span></a>
          </Button> : <span className="text-sm text-muted-foreground">{t('noBookingLink')}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Render independent award legs, grouped by tier and mileage program.
 * @param props - Presentation model, active draft and locale.
 * @returns Responsive award cards and explicit empty, quota and failure states.
 */
export async function AwardResults({ view, draft, locale }: { view: AwardResultsView; draft: FlightsDraft; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'flights.results' });
  return (
    <section className="space-y-8" aria-label={t('title')} aria-live="polite">
      <div><h2 className="text-xl font-semibold">{t('title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t(view.legs.length > 1 ? 'independentLegs' : 'availabilityHint')}</p></div>
      {view.filterNotes.length > 0 && <ul className="space-y-2 text-sm text-muted-foreground">{view.filterNotes.map((note) => <li key={note}>{note}</li>)}</ul>}
      {view.legs.map((leg) => (
        <section key={leg.role} className="space-y-4" aria-labelledby={`results-${leg.role}`}>
          <div>
            <h3 id={`results-${leg.role}`} className="text-lg font-semibold">{t(leg.role)} · {leg.origin} → {leg.destination}</h3>
            <p className="text-sm text-muted-foreground">{leg.window.start} – {leg.window.end}</p>
          </div>
          {leg.notice && <p role="status" className="rounded-lg border bg-muted/50 p-4 text-sm">{leg.notice}</p>}
          {leg.state === 'failed' && !leg.notice && <p role="status" className="rounded-lg border p-4 text-sm">{t('unavailable')}</p>}
          {leg.state === 'empty' && <div className="space-y-3 rounded-lg border border-dashed p-5">
            <p>{t('empty')}</p>
            {!draft.flexible && (leg.role === 'outbound' ? draft.departDate : draft.returnDate) && <Button asChild variant="outline" className="min-h-11">
              <a href={buildFlightsHref(locale, { ...draft, flexible: true })}>{t('tryFlexible')}</a>
            </Button>}
          </div>}
          {leg.state === 'options' && leg.sections.map((section) => (
            <div key={section.stops ?? 'all'} className="space-y-5">
              {section.stops !== null && <h4 className="font-medium">{section.stops === 0 ? t('direct') : t('connections', { count: section.stops })}</h4>}
              {section.programs.map((program) => (
                <div key={program.programSlug} className="space-y-3">
                  <h5 className="text-sm font-semibold">{program.programName}</h5>
                  <div className="grid gap-3 lg:grid-cols-2">{program.rows.map((row, index) => <FlightRow key={`${row.id}-${index}`} row={row} locale={locale} t={t} />)}</div>
                  {program.caveat && <p className="text-sm text-muted-foreground">{program.caveat}</p>}
                  {program.dachTransferLine && <p className="text-sm text-muted-foreground">{t('transfer', { sources: program.dachTransferLine })}</p>}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}

/**
 * Preserve the mask while the provider result streams in.
 * @param props - Localized loading label.
 * @returns Accessible skeleton matching the result cards.
 */
export function AwardResultsSkeleton({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="space-y-4"><p className="text-sm text-muted-foreground">{label}</p>
    <Skeleton className="h-7 w-48" /><div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>;
}
