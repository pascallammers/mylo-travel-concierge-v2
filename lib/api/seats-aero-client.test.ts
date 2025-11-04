/**
 * Unit tests for Seats.aero API Client
 * Tests business class search, error handling, date flexibility, and result filtering
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { searchSeatsAero } from './seats-aero-client';

// Mock fetch globally
const originalFetch = global.fetch;

describe('Seats.aero Client', () => {
  describe('searchSeatsAero', () => {
    it('should successfully search for business class flights', async () => {
      // Mock API response
      const mockResponse = {
        data: [
          {
            id: 'test-flight-1',
            origin: 'FRA',
            destination: 'JFK',
            date: '2025-03-15',
            business: {
              available: true,
              miles: 70000,
              seats: 4,
            },
            segments: [
              {
                airline: 'LH',
                flight_number: '400',
                departure_time: '10:30',
                arrival_time: '14:15',
                duration: 525,
              },
            ],
          },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      });

      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(results.length, 1, 'Should return one result');
      assert.strictEqual(results[0].origin, 'FRA', 'Origin should match');
      assert.strictEqual(results[0].destination, 'JFK', 'Destination should match');
      assert.ok(results[0].cabins.business, 'Should have business cabin');
      assert.strictEqual(results[0].cabins.business?.miles, 70000, 'Miles should match');

      global.fetch = originalFetch;
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })) as any;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      });

      assert.ok(Array.isArray(results), 'Should return an array even on error');
      assert.strictEqual(results.length, 0, 'Should return empty array on error');

      global.fetch = originalFetch;
    });

    it('should apply date flexibility correctly', async () => {
      const mockResponse = {
        data: [
          { id: '1', date: '2025-03-15', origin: 'FRA', destination: 'JFK', business: { available: true, miles: 70000, seats: 2 } },
          { id: '2', date: '2025-03-16', origin: 'FRA', destination: 'JFK', business: { available: true, miles: 65000, seats: 1 } },
          { id: '3', date: '2025-03-17', origin: 'FRA', destination: 'JFK', business: { available: true, miles: 75000, seats: 3 } },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        flexibleDates: true,
      });

      assert.ok(results.length >= 1, 'Should return results with flexible dates');
      // Check that dates are within ±3 days
      const baseDate = new Date('2025-03-15');
      results.forEach((flight) => {
        const flightDate = new Date(flight.departureDate);
        const diffDays = Math.abs((flightDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        assert.ok(diffDays <= 3, 'Flight should be within ±3 days');
      });

      global.fetch = originalFetch;
    });

    it('should filter results by cabin class availability', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            origin: 'FRA',
            destination: 'JFK',
            date: '2025-03-15',
            business: { available: true, miles: 70000, seats: 2 },
            economy: { available: false, miles: 0, seats: 0 },
          },
          {
            id: '2',
            origin: 'FRA',
            destination: 'JFK',
            date: '2025-03-15',
            business: { available: false, miles: 0, seats: 0 },
            economy: { available: true, miles: 25000, seats: 5 },
          },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const businessResults = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      });

      assert.strictEqual(businessResults.length, 1, 'Should filter to only business available');
      assert.ok(businessResults[0].cabins.business?.available, 'Business should be available');

      global.fetch = originalFetch;
    });

    it('should handle missing API key gracefully', async () => {
      const originalApiKey = process.env.SEATSAERO_API_KEY;
      delete process.env.SEATSAERO_API_KEY;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      });

      assert.strictEqual(results.length, 0, 'Should return empty array without API key');

      if (originalApiKey) {
        process.env.SEATSAERO_API_KEY = originalApiKey;
      }
    });

    it('should correctly map cabin classes', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            origin: 'FRA',
            destination: 'JFK',
            date: '2025-03-15',
            economy: { available: true, miles: 25000, seats: 9 },
            premium_economy: { available: true, miles: 40000, seats: 4 },
            business: { available: true, miles: 70000, seats: 2 },
            first: { available: true, miles: 110000, seats: 1 },
          },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'premium',
      });

      assert.ok(results[0].cabins.premium, 'Should have premium cabin mapped');

      global.fetch = originalFetch;
    });

    it('should handle network errors', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const results = await searchSeatsAero({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      });

      assert.ok(Array.isArray(results), 'Should return array on network error');
      assert.strictEqual(results.length, 0, 'Should return empty array on network error');

      global.fetch = originalFetch;
    });
  });
});
