// Performance cache with memory limits and automatic cleanup

import { db } from '@/lib/db';
import { payment, subscription, user } from './db/schema';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  accessCount: number;
  lastAccessed: number;
}

class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly name: string;

  constructor(name: string, maxSize: number = 1000, ttlMs: number = 2 * 60 * 1000) {
    this.name = name;
    this.maxSize = maxSize;
    this.ttl = ttlMs;

    // Clean up every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.cachedAt > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  set(key: string, data: T): void {
    // Enforce memory limits
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey = '';
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }

    // Cleanup completed silently
  }
}

// Create cache instances with appropriate limits
export const sessionCache = new PerformanceCache<any>('sessions', 500, 15 * 60 * 1000); // 15 min, 500 sessions
export const usageCountCache = new PerformanceCache<number>('usage-counts', 2000, 5 * 60 * 1000); // 5 min, 2000 users
export const paymentCache = new PerformanceCache<any>('payments', 1000, 5 * 60 * 1000); // 5 min, 1000 users

// Cache key generators
export const createSessionKey = (token: string) => `session:${token}`;
export const createUserKey = (token: string) => `user:${token}`;
export const createMessageCountKey = (userId: string) => `msg-count:${userId}`;
export const createExtremeCountKey = (userId: string) => `extreme-count:${userId}`;
export const createPaymentKey = (userId: string) => `payments:${userId}`;

// Airport extraction cache types
interface AirportExtractionCacheEntry {
  origin: { code: string; name: string; confidence: string } | null;
  destination: { code: string; name: string; confidence: string } | null;
  cachedAt: number;
}

interface AirportCorrectionEntry {
  originalQuery: string;      // e.g., "liberia costa rica"
  extractedCode: string;      // what LLM originally extracted: "LIB"
  correctedCode: string;      // what user corrected to: "LIR"
  correctedAt: number;
}

// Airport extraction cache - 24h TTL, 500 entries
export const airportExtractionCache = new PerformanceCache<AirportExtractionCacheEntry>(
  'airport-extractions',
  500,
  24 * 60 * 60 * 1000  // 24 hours TTL
);

// User correction cache - stores user-validated corrections to influence future extractions
// Key: normalized original query pattern, Value: corrected IATA code
export const airportCorrectionCache = new PerformanceCache<AirportCorrectionEntry>(
  'airport-corrections',
  200,
  7 * 24 * 60 * 60 * 1000  // 7 days TTL - corrections are valuable long-term
);

// Cache key generator for airport queries
export const createAirportKey = (query: string) =>
  `airport:${query.toLowerCase().trim().replace(/\s+/g, '-')}`;

// Extract session token from headers
export function extractSessionToken(headers: Headers): string | null {
  const cookies = headers.get('cookie');
  if (!cookies) return null;

  const match = cookies.match(/better-auth\.session_token=([^;]+)/);
  return match ? match[1] : null;
}

export function getCachedPayments(userId: string) {
  return paymentCache.get(createPaymentKey(userId));
}

export function setCachedPayments(userId: string, payments: any) {
  paymentCache.set(createPaymentKey(userId), payments);
}

// Cache invalidation helpers
export function invalidateUserCaches(userId: string) {
  usageCountCache.delete(createMessageCountKey(userId));
  usageCountCache.delete(createExtremeCountKey(userId));
  paymentCache.delete(createPaymentKey(userId));

  // Invalidate the db cache
  db.$cache.invalidate({ tables: [user, subscription, payment] });
}

export function invalidateAllCaches() {
  sessionCache.clear();
  usageCountCache.clear();
  paymentCache.clear();
}
