/**
 * Group parsed award flights by mileage program, keeping each program's N
 * cheapest options.
 *
 * Replaces the naive `sort-by-miles + slice` that returned only the single
 * cheapest program (the "nur Lufthansa" symptom). Every distinct program
 * survives; within a program only the cheapest options are kept so a take=100
 * response (~30 entries per program) collapses to a scannable table.
 */

import type { AwardFlight } from './parser';

const DEFAULT_PER_PROGRAM = 3;

export function groupByProgram(
  flights: AwardFlight[],
  perProgram: number = DEFAULT_PER_PROGRAM,
): AwardFlight[] {
  const byProgram = new Map<string, AwardFlight[]>();
  for (const flight of flights) {
    const bucket = byProgram.get(flight.program);
    if (bucket) bucket.push(flight);
    else byProgram.set(flight.program, [flight]);
  }

  // Within each program: cheapest first, capped to N.
  const groups = [...byProgram.values()].map((bucket) =>
    [...bucket].sort((a, b) => a.miles - b.miles).slice(0, perProgram),
  );

  // Across programs: order by each program's cheapest option, so the best
  // value leads the table while every program still appears.
  groups.sort((a, b) => a[0].miles - b[0].miles);

  return groups.flat();
}
