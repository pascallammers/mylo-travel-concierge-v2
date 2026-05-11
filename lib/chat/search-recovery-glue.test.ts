import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InferUIMessageChunk, UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import {
  cacheSearchStepToolResults,
  cacheSearchToolResultChunk,
  createRecoveryUiChunks,
  handleSearchStreamCompletion,
} from './search-recovery-glue';
import { ToolResultCache } from './tool-result-cache';

type RecoveryUiChunk = InferUIMessageChunk<ChatMessage>;

describe('search recovery glue', () => {
  it('caches completed tool-result chunks for the route onChunk path', () => {
    const cache = new ToolResultCache();

    const cached = cacheSearchToolResultChunk(cache, 'stream-1', {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'search_flights',
      input: {},
      output: 'cached output',
      dynamic: true,
    });

    assert.equal(cached, true);
    assert.equal(cache.get('stream-1').get('search_flights')?.[0]?.result, 'cached output');
  });

  it('does not cache preliminary tool-result chunks', () => {
    const cache = new ToolResultCache();

    const cached = cacheSearchToolResultChunk(cache, 'stream-1', {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'search_flights',
      input: {},
      output: 'preliminary output',
      dynamic: true,
      preliminary: true,
    });

    assert.equal(cached, false);
    assert.equal(cache.get('stream-1').size, 0);
  });

  it('caches step tool results for synthesis failures after onStepFinish', () => {
    const cache = new ToolResultCache();

    const cachedCount = cacheSearchStepToolResults(cache, 'stream-1', [
      {
        toolCallId: 'call-1',
        toolName: 'datetime',
        output: { iso: '2026-05-08T20:18:18.285Z' },
      },
    ]);

    assert.equal(cachedCount, 1);
    assert.deepEqual(cache.get('stream-1').get('datetime')?.[0]?.result, {
      iso: '2026-05-08T20:18:18.285Z',
    });
  });

  it('skips incomplete step tool results', () => {
    const cache = new ToolResultCache();

    const cachedCount = cacheSearchStepToolResults(cache, 'stream-1', [
      { toolName: 'datetime', output: 'missing id' },
      { toolCallId: 'call-1', output: 'missing name' },
    ]);

    assert.equal(cachedCount, 0);
    assert.equal(cache.get('stream-1').size, 0);
  });

  it('resolves step result tool names from matching tool calls', () => {
    const cache = new ToolResultCache();

    const cachedCount = cacheSearchStepToolResults(
      cache,
      'stream-1',
      [{ toolCallId: 'call-1', output: 'from result' }],
      [{ toolCallId: 'call-1', toolName: 'datetime' }],
    );

    assert.equal(cachedCount, 1);
    assert.equal(cache.get('stream-1').get('datetime')?.[0]?.result, 'from result');
  });

  it('writes recovery output, records recovery usage, and evicts cache on error', async () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', 'cached markdown');
    const writer = new MockWriter();
    let recoveryRecorded = false;

    const used = await handleSearchStreamCompletion({
      cache,
      streamId: 'stream-1',
      finishReason: 'error',
      locale: 'en',
      writer,
      textId: 'recovery-test',
      recordRecoveryUsed: () => {
        recoveryRecorded = true;
      },
    });

    assert.equal(used, true);
    assert.equal(recoveryRecorded, true);
    assert.equal(cache.get('stream-1').size, 0);
    assert.match(writer.text(), /cached markdown/);
  });

  it('evicts cache without writing output on normal finish', async () => {
    const cache = new ToolResultCache();
    cache.set('stream-1', 'search_flights', 'call-1', 'cached markdown');
    const writer = new MockWriter();

    const used = await handleSearchStreamCompletion({
      cache,
      streamId: 'stream-1',
      finishReason: 'stop',
      locale: 'en',
      writer,
    });

    assert.equal(used, false);
    assert.equal(cache.get('stream-1').size, 0);
    assert.equal(writer.chunks.length, 0);
  });

  it('runs recovery markdown through markdownJoinerTransform before writing chunks', async () => {
    const chunks = await createRecoveryUiChunks('Open [partial-link', 'recovery-test');

    assert.deepEqual(chunks.map((chunk) => chunk.type), [
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
    ]);
    assert.equal(chunks.every((chunk) => !('id' in chunk) || chunk.id === 'recovery-test'), true);
  });
});

class MockWriter implements UIMessageStreamWriter<ChatMessage> {
  readonly chunks: RecoveryUiChunk[] = [];
  readonly onError = undefined;

  write(part: RecoveryUiChunk): void {
    this.chunks.push(part);
  }

  merge(stream: ReadableStream<RecoveryUiChunk>): void {
    void stream;
  }

  text(): string {
    return this.chunks
      .filter((chunk): chunk is Extract<RecoveryUiChunk, { type: 'text-delta' }> =>
        chunk.type === 'text-delta',
      )
      .map((chunk) => chunk.delta)
      .join('');
  }
}
