import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveExaSearchType,
  resolveExaSearchTypeForQuality,
  toExaSdkSearchType,
  type ExaConfigSearchType,
} from './exa-search-type-utils';

describe('resolveExaSearchType', () => {
  it('falls back to instant when no config is set', () => {
    const result = resolveExaSearchType(undefined, 'instant');
    assert.equal(result, 'instant');
  });

  it('uses configured value when provided', () => {
    const result = resolveExaSearchType('fast', 'instant');
    assert.equal(result, 'fast');
  });
});

describe('toExaSdkSearchType', () => {
  it('passes through non-instant types unchanged', () => {
    const value: ExaConfigSearchType = 'hybrid';
    const result = toExaSdkSearchType(value);
    assert.equal(result, 'hybrid');
  });

  it('keeps instant at runtime for API calls', () => {
    const result = toExaSdkSearchType('instant');
    assert.equal(result as unknown as string, 'instant');
  });
});

describe('resolveExaSearchTypeForQuality', () => {
  it('forces hybrid for best quality', () => {
    const result = resolveExaSearchTypeForQuality('best', 'fast');
    assert.equal(result, 'hybrid');
  });

  it('uses configured value for default quality', () => {
    const result = resolveExaSearchTypeForQuality('default', 'auto');
    assert.equal(result, 'auto');
  });

  it('defaults to instant for default quality without config', () => {
    const result = resolveExaSearchTypeForQuality('default', undefined);
    assert.equal(result, 'instant');
  });
});
