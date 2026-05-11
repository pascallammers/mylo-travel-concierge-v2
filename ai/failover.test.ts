import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getStreamPolicy } from './failover';

describe('getStreamPolicy', () => {
  it('returns Claude Opus as fallback for chat profile', () => {
    const policy = getStreamPolicy('chat');
    assert.deepEqual(policy?.models, ['anthropic/claude-opus-4.6']);
  });

  it('returns undefined for title profile (no fallback wanted)', () => {
    assert.equal(getStreamPolicy('title'), undefined);
  });

  it('returns undefined for translate profile', () => {
    assert.equal(getStreamPolicy('translate'), undefined);
  });

  it('returns undefined for resolver profile', () => {
    assert.equal(getStreamPolicy('resolver'), undefined);
  });

  it('defaults to chat profile when called without an argument', () => {
    assert.equal(getStreamPolicy(), getStreamPolicy('chat'));
  });

  it('returns the same reference for repeated calls with the same profile', () => {
    assert.strictEqual(getStreamPolicy('chat'), getStreamPolicy('chat'));
    assert.strictEqual(getStreamPolicy('title'), getStreamPolicy('title'));
  });

  it('returns a frozen policy that cannot be mutated', () => {
    const policy = getStreamPolicy('chat');
    assert.ok(policy);
    assert.throws(() => {
      (policy.models as string[]).push('rogue/model');
    }, TypeError);
  });
});
