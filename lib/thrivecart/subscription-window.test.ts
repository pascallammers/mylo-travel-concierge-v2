import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCalendarMonths,
  computeSubscriptionWindowFromWebhookHistory,
  deriveSubscriptionWindowFromPayload,
  parseThriveCartOrderDate,
} from './subscription-window';
import type { ThriveCartWebhookPayload } from './types';

const MYLO_IDS = [1, 5] as const;

describe('parseThriveCartOrderDate', () => {
  it('parses ThriveCart datetime strings', () => {
    const d = parseThriveCartOrderDate('2026-04-04 05:16:42');
    assert.ok(d);
    assert.equal(d?.getUTCFullYear(), 2026);
    assert.equal(d?.getUTCMonth(), 3);
    assert.equal(d?.getUTCDate(), 4);
  });
});

describe('deriveSubscriptionWindowFromPayload', () => {
  it('uses order date as start and +1 month as end', () => {
    const payload = {
      event: 'order.success',
      order_id: '123',
      base_product: 32,
      order: { date: '2026-04-04 05:16:42', total: 4700 },
      purchases: [{ product_id: 1, product_name: 'MYLO', amount: 4700, type: 'upsell' }],
    } as unknown as ThriveCartWebhookPayload;

    const window = deriveSubscriptionWindowFromPayload(payload, MYLO_IDS);
    assert.equal(window.checkoutOrderId, '123');
    assert.equal(window.periodStart.toISOString().slice(0, 10), '2026-04-04');
    assert.equal(window.periodEnd.toISOString().slice(0, 10), '2026-05-04');
  });
});

describe('computeSubscriptionWindowFromWebhookHistory', () => {
  it('extends period end on subscription_payment rebills', () => {
    const rows = [
      {
        event_type: 'order.success',
        order_id: '40927543',
        processed_at: new Date('2026-04-04T03:16:51.423Z'),
        payload: {
          event: 'order.success',
          order_id: '40927543',
          base_product: 5,
          order: { date: '2026-04-04 05:16:42' },
          purchases: [{ product_id: 5, product_name: 'MYLO', amount: 4700 }],
        },
      },
      {
        event_type: 'order.subscription_payment',
        order_id: '40927543',
        processed_at: new Date('2026-05-04T04:17:53.606Z'),
        payload: {
          event: 'order.subscription_payment',
          order_id: '40927543',
          base_product: 5,
          order: { date: '2026-05-04 04:17:50' },
          purchases: [{ product_id: 5, product_name: 'MYLO', amount: 4700 }],
        },
      },
    ];

    const window = computeSubscriptionWindowFromWebhookHistory(rows, MYLO_IDS);
    assert.ok(window);
    assert.equal(window?.rebillCount, 1);
    assert.equal(window?.periodEnd.toISOString().slice(0, 10), '2026-06-04');
  });
});

describe('addCalendarMonths', () => {
  it('adds one month', () => {
    const start = new Date('2026-01-15T12:00:00.000Z');
    const end = addCalendarMonths(start, 1);
    assert.equal(end.getUTCMonth(), 1);
  });
});
