import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTrackedProductTransactionForProduct } from './kpi-product-filter';

describe('isTrackedProductTransaction', () => {
  const myloIds = ['1', '5'];

  it('keeps the configured MYLO product rows', () => {
    assert.equal(
      isTrackedProductTransactionForProduct({ baseProduct: '5', itemId: '5' }, myloIds),
      true
    );
    assert.equal(
      isTrackedProductTransactionForProduct({ baseProduct: '28', itemId: '5' }, myloIds),
      true
    );
    assert.equal(
      isTrackedProductTransactionForProduct({ baseProduct: '32', itemId: '1' }, myloIds),
      true
    );
  });

  it('excludes other ThriveCart products from business KPIs', () => {
    assert.equal(
      isTrackedProductTransactionForProduct({ baseProduct: '28', itemId: '28' }, myloIds),
      false
    );
    assert.equal(
      isTrackedProductTransactionForProduct({ baseProduct: '6', itemId: '6' }, myloIds),
      false
    );
  });
});
