/**
 * One-off customer lookup: user, subscription, payments, ThriveCart webhooks.
 * Usage: npx tsx --env-file=.env.local scripts/lookup-customer-status.ts email@example.com
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import {
  findMyloPurchase,
  isProductPurchase,
  normalizeThriveCartPayload,
} from '../lib/thrivecart/payload-normalizer';

const MYLO_IDS = [1, 5];
const email = process.argv[2]?.toLowerCase().trim();

if (!email) {
  console.error('Usage: lookup-customer-status.ts <email>');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

async function main(): Promise<void> {
  const users = await sql`
    SELECT id, email, name, is_active, activation_status, email_verified, created_at, updated_at, role
    FROM "user"
    WHERE lower(email) = lower(${email})
  `;

  const userId = users[0]?.id as string | undefined;

  const webhooks = await sql`
    SELECT id, event_type, order_id, action, result, error_message, processed_at, payload
    FROM thrivecart_webhook_log
    WHERE lower(customer_email) = lower(${email})
    ORDER BY processed_at ASC
  `;

  const payments = userId
    ? await sql`
        SELECT id, total_amount, currency, status, thrivecard_payment_id, thrivecard_customer_id,
          payment_provider, sync_source, webhook_source, created_at, metadata
        FROM payment
        WHERE user_id = ${userId}
        ORDER BY created_at
      `
    : [];

  const subs = userId
    ? await sql`
        SELECT id, status, amount, currency, "checkoutId", "productId", plan_name, plan_type,
          "currentPeriodStart", "currentPeriodEnd", "startedAt", "cancelAtPeriodEnd",
          thrivecard_customer_id, thrivecard_subscription_id, last_payment_date, next_payment_date,
          "createdAt", metadata
        FROM subscription
        WHERE "userId" = ${userId}
      `
    : [];

  const accounts = userId
    ? await sql`
        SELECT id, provider_id, account_id, created_at
        FROM account
        WHERE user_id = ${userId}
      `
    : [];

  const txs = await sql`
    SELECT event_id, transaction_type, amount, currency, order_id, transaction_date, item_id,
      customer_name, processor
    FROM thrivecart_transaction
    WHERE lower(customer_email) = lower(${email})
    ORDER BY transaction_date
  `;

  const adminLogs = userId
    ? await sql`
        SELECT action, details, created_at, performed_by
        FROM admin_activity_log
        WHERE target_user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `
    : [];

  const webhookSummary = webhooks.map((w) => {
    const p = normalizeThriveCartPayload(w.payload as Record<string, unknown>);
    const mylo = isProductPurchase(p, MYLO_IDS);
    const purchase = findMyloPurchase(p, MYLO_IDS);
    return {
      event_type: w.event_type,
      order_id: w.order_id,
      action: w.action,
      result: w.result,
      error_message: w.error_message,
      processed_at: w.processed_at,
      isMylo: mylo,
      orderDate: p.order?.date ?? null,
      base_product: p.base_product ?? null,
      myloProduct: purchase
        ? {
            product_id: purchase.product_id,
            product_name: purchase.product_name,
            amount_cents: purchase.amount,
            type: purchase.type,
            subscription_id: purchase.subscription?.id ?? null,
          }
        : null,
      order_total_cents: p.order?.total ?? null,
      currency: p.currency ?? null,
      customer_name: p.customer?.name ?? null,
    };
  });

  const report = {
    email,
    user: users[0] ?? null,
    accounts,
    subscriptions: subs,
    payments,
    thrivecart_webhooks: webhookSummary,
    thrivecart_transactions: txs,
    admin_activity: adminLogs,
    interpretation: {
      manuallyCreated:
        subs.length > 0 &&
        (String(subs[0].checkoutId ?? '').startsWith('admin_created') ||
          subs[0].productId === 'manual_access'),
      hasThriveCartWebhooks: webhooks.length > 0,
      hasThriveCartPayments: payments.some(
        (p) => p.payment_provider === 'thrivecart' || p.thrivecard_payment_id
      ),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
