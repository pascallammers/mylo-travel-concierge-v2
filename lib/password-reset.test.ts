import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildResetPasswordUrl, normalizeBaseUrl, resolveBaseUrl } from './password-reset';

describe('normalizeBaseUrl', () => {
  it('adds https when protocol is missing', () => {
    const result = normalizeBaseUrl('mylo-travel-concierge-v2.vercel.app');
    assert.equal(result, 'https://mylo-travel-concierge-v2.vercel.app');
  });

  it('trims trailing slashes', () => {
    const result = normalizeBaseUrl('https://example.com///');
    assert.equal(result, 'https://example.com');
  });

  it('leaves valid URL untouched', () => {
    const result = normalizeBaseUrl('http://localhost:3000');
    assert.equal(result, 'http://localhost:3000');
  });
});

describe('buildResetPasswordUrl', () => {
  it('builds confirm URL with token and email', () => {
    const result = buildResetPasswordUrl({
      baseUrl: 'https://example.com/',
      token: 'abc123',
      email: 'user@example.com',
    });

    assert.equal(result, 'https://example.com/reset-password/confirm?token=abc123&email=user%40example.com');
  });

  it('uses normalized base URL and encodes token', () => {
    const result = buildResetPasswordUrl({
      baseUrl: 'example.com',
      token: 't@k#n',
    });

    assert.equal(result, 'https://example.com/reset-password/confirm?token=t%40k%23n');
  });
});

describe('resolveBaseUrl', () => {
  it('falls back to default when value is empty', () => {
    const result = resolveBaseUrl('');
    assert.ok(result.length > 0);
  });
});
