/**
 * Group parsed award flights by mileage program, keeping each program's N
 * cheapest options.
 *
 * Replaces the naive `sort-by-miles + slice` that returned only the single
 * cheapest program (the "nur Lufthansa" symptom). Every distinct program
 * survives; within a program only the cheapest options are kept so a take=100
 * response (~30 entries per program) collapses to a scannable table.
 */

const DEFAULT_PER_PROGRAM = 3;

/**
 * Keep the cheapest options per program, ordered by each program’s cheapest trip.
 * @param flights - Ungrouped trips; unknown mileage sorts last.
 * @param perProgram - Maximum options retained per program.
 * @returns Grouped trips without mutating the input.
 */
export function groupByProgram<T extends { program: string; miles: number | null }>(
  flights: readonly T[],
  perProgram: number = DEFAULT_PER_PROGRAM,
): T[] {
  const byProgram = new Map<string, T[]>();
  for (const flight of flights) {
    const bucket = byProgram.get(flight.program);
    if (bucket) bucket.push(flight);
    else byProgram.set(flight.program, [flight]);
  }

  // Within each program: cheapest first, capped to N.
  const groups = [...byProgram.values()].map((bucket) =>
    [...bucket].sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity)).slice(0, perProgram),
  );

  // Across programs: order by each program's cheapest option, so the best
  // value leads the table while every program still appears.
  groups.sort((a, b) => (a[0].miles ?? Infinity) - (b[0].miles ?? Infinity));

  return groups.flat();
}
