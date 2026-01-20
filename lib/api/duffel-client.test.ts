/**
 * Unit tests for Duffel API Client
 * Tests cash flight search, error handling, and parameter mapping
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock serverEnv before importing the module
const mockServerEnv = {
  DUFFEL_API_KEY: 'test_duffel_key',
};

// We need to mock the module
let originalFetch: typeof global.fetch;

describe('Duffel Client', () => {
  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('searchDuffel', () => {
    it('should successfully search for cash flights', async () => {
      const mockResponse = {
        data: {
          offers: [
            {
              id: 'off_001',
              total_amount: '450.00',
              base_amount: '380.00',
              total_currency: 'EUR',
              total_emissions_kg: '245',
              owner: {
                name: 'Lufthansa',
                iata_code: 'LH',
                logo_symbol_url: 'https://assets.duffel.com/img/airlines/LH.svg',
              },
              slices: [
                {
                  duration: 'PT8H30M',
                  segments: [
                    {
                      origin: { iata_code: 'FRA' },
                      destination: { iata_code: 'JFK' },
                      departing_at: '2025-03-15T10:30:00',
                      arriving_at: '2025-03-15T14:00:00',
                      operating_carrier: { iata_code: 'LH' },
                      operating_carrier_flight_number: '400',
                      aircraft: { name: 'Airbus A350-900' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      // Dynamic import to use mocked fetch
      const { searchDuffel } = await import('./duffel-client');

      const results = await searchDuffel({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(results.length, 1, 'Should return one result');
      assert.strictEqual(results[0].airline, 'Lufthansa', 'Airline should match');
      assert.strictEqual(results[0].price.total, '450.00', 'Price should match');
      assert.strictEqual(results[0].price.currency, 'EUR', 'Currency should match');
      assert.strictEqual(results[0].departure.airport, 'FRA', 'Origin should match');
      assert.strictEqual(results[0].arrival.airport, 'JFK', 'Destination should match');
      assert.strictEqual(results[0].emissionsKg, 245, 'Emissions should be parsed');
    });

    it('should handle 401 authentication error', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ errors: [{ message: 'Invalid token' }] }),
      })) as any;

      const { searchDuffel } = await import('./duffel-client');

      await assert.rejects(
        async () => {
          await searchDuffel({
            origin: 'FRA',
            destination: 'JFK',
            departureDate: '2025-03-15',
            cabinClass: 'economy',
            passengers: 1,
          });
        },
        /authentication failed/i,
        'Should throw authentication error'
      );
    });

    it('should handle 429 rate limit error', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ errors: [{ message: 'Rate limit exceeded' }] }),
      })) as any;

      const { searchDuffel } = await import('./duffel-client');

      await assert.rejects(
        async () => {
          await searchDuffel({
            origin: 'FRA',
            destination: 'JFK',
            departureDate: '2025-03-15',
            cabinClass: 'economy',
            passengers: 1,
          });
        },
        /rate limit/i,
        'Should throw rate limit error'
      );
    });

    it('should handle 422 validation error', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ errors: [{ message: 'Invalid airport code' }] }),
      })) as any;

      const { searchDuffel } = await import('./duffel-client');

      await assert.rejects(
        async () => {
          await searchDuffel({
            origin: 'INVALID',
            destination: 'JFK',
            departureDate: '2025-03-15',
            cabinClass: 'economy',
            passengers: 1,
          });
        },
        /validation error/i,
        'Should throw validation error'
      );
    });

    it('should handle empty results gracefully', async () => {
      const mockResponse = {
        data: {
          offers: [],
        },
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const { searchDuffel } = await import('./duffel-client');

      const results = await searchDuffel({
        origin: 'FRA',
        destination: 'XXX',
        departureDate: '2025-03-15',
        cabinClass: 'economy',
        passengers: 1,
      });

      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(results.length, 0, 'Should return empty array');
    });

    it('should include return slice for round-trip flights', async () => {
      let capturedBody: any = null;

      global.fetch = mock.fn(async (_url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ data: { offers: [] } }),
        };
      }) as any;

      const { searchDuffel } = await import('./duffel-client');

      await searchDuffel({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        returnDate: '2025-03-22',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.strictEqual(capturedBody.data.slices.length, 2, 'Should have 2 slices for round-trip');
      assert.strictEqual(capturedBody.data.slices[0].origin, 'FRA', 'First slice origin');
      assert.strictEqual(capturedBody.data.slices[0].destination, 'JFK', 'First slice destination');
      assert.strictEqual(capturedBody.data.slices[1].origin, 'JFK', 'Return slice origin');
      assert.strictEqual(capturedBody.data.slices[1].destination, 'FRA', 'Return slice destination');
    });

    it('should set correct passenger count', async () => {
      let capturedBody: any = null;

      global.fetch = mock.fn(async (_url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ data: { offers: [] } }),
        };
      }) as any;

      const { searchDuffel } = await import('./duffel-client');

      await searchDuffel({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'economy',
        passengers: 3,
      });

      assert.strictEqual(capturedBody.data.passengers.length, 3, 'Should have 3 passengers');
      assert.ok(
        capturedBody.data.passengers.every((p: any) => p.type === 'adult'),
        'All passengers should be adults'
      );
    });
  });

  describe('mapCabinClass', () => {
    it('should map uppercase cabin classes to Duffel format', async () => {
      const { mapCabinClass } = await import('./duffel-client');

      assert.strictEqual(mapCabinClass('ECONOMY'), 'economy');
      assert.strictEqual(mapCabinClass('PREMIUM_ECONOMY'), 'premium_economy');
      assert.strictEqual(mapCabinClass('BUSINESS'), 'business');
      assert.strictEqual(mapCabinClass('FIRST'), 'first');
    });

    it('should default to economy for unknown cabin classes', async () => {
      const { mapCabinClass } = await import('./duffel-client');

      assert.strictEqual(mapCabinClass('UNKNOWN'), 'economy');
      assert.strictEqual(mapCabinClass(''), 'economy');
    });
  });
});
