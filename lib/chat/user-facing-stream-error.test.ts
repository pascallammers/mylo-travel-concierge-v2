import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  sanitizeUserFacingStreamError,
  shouldHideRawStreamErrorDetails,
} from './user-facing-stream-error';

describe('sanitizeUserFacingStreamError', () => {
  it('maps Vercel free-tier gateway errors to a generic infrastructure message', () => {
    const raw =
      'Free tier users do not have access to this model. Upgrade to paid credits at https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up';

    assert.equal(
      sanitizeUserFacingStreamError(raw),
      'Our AI service is temporarily unavailable. Please try again in a moment.',
    );
    assert.equal(shouldHideRawStreamErrorDetails(raw), true);
  });

  it('maps technical validation errors to a generic message', () => {
    const raw = 'Type validation failed: Value: {"code":"The service is currently unavailable"}';

    assert.equal(
      sanitizeUserFacingStreamError(raw),
      'Something went wrong while processing your message. Please try again.',
    );
  });

  it('passes through short, non-technical messages unchanged', () => {
    const raw = 'Oops, you have reached the rate limit! Please try again later.';

    assert.equal(sanitizeUserFacingStreamError(raw), raw);
    assert.equal(shouldHideRawStreamErrorDetails(raw), false);
  });
});
