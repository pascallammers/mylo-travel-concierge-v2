import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMyloProductId, parseMyloProductIds } from './mylo-product-ids';

describe('parseMyloProductIds', () => {
  it('includes standalone (5) and upsell (1) by default', () => {
    const ids = parseMyloProductIds();
    assert.ok(ids.includes(1));
    assert.ok(ids.includes(5));
  });
});

describe('isMyloProductId', () => {
  it('matches configured ids', () => {
    assert.equal(isMyloProductId(1, [1, 5]), true);
    assert.equal(isMyloProductId(5, [1, 5]), true);
    assert.equal(isMyloProductId(32, [1, 5]), false);
  });
});
