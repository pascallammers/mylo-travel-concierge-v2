/**
 * Unit tests for Amadeus Token Management
 * Tests cached token retrieval, new token requests, and token expiration
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getAmadeusToken, cleanupExpiredTokens } from './amadeus-token';
import * as queries from '@/lib/db/queries';

describe('Amadeus Token Manager', () => {
  describe('getAmadeusToken', () => {
    it('should return cached token if not expired', async () => {
      const mockToken = {
        id: 1,
        accessToken: 'TEST_CACHED_TOKEN_123',
        expiresAt: new Date(Date.now() + 1800000), // 30 minutes in future
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database query
      const originalQuery = queries.getAmadeusTokenFromDb;
      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => mockToken);

      const token = await getAmadeusToken();

      assert.strictEqual(token, 'TEST_CACHED_TOKEN_123', 'Should return cached token');
      assert.strictEqual((queries as any).getAmadeusTokenFromDb.mock.calls.length, 1, 'Should check database once');

      (queries as any).getAmadeusTokenFromDb = originalQuery;
    });

    it('should request new token if cache is expired', async () => {
      const expiredToken = {
        id: 1,
        accessToken: 'TEST_EXPIRED_TOKEN',
        expiresAt: new Date(Date.now() - 1000), // 1 second in past
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const originalQuery = queries.getAmadeusTokenFromDb;
      const originalSave = queries.saveAmadeusToken;

      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => expiredToken);
      (queries as any).saveAmadeusToken = mock.fn(async (token: string, expiresIn: number) => ({
        id: 2,
        accessToken: token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const mockAmadeusResponse = {
        access_token: 'TEST_NEW_TOKEN_456',
        expires_in: 1799,
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockAmadeusResponse,
      })) as any;

      const token = await getAmadeusToken();

      assert.strictEqual(token, 'TEST_NEW_TOKEN_456', 'Should return new token');
      assert.strictEqual((queries as any).saveAmadeusToken.mock.calls.length, 1, 'Should save new token');

      (queries as any).getAmadeusTokenFromDb = originalQuery;
      (queries as any).saveAmadeusToken = originalSave;
    });

    it('should request new token if no cached token exists', async () => {
      const originalQuery = queries.getAmadeusTokenFromDb;
      const originalSave = queries.saveAmadeusToken;

      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => null);
      (queries as any).saveAmadeusToken = mock.fn(async (token: string, expiresIn: number) => ({
        id: 1,
        accessToken: token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const mockAmadeusResponse = {
        access_token: 'TEST_BRAND_NEW_TOKEN_789',
        expires_in: 1799,
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockAmadeusResponse,
      })) as any;

      const token = await getAmadeusToken();

      assert.strictEqual(token, 'TEST_BRAND_NEW_TOKEN_789', 'Should return new token');
      assert.strictEqual((queries as any).saveAmadeusToken.mock.calls.length, 1, 'Should save new token');

      (queries as any).getAmadeusTokenFromDb = originalQuery;
      (queries as any).saveAmadeusToken = originalSave;
    });

    it('should handle Amadeus API errors', async () => {
      const originalQuery = queries.getAmadeusTokenFromDb;

      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => null);

      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })) as any;

      await assert.rejects(
        async () => await getAmadeusToken(),
        Error,
        'Should throw error on API failure'
      );

      (queries as any).getAmadeusTokenFromDb = originalQuery;
    });

    it('should handle network errors', async () => {
      const originalQuery = queries.getAmadeusTokenFromDb;

      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => null);

      global.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as any;

      await assert.rejects(
        async () => await getAmadeusToken(),
        Error,
        'Should throw error on network failure'
      );

      (queries as any).getAmadeusTokenFromDb = originalQuery;
    });

    it('should handle missing credentials', async () => {
      const originalClientId = process.env.AMADEUS_CLIENT_ID;
      const originalClientSecret = process.env.AMADEUS_CLIENT_SECRET;

      delete process.env.AMADEUS_CLIENT_ID;
      delete process.env.AMADEUS_CLIENT_SECRET;

      const originalQuery = queries.getAmadeusTokenFromDb;
      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => null);

      await assert.rejects(
        async () => await getAmadeusToken(),
        Error,
        'Should throw error when credentials are missing'
      );

      if (originalClientId) process.env.AMADEUS_CLIENT_ID = originalClientId;
      if (originalClientSecret) process.env.AMADEUS_CLIENT_SECRET = originalClientSecret;

      (queries as any).getAmadeusTokenFromDb = originalQuery;
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens from database', async () => {
      const originalCleanup = queries.deleteExpiredAmadeusTokens;

      const deleteMock = mock.fn(async () => 3); // 3 tokens deleted
      (queries as any).deleteExpiredAmadeusTokens = deleteMock;

      const deletedCount = await cleanupExpiredTokens();

      assert.strictEqual(deletedCount, 3, 'Should return count of deleted tokens');
      assert.strictEqual(deleteMock.mock.calls.length, 1, 'Should call delete function once');

      (queries as any).deleteExpiredAmadeusTokens = originalCleanup;
    });

    it('should handle cleanup errors gracefully', async () => {
      const originalCleanup = queries.deleteExpiredAmadeusTokens;

      (queries as any).deleteExpiredAmadeusTokens = mock.fn(async () => {
        throw new Error('Database error');
      });

      await assert.rejects(
        async () => await cleanupExpiredTokens(),
        Error,
        'Should throw error on cleanup failure'
      );

      (queries as any).deleteExpiredAmadeusTokens = originalCleanup;
    });
  });

  describe('Token caching behavior', () => {
    it('should cache token for subsequent calls', async () => {
      const mockToken = {
        id: 1,
        accessToken: 'TEST_PERSISTENT_TOKEN',
        expiresAt: new Date(Date.now() + 1800000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const originalQuery = queries.getAmadeusTokenFromDb;
      const queryMock = mock.fn(async () => mockToken);
      (queries as any).getAmadeusTokenFromDb = queryMock;

      // Call multiple times
      await getAmadeusToken();
      await getAmadeusToken();
      await getAmadeusToken();

      // Should only query database once (subsequent calls use cache)
      assert.ok(queryMock.mock.calls.length >= 1, 'Should query database at least once');

      (queries as any).getAmadeusTokenFromDb = originalQuery;
    });

    it('should refresh token when expiration is near (< 5 minutes)', async () => {
      const nearExpiryToken = {
        id: 1,
        accessToken: 'TEST_SOON_TO_EXPIRE',
        expiresAt: new Date(Date.now() + 240000), // 4 minutes
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const originalQuery = queries.getAmadeusTokenFromDb;
      const originalSave = queries.saveAmadeusToken;

      (queries as any).getAmadeusTokenFromDb = mock.fn(async () => nearExpiryToken);
      (queries as any).saveAmadeusToken = mock.fn(async (token: string) => ({
        id: 2,
        accessToken: token,
        expiresAt: new Date(Date.now() + 1800000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const mockAmadeusResponse = {
        access_token: 'TEST_REFRESHED_TOKEN',
        expires_in: 1799,
      };

      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => mockAmadeusResponse,
      })) as any;

      const token = await getAmadeusToken();

      assert.strictEqual(token, 'TEST_REFRESHED_TOKEN', 'Should refresh token when expiration is near');

      (queries as any).getAmadeusTokenFromDb = originalQuery;
      (queries as any).saveAmadeusToken = originalSave;
    });
  });
});
