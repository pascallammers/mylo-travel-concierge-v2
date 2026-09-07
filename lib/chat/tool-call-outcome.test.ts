import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { McpToolFailure } from '@/lib/mcp/http-mcp-tool';
import { classifyToolCallOutcome } from './tool-call-outcome';

describe('classifyToolCallOutcome', () => {
  it('classifies McpToolFailure with its short reason instead of markdown', () => {
    const failure = new McpToolFailure(
      'Kiwi.com',
      'ECONNRESET',
      '## Kiwi.com search unavailable\n\nPlease try again.',
    );

    const outcome = classifyToolCallOutcome('call-1', [
      { type: 'tool-error', toolCallId: 'call-1', error: failure },
    ]);

    assert.deepEqual(outcome, { status: 'failed', error: 'ECONNRESET' });
  });

  it('classifies a plain Error with its message', () => {
    const outcome = classifyToolCallOutcome('call-1', [
      { type: 'tool-error', toolCallId: 'call-1', error: new Error('plain failure') },
    ]);

    assert.deepEqual(outcome, { status: 'failed', error: 'plain failure' });
  });

  it('strips hosts and auth tokens from a generic error before it is persisted', () => {
    const outcome = classifyToolCallOutcome('call-1', [
      {
        type: 'tool-error',
        toolCallId: 'call-1',
        error: new Error('fetch https://api.example.com/v1?key=abc failed: Bearer secret.token'),
      },
    ]);

    assert.equal(outcome.status, 'failed');
    assert.ok(outcome.status === 'failed');
    assert.doesNotMatch(outcome.error, /https?:\/\/|example\.com|secret\.token/);
    assert.match(outcome.error, /^fetch <url> failed: <auth>$/);
  });

  it('classifies a matching tool result as succeeded', () => {
    const output = { flights: 2 };
    const outcome = classifyToolCallOutcome('call-1', [
      { type: 'tool-result', toolCallId: 'other', output: 'ignored' },
      { type: 'tool-result', toolCallId: 'call-1', output },
    ]);

    assert.deepEqual(outcome, { status: 'succeeded', response: output });
  });

  it('classifies missing content as failed with the existing fallback wording', () => {
    const outcome = classifyToolCallOutcome('call-1', []);

    assert.deepEqual(outcome, { status: 'failed', error: 'no tool result returned' });
  });
});
