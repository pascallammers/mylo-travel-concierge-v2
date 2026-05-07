import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isProductPurchase,
  normalizeThriveCartPayload,
} from './payload-normalizer';

const MYLO_PRODUCT_ID = 5;

// Fixture captured from production thrivecart_webhook_log id=6lZnZloS952rutDi.
// This is the real payload shape that produced the orphan-account bug.
const REAL_MYLO_PAYLOAD_FROM_DB: Record<string, unknown> = {
  event: 'order.success',
  mode: 'live',
  thrivecart_account: 'never-economy-again',
  thrivecart_secret: 'secret',
  base_product: '5', // arrives as STRING
  base_product_name: 'MYLO Miles and Travel Concierge',
  order_id: '41427460',
  invoice_id: '000004781',
  currency: 'EUR',
  customer_id: '429583657948047782',
  customer: {
    email: 'marcel.pernak@gmail.com',
    firstname: 'Marcel',
    lastname: 'Pernak',
    name: 'Marcel Pernak',
  },
  order: {
    id: '41427460',
    invoice_id: '000004781',
    total: '4700',
    charges: [
      {
        name: 'MYLO Miles and Travel Concierge',
        reference: '5',
        item_type: 'product',
        amount: '4700',
        amount_str: '47.00',
      },
    ],
  },
  purchases: ['MYLO Miles and Travel Concierge'], // STRING array, not object array
  event_id: '1525404990',
};

const FORM_ENCODED_PAYLOAD: Record<string, unknown> = {
  event: 'order.success',
  mode: 'live',
  base_product: '5',
  order_id: '41427460',
  customer_id: '429583657948047782',
  // form-encoded webhooks send nested objects as JSON strings
  customer: JSON.stringify({ email: 'foo@bar.de', name: 'Foo' }),
  order: JSON.stringify({ total: '4700', charges: [{ reference: '5', amount: '4700', name: 'MYLO' }] }),
  purchases: JSON.stringify(['MYLO']),
};

const NEA_VIP_PAYLOAD: Record<string, unknown> = {
  event: 'order.success',
  base_product: '10',
  base_product_name: 'NEA VIP',
  order_id: '41427325',
  purchases: ['Never Economy Again - USA'],
  order: { total: '24700', charges: [{ reference: '10', amount: '24700', name: 'NEA VIP' }] },
};

describe('normalizeThriveCartPayload', () => {
  it('coerces string-typed numeric IDs to numbers', () => {
    const result = normalizeThriveCartPayload(REAL_MYLO_PAYLOAD_FROM_DB);

    assert.equal(typeof result.base_product, 'number');
    assert.equal(result.base_product, 5);
    assert.equal(typeof result.order_id, 'number');
    assert.equal(result.order_id, 41427460);
    assert.equal(typeof result.event_id, 'number');
  });

  it('reconstructs purchases as objects when ThriveCart sends string array', () => {
    const result = normalizeThriveCartPayload(REAL_MYLO_PAYLOAD_FROM_DB);

    assert.equal(Array.isArray(result.purchases), true);
    assert.equal(result.purchases.length, 1);
    const first = result.purchases[0];
    assert.equal(typeof first, 'object');
    assert.equal(first.product_id, 5);
    assert.equal(first.product_name, 'MYLO Miles and Travel Concierge');
    assert.equal(first.amount, 4700);
  });

  it('parses JSON-encoded nested fields from form-encoded payloads', () => {
    const result = normalizeThriveCartPayload(FORM_ENCODED_PAYLOAD);

    assert.equal(typeof result.customer, 'object');
    assert.equal(result.customer.email, 'foo@bar.de');
    assert.equal(typeof result.order, 'object');
    assert.equal(Array.isArray(result.purchases), true);
    assert.equal(result.purchases[0]?.product_id, 5);
  });

  it('preserves already-correct payloads (idempotency)', () => {
    const once = normalizeThriveCartPayload(REAL_MYLO_PAYLOAD_FROM_DB);
    const twice = normalizeThriveCartPayload(once as unknown as Record<string, unknown>);

    assert.deepEqual(twice, once);
  });

  it('falls back to base_product when no charges and no objects in purchases', () => {
    const minimal = {
      event: 'order.success',
      base_product: '5',
      base_product_name: 'MYLO',
      purchases: [],
      order: {},
    };

    const result = normalizeThriveCartPayload(minimal);
    assert.equal(result.purchases.length, 1);
    assert.equal(result.purchases[0]?.product_id, 5);
    assert.equal(result.purchases[0]?.product_name, 'MYLO');
  });

  it('handles missing optional fields without throwing', () => {
    assert.doesNotThrow(() =>
      normalizeThriveCartPayload({ event: 'order.success' })
    );
  });

  it('leaves invalid JSON strings untouched instead of throwing', () => {
    const broken = { event: 'order.success', customer: 'not-valid-json{' };
    const result = normalizeThriveCartPayload(broken);
    assert.equal(typeof result.customer, 'string');
  });
});

describe('isProductPurchase', () => {
  it('matches MYLO via base_product when purchases array is degenerate', () => {
    const normalized = normalizeThriveCartPayload(REAL_MYLO_PAYLOAD_FROM_DB);
    assert.equal(isProductPurchase(normalized, MYLO_PRODUCT_ID), true);
  });

  it('matches MYLO via purchases[].product_id', () => {
    const payload = {
      event: 'order.success',
      base_product: '99',
      purchases: [{ product_id: 5, product_name: 'MYLO', amount: 4700 }],
      order: {},
    };
    const normalized = normalizeThriveCartPayload(payload);
    assert.equal(isProductPurchase(normalized, MYLO_PRODUCT_ID), true);
  });

  it('rejects NEA VIP and other non-MYLO products', () => {
    const normalized = normalizeThriveCartPayload(NEA_VIP_PAYLOAD);
    assert.equal(isProductPurchase(normalized, MYLO_PRODUCT_ID), false);
  });

  it('rejects when both base_product and purchases miss the target', () => {
    const payload = {
      event: 'order.success',
      base_product: '4',
      purchases: [{ product_id: 7 }],
      order: {},
    };
    const normalized = normalizeThriveCartPayload(payload);
    assert.equal(isProductPurchase(normalized, MYLO_PRODUCT_ID), false);
  });

  it('handles empty / missing fields without throwing', () => {
    const normalized = normalizeThriveCartPayload({ event: 'order.success' });
    assert.equal(isProductPurchase(normalized, MYLO_PRODUCT_ID), false);
  });
});
