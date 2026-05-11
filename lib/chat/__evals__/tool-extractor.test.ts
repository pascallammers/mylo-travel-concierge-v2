import assert from 'node:assert';
import { describe, it } from 'node:test';
import { extractFirstToolCall } from './tool-extractor';

describe('extractFirstToolCall', () => {
  it('returns the first tool name when one tool was called', () => {
    const result = { toolCalls: [{ toolName: 'search_flights' }] };
    assert.strictEqual(extractFirstToolCall(result), 'search_flights');
  });

  it('returns null when toolCalls is empty', () => {
    assert.strictEqual(extractFirstToolCall({ toolCalls: [] }), null);
  });

  it('returns null when toolCalls is undefined', () => {
    assert.strictEqual(extractFirstToolCall({}), null);
  });

  it('returns the FIRST tool when multiple are called', () => {
    const result = {
      toolCalls: [{ toolName: 'knowledge_base' }, { toolName: 'web_search' }],
    };
    assert.strictEqual(extractFirstToolCall(result), 'knowledge_base');
  });
});
