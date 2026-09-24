import type { getProgramDisplayName, getProgramBookingUrl, getProgramCaveat } from '@/lib/api/award-search/program-registry';
import { describeDirectTiering, type FlightLocale } from './direct-tiering';
import { collectDachTransferHints, type TransferHintDependencies } from './dach-transfer-sources';
import { formatAwardQuotaNotice, type AwardLeg, type AwardSearchResult } from './award-search';
import { searchWindowBounds, type ResolvedFlightSearch } from './search-input';

export interface AwardResultsViewDeps extends TransferHintDependencies {
  getProgramDisplayName: typeof getProgramDisplayName;
  getProgramBookingUrl: typeof getProgramBookingUrl;
  getProgramCaveat: typeof getProgramCaveat;
}
export interface AwardOptionView {
  id: string; airline: string; flightNumbers: string; date: string;
  departure: { airport: string; at: string }; arrival: { airport: string; at: string };
  duration: string; stops: number; miles: number | null;
  taxes: { amount: number | null; currency: string | null };
  seatsLeft: number | null; enoughSeats: boolean; dayOffset: number | null; bookingUrl: string | null;
}
export interface AwardProgramGroup {
  programSlug: string; programName: string; caveat: string | null; dachTransferLine: string | null; rows: AwardOptionView[];
}
export interface AwardTierSection { stops: number | null; programs: AwardProgramGroup[] }
interface LegHead {
  role: 'outbound' | 'inbound'; origin: string; destination: string; window: { start: string; end: string };
}
export type AwardLegView = LegHead & (
  | { state: 'options'; notice: string | null; sections: AwardTierSection[] }
  | { state: 'empty'; notice: string | null }
  | { state: 'failed'; failure: 'rate_limited' | 'provider_unavailable'; notice: string | null }
);
export interface AwardResultsView { legs: AwardLegView[]; filterNotes: string[] }

/**
 * Build phone-friendly program groups from exactly the same award result the chat receives.
 * @param result - Ranked and filtered outcomes for independent legs.
 * @param search - Validated search including passenger count.
 * @param locale - Labels for program caveats and transfer hints.
 * @param deps - Shared registry and runtime transfer resolvers.
 * @returns Tier sections, program groups and rows without provider objects.
 */
export function buildAwardResultsView(
  result: AwardSearchResult, search: ResolvedFlightSearch, locale: FlightLocale, deps: AwardResultsViewDeps,
): AwardResultsView {
  function present(leg: AwardLeg, role: LegHead['role']): AwardLegView {
    const window = role === 'outbound' ? search.outbound : search.inbound!;
    const bounds = searchWindowBounds(window, search.today);
    const head: LegHead = { role, window: bounds,
      origin: role === 'outbound' ? search.origin : search.destination,
      destination: role === 'outbound' ? search.destination : search.origin };
    if (leg.status === 'failed') return { ...head, state: 'failed', failure: leg.failure.kind,
      notice: leg.failure.kind === 'rate_limited' ? formatAwardQuotaNotice(leg.failure.resetsAt, locale) : null };
    const notice = describeDirectTiering(leg.tiering, { cabin: search.cabin, leg: null, locale });
    if (!leg.options.length) return { ...head, state: 'empty', notice };
    const hints = collectDachTransferHints(leg.options.map((f) => f.program), locale, deps);
    const sections: AwardTierSection[] = [];
    for (const flight of leg.options) {
      const stops = leg.tiering ? flight.totalStops : null;
      let section = sections.find((item) => item.stops === stops);
      if (!section) { section = { stops, programs: [] }; sections.push(section); }
      let program = section.programs.find((item) => item.programSlug === flight.program);
      if (!program) {
        program = { programSlug: flight.program, programName: deps.getProgramDisplayName(flight.program, locale),
          caveat: deps.getProgramCaveat(flight.program, locale),
          dachTransferLine: hints.find((hint) => hint.programSlug === flight.program)?.sources.join(', ') ?? null, rows: [] };
        section.programs.push(program);
      }
      const date = flight.outbound.departure.time.split('T')[0] || bounds.start;
      program.rows.push({
        id: flight.id, airline: flight.airline, flightNumbers: flight.outbound.flightNumbers, date,
        departure: { airport: flight.outbound.departure.airport, at: flight.outbound.departure.time },
        arrival: { airport: flight.outbound.arrival.airport, at: flight.outbound.arrival.time },
        duration: flight.outbound.duration, stops: flight.totalStops, miles: flight.miles, taxes: { ...flight.taxes },
        seatsLeft: flight.seatsLeft, enoughSeats: flight.seatsLeft === null || flight.seatsLeft >= search.passengers,
        dayOffset: window.kind === 'day' && window.flexDays > 0
          ? Math.round((Date.parse(date) - Date.parse(window.date)) / 86400000) : null,
        bookingUrl: deps.getProgramBookingUrl(flight.program, { origin: flight.outbound.departure.airport,
          destination: flight.outbound.arrival.airport, departDate: date, cabin: flight.cabin }),
      });
    }
    return { ...head, state: 'options', notice, sections };
  }
  return { legs: [present(result.outbound, 'outbound'),
    ...(result.inbound.status !== 'skipped' && search.inbound ? [present(result.inbound, 'inbound')] : [])],
    filterNotes: result.filterNotes };
}
