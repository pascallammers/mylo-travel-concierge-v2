import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTrackedProductTransactionForProduct } from './kpi-product-filter';

describe('isTrackedProductTransaction', () => {
  it('keeps the configured MYLO product rows', () => {
    assert.equal(isTrackedProductTransactionForProduct({ baseProduct: '5', itemId: '5' }, '5'), true);
    assert.equal(isTrackedProductTransactionForProduct({ baseProduct: '28', itemId: '5' }, '5'), true);
  });

  it('excludes other ThriveCart products from business KPIs', () => {
    assert.equal(isTrackedProductTransactionForProduct({ baseProduct: '28', itemId: '28' }, '5'), false);
    assert.equal(isTrackedProductTransactionForProduct({ baseProduct: '6', itemId: '6' }, '5'), false);
  });
});
