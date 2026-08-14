import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveNextOutput } from './next-output';

describe('resolveNextOutput', () => {
  it('keeps standalone for Docker and local builds', () => {
    assert.equal(resolveNextOutput({}), 'standalone');
  });

  it('disables standalone on Vercel so the adapter build can finish', () => {
    assert.equal(resolveNextOutput({ VERCEL: '1' }), undefined);
  });
});
