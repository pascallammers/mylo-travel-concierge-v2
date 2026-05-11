// lib/chat/__evals__/parts.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { extractTextFromParts } from './parts';

describe('extractTextFromParts', () => {
  it('returns empty string for non-arrays', () => {
    assert.strictEqual(extractTextFromParts(null), '');
    assert.strictEqual(extractTextFromParts(undefined), '');
    assert.strictEqual(extractTextFromParts({ type: 'text', text: 'hi' }), '');
    assert.strictEqual(extractTextFromParts('hi'), '');
  });

  it('extracts a single text part', () => {
    const parts = [{ type: 'text', text: 'Hallo MYLO' }];
    assert.strictEqual(extractTextFromParts(parts), 'Hallo MYLO');
  });

  it('concatenates multiple text parts with newlines', () => {
    // AI SDK 5.x messages can contain multiple text chunks. The previous
    // first-only impl silently dropped context and locked in wrong fixtures.
    const parts = [
      { type: 'text', text: 'Erste Frage:' },
      { type: 'text', text: 'Wie viel kostet ein Flug nach Bangkok?' },
    ];
    assert.strictEqual(
      extractTextFromParts(parts),
      'Erste Frage:\nWie viel kostet ein Flug nach Bangkok?',
    );
  });

  it('skips non-text parts but keeps text parts in order', () => {
    const parts = [
      { type: 'text', text: 'Hi' },
      { type: 'tool-search_flights', input: {} },
      { type: 'text', text: 'noch eine Frage' },
    ];
    assert.strictEqual(extractTextFromParts(parts), 'Hi\nnoch eine Frage');
  });

  it('coerces non-string text values to string', () => {
    const parts = [{ type: 'text', text: 42 }];
    assert.strictEqual(extractTextFromParts(parts), '42');
  });

  it('treats missing text field as empty', () => {
    const parts = [{ type: 'text' }, { type: 'text', text: 'real' }];
    assert.strictEqual(extractTextFromParts(parts), '\nreal'.trimStart());
  });

  it('returns empty string when no text parts present', () => {
    const parts = [{ type: 'tool-web_search', input: {} }];
    assert.strictEqual(extractTextFromParts(parts), '');
  });

  it('ignores malformed entries silently', () => {
    const parts = [null, undefined, 'not-an-object', { type: 'text', text: 'kept' }];
    assert.strictEqual(extractTextFromParts(parts), 'kept');
  });
});
