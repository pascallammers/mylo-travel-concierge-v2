/**
 * Unit tests for the seats.aero award-response parser.
 *
 * The bug this guards against ("MYLO zeigt nur Lufthansa"): the old inline
 * parser read trip.Carriers (operating metal, e.g. LH/LX) and never read
 * trip.Source (the mileage PROGRAM: aeroplan/united/lufthansa). Every program
 * collapsed to its operating carrier. These tests pin Source -> program.
 *
 * Fixtures use the REAL seats.aero /partnerapi/search shape (verified live
 * against the production key, MUC->MIA 2026-09): entry-level Source plus
 * AvailabilityTrips[] with trip-level Source, Carriers, MileageCost,
 * TotalTaxes (cents), TaxesCurrency, Stops, DepartsAt/ArrivesAt,
 * FlightNumbers, AvailabilityID, Cabin (lowercase).
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { parseAwardResponse } from './parser';

describe('parseAwardResponse', () => {
  it('reads the mileage program from trip.Source, not the operating Carriers', () => {
    const raw = {
      data: [
        {
          ID: 'entry-1',
          Source: 'aeroplan',
          AvailabilityTrips: [
            {
              ID: 'trip-1',
              AvailabilityID: 'entry-1',
              Source: 'aeroplan',
              Carriers: 'LH, LX',
              MileageCost: 70000,
              TotalTaxes: 21000,
              TaxesCurrency: 'EUR',
              Stops: 1,
              DepartsAt: '2026-09-01T10:00:00Z',
              ArrivesAt: '2026-09-01T20:00:00Z',
              FlightNumbers: 'LH400, LX64',
              Cabin: 'business',
            },
          ],
        },
      ],
    };

    const flights = parseAwardResponse(raw);

    assert.strictEqual(flights.length, 1);
    assert.strictEqual(flights[0].program, 'aeroplan', 'program must come from Source');
    assert.strictEqual(flights[0].operatingCarriers, 'LH, LX', 'carriers stay separate');
  });

  it('maps the economic + itinerary shape from a real trip', () => {
    // Verbatim lufthansa trip from a live MUC->MIA call (taxes in cents).
    const raw = {
      data: [
        {
          ID: 'entry-lh',
          Source: 'lufthansa',
          AvailabilityTrips: [
            {
              ID: 'trip-lh',
              AvailabilityID: 'entry-lh',
              Source: 'lufthansa',
              Carriers: 'LH, LX',
              MileageCost: 16295,
              TotalTaxes: 35620,
              TaxesCurrency: 'EUR',
              Stops: 2,
              DepartsAt: '2026-09-01T04:41:00Z',
              ArrivesAt: '2026-09-01T17:25:00Z',
              FlightNumbers: 'LH3447, LH1186, LX64',
              Cabin: 'economy',
            },
          ],
        },
      ],
    };

    const [flight] = parseAwardResponse(raw);

    assert.strictEqual(flight.miles, 16295);
    assert.deepStrictEqual(flight.taxes, { amount: 356.2, currency: 'EUR' });
    assert.strictEqual(flight.stops, 2);
    assert.strictEqual(flight.departsAt, '2026-09-01T04:41:00Z');
    assert.strictEqual(flight.arrivesAt, '2026-09-01T17:25:00Z');
    assert.strictEqual(flight.flightNumbers, 'LH3447, LH1186, LX64');
    assert.strictEqual(flight.availabilityId, 'entry-lh');
    assert.strictEqual(flight.cabin, 'economy');
    assert.strictEqual(flight.remainingSeats, null, 'RemainingSeats 0 -> null (no seats advertised)');
  });

  it('carries RemainingSeats when the trip advertises them', () => {
    const raw = {
      data: [
        {
          ID: 'e',
          Source: 'aeroplan',
          AvailabilityTrips: [
            {
              ID: 't',
              AvailabilityID: 'e',
              Source: 'aeroplan',
              Carriers: 'AC',
              MileageCost: 70000,
              TotalTaxes: 0,
              TaxesCurrency: 'EUR',
              Stops: 1,
              RemainingSeats: 4,
              DepartsAt: '2026-09-01T10:00:00Z',
              ArrivesAt: '2026-09-01T20:00:00Z',
              FlightNumbers: 'AC1',
              Cabin: 'business',
            },
          ],
        },
      ],
    };

    assert.strictEqual(parseAwardResponse(raw)[0].remainingSeats, 4);
  });

  it('falls back to entry.Source when a trip omits its own Source', () => {
    const raw = {
      data: [
        {
          ID: 'entry-united',
          Source: 'united',
          AvailabilityTrips: [
            {
              ID: 'trip-no-source',
              AvailabilityID: 'entry-united',
              // Source intentionally absent on the trip
              Carriers: 'UA',
              MileageCost: 88000,
              TotalTaxes: 18600,
              TaxesCurrency: 'USD',
              Stops: 2,
              DepartsAt: '2026-09-01T11:00:00Z',
              ArrivesAt: '2026-09-01T22:00:00Z',
              FlightNumbers: 'UA961, UA2402',
              Cabin: 'business',
            },
          ],
        },
      ],
    };

    const [flight] = parseAwardResponse(raw);

    assert.strictEqual(flight.program, 'united', 'program falls back to entry.Source');
  });

  it('degrades a malformed trip to safe defaults instead of throwing', () => {
    const raw = {
      data: [
        {
          ID: 'e',
          Source: 'aeroplan',
          // Trip with only a program — every economic/itinerary field missing.
          AvailabilityTrips: [{ Source: 'aeroplan' }],
        },
      ],
    };

    const [flight] = parseAwardResponse(raw);

    assert.strictEqual(flight.program, 'aeroplan');
    assert.strictEqual(flight.miles, 0);
    assert.deepStrictEqual(flight.taxes, { amount: 0, currency: '' });
    assert.strictEqual(flight.stops, 0);
    // miles must be a number so downstream .toLocaleString() never throws.
    assert.doesNotThrow(() => flight.miles.toLocaleString());
  });

  it('skips trips that have no resolvable program (neither trip nor entry Source)', () => {
    const raw = {
      data: [
        {
          ID: 'entry-x',
          // no entry Source either
          AvailabilityTrips: [
            { ID: 't', AvailabilityID: 'entry-x', Carriers: 'XX', MileageCost: 1, Cabin: 'economy' },
          ],
        },
      ],
    };

    assert.deepStrictEqual(parseAwardResponse(raw), [], 'unattributable trips are dropped');
  });
});
