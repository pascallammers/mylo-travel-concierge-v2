import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InMemoryToolResultCacheBackend,
  ToolResultCache,
  type CachedToolResult,
  type ToolResultCacheBackend,
} from './tool-result-cache';

describe('ToolResultCache', () => {
  it('sets and gets a single tool result', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', { ok: true });

    const results = cache.get('stream-1');
    assert.equal(results.get('search_flights')?.[0]?.toolCallId, 'call-1');
    assert.deepEqual(results.get('search_flights')?.[0]?.result, { ok: true });
  });

  it('groups multiple tools in the same stream', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', 'award');
    cache.set('stream-1', 'kiwi_flight_search', 'call-2', 'cash');

    const results = cache.get('stream-1');
    assert.equal(results.get('search_flights')?.length, 1);
    assert.equal(results.get('kiwi_flight_search')?.length, 1);
  });

  it('does not duplicate the same tool call when cached from chunk and step hooks', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', 'first');
    cache.set('stream-1', 'search_flights', 'call-1', 'duplicate');

    const results = cache.get('stream-1').get('search_flights') ?? [];
    assert.equal(results.length, 1);
    assert.equal(results[0].result, 'first');
  });

  it('allows the same tool call id in a different stream', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', 'one');
    cache.set('stream-2', 'search_flights', 'call-1', 'two');

    assert.equal(cache.get('stream-1').get('search_flights')?.[0]?.result, 'one');
    assert.equal(cache.get('stream-2').get('search_flights')?.[0]?.result, 'two');
  });

  it('isolates different stream ids', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', 'one');
    cache.set('stream-2', 'search_flights', 'call-2', 'two');

    assert.equal(cache.get('stream-1').get('search_flights')?.[0]?.result, 'one');
    assert.equal(cache.get('stream-2').get('search_flights')?.[0]?.result, 'two');
  });

  it('evicts only the requested stream', () => {
    const cache = new ToolResultCache();

    cache.set('stream-1', 'search_flights', 'call-1', 'one');
    cache.set('stream-2', 'search_flights', 'call-2', 'two');
    cache.evict('stream-1');

    assert.equal(cache.get('stream-1').size, 0);
    assert.equal(cache.get('stream-2').get('search_flights')?.[0]?.result, 'two');
  });

  it('treats expired entries as missing on get', () => {
    let now = 1_000;
    const cache = new ToolResultCache({ ttlMs: 50, now: () => now });

    cache.set('stream-1', 'search_flights', 'call-1', 'old');
    now = 1_051;

    assert.equal(cache.get('stream-1').size, 0);
  });

  it('keeps the same semantics with a mock backend', () => {
    const inMemory = new ToolResultCache({ backend: new InMemoryToolResultCacheBackend() });
    const mock = new ToolResultCache({ backend: new MockToolResultCacheBackend() });

    for (const cache of [inMemory, mock]) {
      cache.set('stream-1', 'search_flights', 'call-1', 'one');
      cache.set('stream-1', 'kiwi_flight_search', 'call-2', 'two');
      cache.evict('stream-missing');
    }

    assert.deepEqual(
      [...inMemory.get('stream-1').entries()].map(([toolName, entries]) => [
        toolName,
        entries.map((entry) => entry.result),
      ]),
      [...mock.get('stream-1').entries()].map(([toolName, entries]) => [
        toolName,
        entries.map((entry) => entry.result),
      ]),
    );
  });
});

class MockToolResultCacheBackend implements ToolResultCacheBackend {
  private readonly entries: CachedToolResult[] = [];

  set(entry: CachedToolResult): void {
    this.entries.push(entry);
  }

  get(streamId: string): CachedToolResult[] {
    return this.entries.filter((entry) => entry.streamId === streamId);
  }

  evict(streamId: string): void {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      if (this.entries[index].streamId === streamId) {
        this.entries.splice(index, 1);
      }
    }
  }
}
