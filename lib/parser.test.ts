import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TextStreamPart, ToolSet } from 'ai';
import { markdownJoinerTransform } from './parser';

type AnyToolSet = Record<string, never>;
type Chunk = TextStreamPart<AnyToolSet>;

async function runTransform(input: Chunk[]): Promise<Chunk[]> {
  const factory = markdownJoinerTransform<AnyToolSet>();
  const transform = factory();

  const out: Chunk[] = [];
  const writable = new WritableStream<Chunk>({
    write(chunk) {
      out.push(chunk);
    },
  });

  const readable = new ReadableStream<Chunk>({
    start(controller) {
      for (const c of input) controller.enqueue(c);
      controller.close();
    },
  });

  await readable.pipeThrough(transform).pipeTo(writable);
  return out;
}

describe('markdownJoinerTransform', () => {
  it('passes through complete markdown links unchanged', async () => {
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'See [Kiwi](https://on.kiwi.com/abc) here.' },
      { type: 'text-end', id: 'text-1' },
    ];
    const out = await runTransform(input);
    const deltaText = out
      .filter((c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta')
      .map((c) => c.text)
      .join('');
    assert.equal(deltaText, 'See [Kiwi](https://on.kiwi.com/abc) here.');
  });

  it('flushes buffered incomplete markdown BEFORE text-end with the active id', async () => {
    // Repro: stream ends mid-link or mid-bold. Buffer must be flushed as a
    // text-delta with the same id, *before* text-end is forwarded, so the
    // downstream UIMessageStream consumer can find the active text part.
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'Pre. [partial-link-without-close' },
      { type: 'text-end', id: 'text-1' },
    ];
    const out = await runTransform(input);

    // text-end must be the LAST chunk
    assert.equal(out[out.length - 1].type, 'text-end');

    // Every text-delta must carry the id (regression: bug emitted id-less chunks)
    const deltas = out.filter(
      (c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta',
    );
    for (const d of deltas) {
      assert.ok(d.id, 'text-delta must have an id');
      assert.equal(d.id, 'text-1');
    }

    // The buffered tail must end up in the concatenated output
    const concat = deltas.map((d) => d.text).join('');
    assert.match(concat, /partial-link-without-close$/);
  });

  it('flushes buffer at stream-end with last seen id when no text-end arrives', async () => {
    // Edge case: stream aborts before text-end. flush() must use the last
    // seen id rather than emitting an id-less chunk.
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'orphan **bold-not-closed' },
      // no text-end
    ];
    const out = await runTransform(input);

    const deltas = out.filter(
      (c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta',
    );
    for (const d of deltas) {
      assert.ok(d.id, 'flush()-emitted text-delta must have an id');
      assert.equal(d.id, 'text-1');
    }
  });

  it('handles multiple distinct text blocks (text-start/end pairs) correctly', async () => {
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'block-1 [partial' },
      { type: 'text-end', id: 'text-1' },
      { type: 'text-start', id: 'text-2' },
      { type: 'text-delta', id: 'text-2', text: 'block-2 done.' },
      { type: 'text-end', id: 'text-2' },
    ];
    const out = await runTransform(input);

    const deltas = out.filter(
      (c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta',
    );
    // Each delta's id must match its block; no id-less chunks
    for (const d of deltas) {
      assert.ok(d.id === 'text-1' || d.id === 'text-2');
    }

    // Block 2 buffer was clean — no leakage of block 1's '[partial' tail
    const block2Text = deltas
      .filter((d) => d.id === 'text-2')
      .map((d) => d.text)
      .join('');
    assert.equal(block2Text, 'block-2 done.');
  });

  it('forwards non-text chunks (tool-call, etc.) unchanged', async () => {
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'before tool ' },
      { type: 'text-end', id: 'text-1' },
      // tool-input-start is a non-text chunk that must pass through unchanged
      { type: 'tool-input-start', id: 'call-1', toolName: 'search_flights', dynamic: false } as any,
    ];
    const out = await runTransform(input);
    const lastChunk = out[out.length - 1];
    assert.equal(lastChunk.type, 'tool-input-start');
  });
});
