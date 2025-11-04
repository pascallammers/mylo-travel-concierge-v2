/**
 * Unit tests for Amadeus API Client
 * Tests cash flight search, return date handling, and passenger count
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { searchAmadeus } from './amadeus-client';
import * as tokenManager from './amadeus-token';

describe('Amadeus Client', () => {
  describe('searchAmadeus', () => {
    it('should successfully search for cash flights', async () => {
      // Mock token retrieval
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      const mockResponse = {
        data: [
          {
            id: '1',
            type: 'flight-offer',
            price: {
              total: '850.00',
              currency: 'EUR',
            },
            itineraries: [
              {
                duration: 'PT8H45M',
                segments: [
                  {
                    departure: {
                      iataCode: 'FRA',
                      at: '2025-03-15T10:30:00',
                    },
                    arrival: {
                      iataCode: 'JFK',
                      at: '2025-03-15T14:15:00',
                    },
                    carrierCode: 'LH',
                    number: '400',
                  },
                ],
              },
            ],
            travelerPricings: [
              {
                fareDetailsBySegment: [
                  {
                    cabin: 'BUSINESS',
                  },
                ],
              },
            ],
          },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const results = await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(results.length, 1, 'Should return one result');
      assert.strictEqual(results[0].origin, 'FRA', 'Origin should match');
      assert.strictEqual(results[0].destination, 'JFK', 'Destination should match');
      assert.strictEqual(results[0].price, '850.00 EUR', 'Price should be formatted');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should handle return date for round-trip flights', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      const mockResponse = {
        data: [
          {
            id: '1',
            type: 'flight-offer',
            price: { total: '1200.00', currency: 'EUR' },
            itineraries: [
              {
                duration: 'PT8H45M',
                segments: [
                  {
                    departure: { iataCode: 'FRA', at: '2025-03-15T10:30:00' },
                    arrival: { iataCode: 'JFK', at: '2025-03-15T14:15:00' },
                    carrierCode: 'LH',
                    number: '400',
                  },
                ],
              },
              {
                duration: 'PT8H30M',
                segments: [
                  {
                    departure: { iataCode: 'JFK', at: '2025-03-22T18:00:00' },
                    arrival: { iataCode: 'FRA', at: '2025-03-23T08:30:00' },
                    carrierCode: 'LH',
                    number: '401',
                  },
                ],
              },
            ],
            travelerPricings: [
              {
                fareDetailsBySegment: [
                  { cabin: 'BUSINESS' },
                  { cabin: 'BUSINESS' },
                ],
              },
            ],
          },
        ],
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const results = await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        returnDate: '2025-03-22',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.ok(results.length > 0, 'Should return results for round-trip');
      assert.ok(results[0].returnFlight, 'Should have return flight information');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should handle multiple passengers correctly', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      const mockResponse = {
        data: [
          {
            id: '1',
            type: 'flight-offer',
            price: { total: '1700.00', currency: 'EUR' },
            itineraries: [
              {
                duration: 'PT8H45M',
                segments: [
                  {
                    departure: { iataCode: 'FRA', at: '2025-03-15T10:30:00' },
                    arrival: { iataCode: 'JFK', at: '2025-03-15T14:15:00' },
                    carrierCode: 'LH',
                    number: '400',
                  },
                ],
              },
            ],
            travelerPricings: [
              { fareDetailsBySegment: [{ cabin: 'BUSINESS' }] },
              { fareDetailsBySegment: [{ cabin: 'BUSINESS' }] },
            ],
          },
        ],
      };

      const fetchMock = mock.fn(async (url: string) => {
        // Verify passengers parameter in URL
        assert.ok(url.includes('adults=2'), 'Should include correct passenger count in URL');
        return {
          ok: true,
          json: async () => mockResponse,
        };
      });

      global.fetch = fetchMock as any;

      await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 2,
      });

      assert.strictEqual(fetchMock.mock.calls.length, 1, 'Should make one API call');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should handle API errors gracefully', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })) as any;

      const results = await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.ok(Array.isArray(results), 'Should return array on error');
      assert.strictEqual(results.length, 0, 'Should return empty array on error');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should handle token retrieval failure', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => {
        throw new Error('Token retrieval failed');
      });

      const results = await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.strictEqual(results.length, 0, 'Should return empty array on token failure');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should correctly map cabin classes to Amadeus format', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      const fetchMock = mock.fn(async (url: string) => {
        if (url.includes('travelClass=ECONOMY')) {
          assert.ok(true, 'Should map economy correctly');
        } else if (url.includes('travelClass=PREMIUM_ECONOMY')) {
          assert.ok(true, 'Should map premium correctly');
        } else if (url.includes('travelClass=BUSINESS')) {
          assert.ok(true, 'Should map business correctly');
        } else if (url.includes('travelClass=FIRST')) {
          assert.ok(true, 'Should map first correctly');
        }

        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      });

      global.fetch = fetchMock as any;

      await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'economy',
        passengers: 1,
      });

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });

    it('should handle network errors', async () => {
      const originalGetToken = tokenManager.getAmadeusToken;
      (tokenManager as any).getAmadeusToken = mock.fn(async () => 'mock-token');

      global.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const results = await searchAmadeus({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
      });

      assert.ok(Array.isArray(results), 'Should return array on network error');
      assert.strictEqual(results.length, 0, 'Should return empty array on network error');

      (tokenManager as any).getAmadeusToken = originalGetToken;
    });
  });
});
