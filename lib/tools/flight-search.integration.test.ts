/**
 * Integration tests for Flight Search Tool
 * Tests complete flight search flow, parallel API execution, session state, and tool registry
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { flightSearchTool } from './flight-search';
import * as seatsAeroClient from '@/lib/api/seats-aero-client';
import * as amadeusClient from '@/lib/api/amadeus-client';
import * as queries from '@/lib/db/queries';

describe('Flight Search Tool Integration', () => {
  describe('Complete flight search flow', () => {
    it('should execute complete search with both award and cash flights', async () => {
      const mockSeatsAeroResults = [
        {
          id: '1',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'LH',
          cabins: {
            business: {
              available: true,
              miles: 70000,
              seats: 4,
            },
          },
          segments: [],
          duration: 525,
          stops: 0,
          bookingLinks: ['https://seats.aero/book/123'],
        },
      ];

      const mockAmadeusResults = [
        {
          id: '2',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'UA',
          cabinClass: 'business',
          price: '850.00 EUR',
          segments: [],
          duration: 540,
          stops: 0,
        },
      ];

      // Mock API clients
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => mockSeatsAeroResults);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => mockAmadeusResults);

      // Mock database queries
      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({
        id: 1,
        ...params,
        dedupeKey: 'test-dedupe-key',
        createdAt: new Date(),
      }));

      (queries as any).updateToolCall = mock.fn(async (params) => ({
        ...params,
        completedAt: new Date(),
      }));

      (queries as any).mergeSessionState = mock.fn(async () => {});

      // Execute tool
      const result = await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      // Verify both APIs were called
      assert.strictEqual((seatsAeroClient as any).searchSeatsAero.mock.calls.length, 1, 'Should call Seats.aero once');
      assert.strictEqual((amadeusClient as any).searchAmadeus.mock.calls.length, 1, 'Should call Amadeus once');

      // Verify tool call was recorded
      assert.strictEqual((queries as any).recordToolCall.mock.calls.length, 1, 'Should record tool call');

      // Verify tool call was updated with results
      assert.strictEqual((queries as any).updateToolCall.mock.calls.length, 1, 'Should update tool call');

      // Verify session state was updated
      assert.strictEqual((queries as any).mergeSessionState.mock.calls.length, 1, 'Should update session state');

      // Verify result contains both types of flights
      assert.ok(result.includes('Award-Flüge'), 'Should contain award flights section');
      assert.ok(result.includes('Cash-Flüge'), 'Should contain cash flights section');

      // Restore original functions
      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });

    it('should handle award flights only', async () => {
      const mockSeatsAeroResults = [
        {
          id: '1',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'LH',
          cabins: {
            business: { available: true, miles: 70000, seats: 4 },
          },
          segments: [],
          duration: 525,
          stops: 0,
        },
      ];

      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => mockSeatsAeroResults);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => []);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      const result = await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: false,
      });

      assert.strictEqual((seatsAeroClient as any).searchSeatsAero.mock.calls.length, 1, 'Should call Seats.aero');
      assert.strictEqual((amadeusClient as any).searchAmadeus.mock.calls.length, 0, 'Should not call Amadeus');

      assert.ok(result.includes('Award-Flüge'), 'Should contain award flights');
      assert.ok(!result.includes('Cash-Flüge'), 'Should not contain cash flights section');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });

    it('should handle cash flights only', async () => {
      const mockAmadeusResults = [
        {
          id: '1',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'UA',
          cabinClass: 'business',
          price: '850.00 EUR',
          segments: [],
          duration: 540,
          stops: 0,
        },
      ];

      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => []);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => mockAmadeusResults);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      const result = await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: false,
        searchCashFlights: true,
      });

      assert.strictEqual((seatsAeroClient as any).searchSeatsAero.mock.calls.length, 0, 'Should not call Seats.aero');
      assert.strictEqual((amadeusClient as any).searchAmadeus.mock.calls.length, 1, 'Should call Amadeus');

      assert.ok(result.includes('Cash-Flüge'), 'Should contain cash flights');
      assert.ok(!result.includes('Award-Flüge'), 'Should not contain award flights section');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });
  });

  describe('Parallel API execution', () => {
    it('should execute both API calls in parallel', async () => {
      const startTimes: number[] = [];
      const endTimes: number[] = [];

      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 100));
        endTimes.push(Date.now());
        return [];
      });

      (amadeusClient as any).searchAmadeus = mock.fn(async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 100));
        endTimes.push(Date.now());
        return [];
      });

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      // Both should start around the same time (parallel execution)
      const timeDiff = Math.abs(startTimes[0] - startTimes[1]);
      assert.ok(timeDiff < 50, 'APIs should start within 50ms (parallel execution)');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });

    it('should continue if one API fails', async () => {
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => {
        throw new Error('Seats.aero API error');
      });

      (amadeusClient as any).searchAmadeus = mock.fn(async () => [
        {
          id: '1',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'UA',
          cabinClass: 'business',
          price: '850.00 EUR',
          segments: [],
          duration: 540,
          stops: 0,
        },
      ]);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      const result = await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      // Should still get Amadeus results
      assert.ok(result.includes('Cash-Flüge'), 'Should have cash flights despite award API failure');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });
  });

  describe('Session state updates', () => {
    it('should update session state with search parameters', async () => {
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => []);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => []);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);

      const mergeSessionStateMock = mock.fn(async (chatId: string, state: any) => {
        assert.ok(state.lastFlightSearch, 'Should include lastFlightSearch in state');
        assert.strictEqual(state.lastFlightSearch.origin, 'FRA', 'Should include origin');
        assert.strictEqual(state.lastFlightSearch.destination, 'JFK', 'Should include destination');
      });

      (queries as any).mergeSessionState = mergeSessionStateMock;

      await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      assert.strictEqual(mergeSessionStateMock.mock.calls.length, 1, 'Should update session state');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });
  });

  describe('Tool-call registry integration', () => {
    it('should record tool call before execution', async () => {
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => []);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => []);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      const recordToolCallMock = mock.fn(async (params) => {
        assert.strictEqual(params.toolName, 'search_flights', 'Should record correct tool name');
        assert.strictEqual(params.status, 'pending', 'Should start as pending');
        assert.ok(params.parameters, 'Should include parameters');
        return { id: 1, ...params, dedupeKey: 'test-key', createdAt: new Date() };
      });

      (queries as any).recordToolCall = recordToolCallMock;
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      assert.strictEqual(recordToolCallMock.mock.calls.length, 1, 'Should record tool call');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });

    it('should update tool call with results after execution', async () => {
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => []);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => []);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));

      const updateToolCallMock = mock.fn(async (params) => {
        assert.strictEqual(params.status, 'completed', 'Should mark as completed');
        assert.ok(params.result, 'Should include result');
        assert.ok(params.executionTime, 'Should include execution time');
        return params;
      });

      (queries as any).updateToolCall = updateToolCallMock;
      (queries as any).mergeSessionState = mock.fn(async () => {});

      await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      assert.strictEqual(updateToolCallMock.mock.calls.length, 1, 'Should update tool call');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });

    it('should handle tool call failures', async () => {
      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => {
        throw new Error('Critical error');
      });
      (amadeusClient as any).searchAmadeus = mock.fn(async () => {
        throw new Error('Critical error');
      });

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));

      const updateToolCallMock = mock.fn(async (params) => {
        if (params.status === 'failed') {
          assert.ok(params.error, 'Should include error message');
        }
        return params;
      });

      (queries as any).updateToolCall = updateToolCallMock;
      (queries as any).mergeSessionState = mock.fn(async () => {});

      await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: true,
      });

      // Should still update tool call even on failure
      assert.ok(updateToolCallMock.mock.calls.length >= 1, 'Should update tool call on failure');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });
  });

  describe('German response formatting', () => {
    it('should format response in German', async () => {
      const mockResults = [
        {
          id: '1',
          origin: 'FRA',
          destination: 'JFK',
          departureDate: '2025-03-15',
          airline: 'LH',
          cabins: {
            business: { available: true, miles: 70000, seats: 4 },
          },
          segments: [],
          duration: 525,
          stops: 0,
        },
      ];

      const originalSeatsAero = seatsAeroClient.searchSeatsAero;
      const originalAmadeus = amadeusClient.searchAmadeus;

      (seatsAeroClient as any).searchSeatsAero = mock.fn(async () => mockResults);
      (amadeusClient as any).searchAmadeus = mock.fn(async () => []);

      const originalRecordToolCall = queries.recordToolCall;
      const originalUpdateToolCall = queries.updateToolCall;
      const originalMergeSessionState = queries.mergeSessionState;

      (queries as any).recordToolCall = mock.fn(async (params) => ({ id: 1, ...params }));
      (queries as any).updateToolCall = mock.fn(async (params) => params);
      (queries as any).mergeSessionState = mock.fn(async () => {});

      const result = await flightSearchTool.execute({
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
        passengers: 1,
        searchAwardFlights: true,
        searchCashFlights: false,
      });

      // Check for German text
      assert.ok(result.includes('Flug'), 'Should contain German word for flight');
      assert.ok(!result.includes('Flight'), 'Should not contain English words');

      (seatsAeroClient as any).searchSeatsAero = originalSeatsAero;
      (amadeusClient as any).searchAmadeus = originalAmadeus;
      (queries as any).recordToolCall = originalRecordToolCall;
      (queries as any).updateToolCall = originalUpdateToolCall;
      (queries as any).mergeSessionState = originalMergeSessionState;
    });
  });
});
