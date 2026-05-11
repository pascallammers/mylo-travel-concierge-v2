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
    // Use a precisely-typed literal extracted from TextStreamPart's discriminated
    // union instead of `as any`. Project rule: never use `any`.
    const toolInputStart: Extract<Chunk, { type: 'tool-input-start' }> = {
      type: 'tool-input-start',
      id: 'call-1',
      toolName: 'search_flights',
      dynamic: false,
    };
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'before tool ' },
      { type: 'text-end', id: 'text-1' },
      // tool-input-start is a non-text chunk that must pass through unchanged
      toolInputStart,
    ];
    const out = await runTransform(input);
    const lastChunk = out[out.length - 1];
    assert.equal(lastChunk.type, 'tool-input-start');
  });

  it('text-start without any text-delta then text-end forwards unchanged', async () => {
    // Edge case: empty text block. Buffer is empty so no extra chunks should
    // be emitted; the start/end pair just passes through.
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-end', id: 'text-1' },
    ];
    const out = await runTransform(input);

    assert.equal(out.length, 2, 'no extra chunks should be synthesised');
    assert.equal(out[0].type, 'text-start');
    assert.equal(out[1].type, 'text-end');
    // No text-delta chunks should be present at all
    const deltas = out.filter((c) => c.type === 'text-delta');
    assert.equal(deltas.length, 0);
  });

  it('forwards a late text-delta that arrives AFTER text-end with same id', async () => {
    // Malformed-stream defence: a text-delta arriving after its text-end is
    // an upstream protocol violation. Our transform should NOT be the layer
    // that swallows or rewrites it — it must forward verbatim. The
    // downstream UI consumer can decide how to handle the protocol break.
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'hello' },
      { type: 'text-end', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: ' world' },
    ];
    const out = await runTransform(input);

    const deltas = out.filter(
      (c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta',
    );
    // The late delta must still appear in the output.
    const concat = deltas.map((d) => d.text).join('');
    assert.equal(concat, 'hello world');
    // And it must still carry the id (we never strip ids).
    for (const d of deltas) {
      assert.equal(d.id, 'text-1');
    }
  });

  it('flushes buffered content via flushBufferAs when stream aborts mid-buffer between non-text chunks', async () => {
    // Repro: text-delta starts buffering '[partial' (an incomplete link),
    // then a non-text tool chunk arrives, then the stream closes WITHOUT a
    // text-end. flush() must fire and emit the buffered tail as a text-delta
    // with the lastTextId observed from the original text-delta.
    const toolInputStart: Extract<Chunk, { type: 'tool-input-start' }> = {
      type: 'tool-input-start',
      id: 'call-9',
      toolName: 'search_flights',
      dynamic: false,
    };
    const input: Chunk[] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: '[partial' },
      toolInputStart,
      // no text-end, stream just closes
    ];
    const out = await runTransform(input);

    // tool-input-start must still pass through.
    const tools = out.filter((c) => c.type === 'tool-input-start');
    assert.equal(tools.length, 1);

    // The buffered '[partial' must be flushed as a text-delta carrying
    // the lastTextId ('text-1') — never id-less.
    const deltas = out.filter(
      (c): c is Extract<Chunk, { type: 'text-delta' }> => c.type === 'text-delta',
    );
    assert.ok(deltas.length >= 1, 'buffered tail must be flushed');
    const concat = deltas.map((d) => d.text).join('');
    assert.match(concat, /\[partial$/);
    for (const d of deltas) {
      assert.equal(d.id, 'text-1');
    }
  });

  it('warns when flushBufferAs has buffered content but no active text-id', async () => {
    // Defensive telemetry: if upstream feeds a text-delta with no id (a
    // protocol violation we cannot satisfy), the buffer can fill but
    // lastTextId stays undefined. flush() must surface a single console.warn
    // so the silent drop is observable in production logs — and stay silent
    // on the no-op happy path.
    const originalWarn = console.warn;
    const warnings: Array<{ msg: unknown; meta: unknown }> = [];
    console.warn = (msg: unknown, meta?: unknown) => {
      warnings.push({ msg, meta });
    };

    try {
      // Cast through unknown to forge an id-less text-delta. This is the
      // exact malformed shape we want to defend against — never use `any`.
      const idlessDelta = {
        type: 'text-delta',
        text: '[buffered-no-id',
      } as unknown as Chunk;
      const input: Chunk[] = [idlessDelta];
      await runTransform(input);

      assert.equal(warnings.length, 1, 'expected exactly one console.warn call');
      assert.match(
        String(warnings[0].msg),
        /markdownJoinerTransform.*dropping.*buffer.*stream-end/,
      );
      const meta = warnings[0].meta as { chars: number; sample: string };
      assert.equal(meta.chars, '[buffered-no-id'.length);
      assert.equal(meta.sample, '[buffered-no-id');

      // Happy path sanity: a clean stream must NOT trigger the warn.
      warnings.length = 0;
      await runTransform([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: 'plain text.' },
        { type: 'text-end', id: 'text-1' },
      ]);
      assert.equal(warnings.length, 0, 'happy path must stay silent');
    } finally {
      console.warn = originalWarn;
    }
  });
});
