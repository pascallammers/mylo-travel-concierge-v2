import assert from 'node:assert';
import { describe, it } from 'node:test';

import { applyAwardFilters } from '@/lib/api/award-search/award-filters';
import type { SeatsAeroFlight } from '@/lib/api/seats-aero-client';
import { filterFlightSearchAwards } from './flight-search-award-filters';

function awardFlight(program: string, taxes: number): SeatsAeroFlight {
  return {
    id: `${program}-${taxes}`,
    price: '70,000 miles',
    pricePerPerson: '70,000 miles',
    program,
    airline: 'XX',
    cabin: 'Business',
    tags: [],
    totalStops: 0,
    miles: 70000,
    taxes: { amount: taxes, currency: 'EUR' },
    seatsLeft: 1,
    bookingLinks: {},
    outbound: {
      departure: { airport: 'FRA', time: '2027-06-15T10:00:00Z' },
      arrival: { airport: 'JFK', time: '2027-06-15T18:00:00Z' },
      duration: '8h 0m',
      stops: 'Nonstop',
      flightNumbers: 'XX1',
    },
  };
}

describe('filterFlightSearchAwards', () => {
  it('maps loyaltyPrograms and maxTaxes into the award-filter pipeline', () => {
    const input = [
      awardFlight('aeroplan', 200),
      awardFlight('aeroplan', 500),
      awardFlight('united', 100),
    ];

    const result = filterFlightSearchAwards(
      input,
      { loyaltyPrograms: ['Aeroplan'], maxTaxes: 300 },
      'de',
      applyAwardFilters,
    );

    assert.deepStrictEqual(
      result.flights.map((flight) => `${flight.program}:${flight.taxes.amount}`),
      ['aeroplan:200'],
    );
    assert.deepStrictEqual(result.notes, []);
  });
});
