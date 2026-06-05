/**
 * Backfill ThriveCart order.success data for an existing user (subscription, payment, KPI row).
 *
 * Usage:
 *   npx tsx scripts/backfill-thrivecart-user.ts --email=kontakt@janclassen.de --order=41645670
 *   npx tsx scripts/backfill-thrivecart-user.ts --email=kontakt@janclassen.de --order=41645670 --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { backfillOrderSuccessForExistingUser } from '../lib/thrivecart/webhook-handler';
import {
  isProductPurchase,
  normalizeThriveCartPayload,
} from '../lib/thrivecart/payload-normalizer';
import { parseMyloProductIds } from '../lib/thrivecart/mylo-product-ids';
import type { ThriveCartWebhookPayload } from '../lib/thrivecart/types';

const sql = neon(process.env.DATABASE_URL!);
const MYLO_PRODUCT_IDS = parseMyloProductIds();

const isDryRun = process.argv.includes('--dry-run');
const emailArg = process.argv.find((a) => a.startsWith('--email='));
const orderArg = process.argv.find((a) => a.startsWith('--order='));

const email = emailArg?.slice('--email='.length).toLowerCase().trim();
const orderId = orderArg?.slice('--order='.length).trim();

async function main(): Promise<void> {
  if (!email || !orderId) {
    console.error('Usage: --email=foo@bar.com --order=THRIVECART_ORDER_ID [--dry-run]');
    process.exit(1);
  }

  const rows = await sql`
    SELECT id, order_id, payload, action, processed_at
    FROM thrivecart_webhook_log
    WHERE lower(customer_email) = lower(${email})
      AND event_type = 'order.success'
      AND order_id = ${orderId}
    ORDER BY processed_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.error(`No order.success webhook log for ${email} order ${orderId}`);
    process.exit(1);
  }

  const row = rows[0];
  const normalized = normalizeThriveCartPayload(
    row.payload as Record<string, unknown>
  ) as ThriveCartWebhookPayload;

  if (!isProductPurchase(normalized, MYLO_PRODUCT_IDS)) {
    console.error('Webhook payload is not a MYLO purchase after normalization');
    process.exit(1);
  }

  console.log(`[backfill] email=${email} order=${orderId} prior_action=${row.action}`);

  if (isDryRun) {
    console.log('[backfill] dry-run — would call backfillOrderSuccessForExistingUser');
    return;
  }

  const result = await backfillOrderSuccessForExistingUser(normalized, email);
  console.log('[backfill] result:', result);

  if (result.success) {
    await sql`
      UPDATE thrivecart_webhook_log
      SET action = ${`recovered:${result.action}`}
      WHERE id = ${row.id}
    `;
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
