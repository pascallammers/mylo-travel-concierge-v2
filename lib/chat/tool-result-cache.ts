export interface CachedToolResult {
  streamId: string;
  toolName: string;
  toolCallId: string;
  result: unknown;
  receivedAt: number;
  sequence: number;
}

export type ToolResultsByName = Map<string, CachedToolResult[]>;

export interface ToolResultCacheBackend {
  set(entry: CachedToolResult): void;
  get(streamId: string): CachedToolResult[];
  evict(streamId: string): void;
}

interface ToolResultCacheOptions {
  ttlMs?: number;
  now?: () => number;
  backend?: ToolResultCacheBackend;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Stores successful tool outputs per stream id with TTL based eviction.
 *
 * @param options - Optional TTL, clock, and storage backend overrides.
 * @returns Cache instance exposing set/get/evict operations.
 */
export class ToolResultCache {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly backend: ToolResultCacheBackend;
  private nextSequence = 0;

  constructor(options: ToolResultCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
    this.backend = options.backend ?? new InMemoryToolResultCacheBackend();
  }

  /**
   * Adds a tool result to the stream-scoped cache.
   *
   * @param streamId - Stream id that owns the result.
   * @param toolName - Tool name from the AI SDK tool result chunk.
   * @param toolCallId - Tool call id from the AI SDK tool result chunk.
   * @param result - Raw tool output.
   * @returns Nothing.
   */
  set(streamId: string, toolName: string, toolCallId: string, result: unknown): void {
    const existing = this.backend.get(streamId).find((entry) => entry.toolCallId === toolCallId);
    if (existing) {
      return;
    }

    this.backend.set({
      streamId,
      toolName,
      toolCallId,
      result,
      receivedAt: this.now(),
      sequence: this.nextSequence,
    });
    this.nextSequence += 1;
  }

  /**
   * Reads non-expired tool results grouped by tool name.
   *
   * @param streamId - Stream id to read from.
   * @returns Grouped results, preserving arrival order inside each group.
   */
  get(streamId: string): ToolResultsByName {
    const cutoff = this.now() - this.ttlMs;
    const freshEntries = this.backend
      .get(streamId)
      .filter((entry) => entry.receivedAt >= cutoff)
      .sort((a, b) => a.sequence - b.sequence);

    if (freshEntries.length === 0) {
      return new Map();
    }

    const grouped: ToolResultsByName = new Map();
    for (const entry of freshEntries) {
      const existing = grouped.get(entry.toolName) ?? [];
      existing.push(entry);
      grouped.set(entry.toolName, existing);
    }
    return grouped;
  }

  /**
   * Removes all cached entries for one stream.
   *
   * @param streamId - Stream id to evict.
   * @returns Nothing.
   */
  evict(streamId: string): void {
    this.backend.evict(streamId);
  }
}

/**
 * In-memory cache backend scoped by stream id.
 *
 * @returns Backend implementation for local/runtime memory storage.
 */
export class InMemoryToolResultCacheBackend implements ToolResultCacheBackend {
  private readonly entries = new Map<string, CachedToolResult[]>();

  set(entry: CachedToolResult): void {
    const existing = this.entries.get(entry.streamId) ?? [];
    this.entries.set(entry.streamId, [...existing, entry]);
  }

  get(streamId: string): CachedToolResult[] {
    return [...(this.entries.get(streamId) ?? [])];
  }

  evict(streamId: string): void {
    this.entries.delete(streamId);
  }
}
