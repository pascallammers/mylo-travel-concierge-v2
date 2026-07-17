/**
 * Pure parser: raw seats.aero /partnerapi/search JSON -> AwardFlight[].
 *
 * The mileage PROGRAM lives in `Source` (aeroplan/united/lufthansa). The old
 * inline parser in seats-aero-client only read `Carriers` (operating metal),
 * collapsing every program to its carrier — the "MYLO zeigt nur Lufthansa" bug.
 * This module reads Source explicitly and keeps the operating carriers separate.
 *
 * Cabin-agnostic by design: every trip is parsed (carrying its lowercase
 * `cabin`); tolerant cabin filtering stays a caller concern.
 */

export interface AwardFlight {
  /** Unique trip id (trip.ID). */
  id: string;
  /** Mileage program slug from trip.Source (fallback entry.Source). */
  program: string;
  /** Operating carriers (metal) from trip.Carriers, e.g. "LH, LX". */
  operatingCarriers: string;
  /** Miles required (trip.MileageCost). */
  miles: number;
  /** Taxes — amount is the major unit (seats.aero reports cents). */
  taxes: { amount: number; currency: string };
  /** Number of stops (trip.Stops). */
  stops: number;
  /** ISO departure timestamp (trip.DepartsAt). */
  departsAt: string;
  /** ISO arrival timestamp (trip.ArrivesAt). */
  arrivesAt: string;
  /** Operating flight numbers (trip.FlightNumbers). */
  flightNumbers: string;
  /** Parent availability id, used later to build booking deeplinks. */
  availabilityId: string;
  /** Lowercase cabin from trip.Cabin (economy/business/...). */
  cabin: string;
  /** Remaining seats (trip.RemainingSeats); null when none advertised. */
  remainingSeats: number | null;
}

export function parseAwardResponse(raw: unknown): AwardFlight[] {
  const entries = Array.isArray((raw as any)?.data) ? (raw as any).data : [];
  const flights: AwardFlight[] = [];

  for (const entry of entries) {
    const trips = Array.isArray(entry?.AvailabilityTrips) ? entry.AvailabilityTrips : [];
    for (const trip of trips) {
      const program = trip.Source ?? entry.Source;
      // A trip we cannot attribute to a program is useless downstream (no
      // column to render, no grouping key) — drop it rather than invent one.
      if (!program) continue;

      // Default every field so a single malformed trip yields a degraded-but-
      // usable row instead of throwing downstream (e.g. miles.toLocaleString)
      // and taking the whole award batch with it.
      flights.push({
        id: trip.ID ?? '',
        program,
        operatingCarriers: trip.Carriers ?? '',
        miles: trip.MileageCost ?? 0,
        taxes: {
          amount: (trip.TotalTaxes ?? 0) / 100,
          currency: trip.TaxesCurrency ?? '',
        },
        stops: trip.Stops ?? 0,
        departsAt: trip.DepartsAt ?? '',
        arrivesAt: trip.ArrivesAt ?? '',
        flightNumbers: trip.FlightNumbers ?? '',
        availabilityId: trip.AvailabilityID ?? '',
        cabin: trip.Cabin ?? '',
        remainingSeats: trip.RemainingSeats || null,
      });
    }
  }

  return flights;
}
