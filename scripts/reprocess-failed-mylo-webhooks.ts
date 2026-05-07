/**
 * Reprocess MYLO webhook events that succeeded technically but didn't create a user.
 *
 * Background: An older version of the webhook handler compared `payload.base_product`
 * (string-typed) to `myloProductId` (number) with strict equality, which always failed.
 * Affected webhooks logged result='success', action=NULL, but no user/subscription/payment
 * was created. This script finds those entries and re-runs them through the now-normalized
 * processWebhookEvent.
 *
 * Idempotent: skips entries that already have a user + subscription + payment.
 *
 * By default, only entries WITHOUT a user account are processed (the true orphans).
 * Pass --include-partial to also reprocess entries where a user exists but the
 * webhook never recorded a subscription/payment — caution: re-running may create
 * duplicate subscriptions for users who already have access via another path.
 *
 * Usage:
 *   npx tsx scripts/reprocess-failed-mylo-webhooks.ts --dry-run            # Preview
 *   npx tsx scripts/reprocess-failed-mylo-webhooks.ts                      # Live (orphans only)
 *   npx tsx scripts/reprocess-failed-mylo-webhooks.ts --only=foo@bar       # Single email
 *   npx tsx scripts/reprocess-failed-mylo-webhooks.ts --include-partial    # Also partials
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { handleOrderSuccess } from '../lib/thrivecart/webhook-handler';
import {
  isProductPurchase,
  normalizeThriveCartPayload,
} from '../lib/thrivecart/payload-normalizer';
import type { ThriveCartWebhookPayload } from '../lib/thrivecart/types';

const DATABASE_URL = process.env.DATABASE_URL!;
const MYLO_PRODUCT_ID = Number(process.env.THRIVECART_PRODUCT_ID || '5');

const isDryRun = process.argv.includes('--dry-run');
const includePartial = process.argv.includes('--include-partial');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyEmail = onlyArg ? onlyArg.slice('--only='.length).toLowerCase() : null;

const sql = neon(DATABASE_URL);

interface OrphanCandidate {
  log_id: string;
  customer_email: string;
  processed_at: Date;
  invoice_id: string | null;
  payload: Record<string, unknown>;
  has_user: boolean;
  has_subscription: boolean;
  has_payment: boolean;
}

async function findOrphanedMyloWebhooks(): Promise<OrphanCandidate[]> {
  const rows = await sql`
    SELECT
      w.id AS log_id,
      w.customer_email,
      w.processed_at,
      w.payload->>'invoice_id' AS invoice_id,
      w.payload AS payload,
      (u.id IS NOT NULL) AS has_user,
      EXISTS(
        SELECT 1 FROM subscription s
        WHERE s."userId" = u.id
          AND (s."checkoutId" = w.payload->>'order_id' OR s."checkoutId" = w.order_id)
      ) AS has_subscription,
      EXISTS(
        SELECT 1 FROM payment p
        WHERE p.user_id = u.id
          AND p.thrivecard_payment_id IN (w.payload->>'order_id', w.order_id)
      ) AS has_payment
    FROM thrivecart_webhook_log w
    LEFT JOIN "user" u ON LOWER(u.email) = LOWER(w.customer_email)
    WHERE w.event_type = 'order.success'
      AND w.payload->>'base_product' = ${String(MYLO_PRODUCT_ID)}
      AND w.result = 'success'
      AND (w.action IS NULL OR w.action = 'skipped_non_mylo_product')
    ORDER BY w.processed_at;
  `;

  return rows as unknown as OrphanCandidate[];
}

async function main(): Promise<void> {
  console.log(`[reprocess] mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (onlyEmail) console.log(`[reprocess] filter: email=${onlyEmail}`);

  const candidates = await findOrphanedMyloWebhooks();
  console.log(`[reprocess] found ${candidates.length} candidate webhook(s)`);

  let processed = 0;
  let skippedAlreadyDone = 0;
  let recovered = 0;
  let failed = 0;

  for (const c of candidates) {
    if (onlyEmail && c.customer_email.toLowerCase() !== onlyEmail) continue;
    processed++;

    const normalized = normalizeThriveCartPayload(c.payload);
    const isMylo = isProductPurchase(normalized, MYLO_PRODUCT_ID);

    const status = c.has_user && c.has_subscription && c.has_payment
      ? 'COMPLETE'
      : c.has_user
        ? 'PARTIAL'
        : 'MISSING_USER';

    console.log(
      `\n[${c.customer_email}] invoice=${c.invoice_id} processed=${c.processed_at} status=${status} isMylo=${isMylo}`
    );

    if (!isMylo) {
      console.log(`  -> not a MYLO purchase after normalization; skipping`);
      continue;
    }

    if (status === 'COMPLETE') {
      console.log(`  -> already has user+subscription+payment; nothing to do`);
      skippedAlreadyDone++;
      continue;
    }

    if (status === 'PARTIAL' && !includePartial) {
      console.log(`  -> PARTIAL (user exists, sub/payment via other path); skipping (use --include-partial to override)`);
      skippedAlreadyDone++;
      continue;
    }

    if (isDryRun) {
      console.log(`  -> [dry-run] would call processWebhookEvent`);
      continue;
    }

    try {
      // Call handleOrderSuccess directly to bypass the event_id idempotency check
      // (the original webhook is already in the log; we don't want a duplicate row).
      const email = (normalized.customer?.email || '').toLowerCase().trim();
      const result = await handleOrderSuccess(normalized as ThriveCartWebhookPayload, email);
      console.log(`  -> action=${result.action} success=${result.success}`);

      // Patch the original webhook_log row with the recovered action
      if (result.success) {
        await sql`
          UPDATE thrivecart_webhook_log
          SET action = ${`recovered:${result.action}`}
          WHERE id = ${c.log_id};
        `;
      }

      if (!result.success) {
        failed++;
        console.error(`  -> FAILED: ${result.error}`);
        continue;
      }

      recovered++;
      const details = JSON.stringify({
        originalLogId: c.log_id,
        originalProcessedAt: c.processed_at,
        invoiceId: c.invoice_id,
        recoveredAction: result.action,
      });
      await sql`
        INSERT INTO admin_activity_log (id, target_user_id, action, performed_by, details, created_at)
        SELECT
          md5(random()::text || u.id || NOW()::text),
          u.id,
          'webhook.recovered_via_reprocess_script',
          NULL,
          ${details}::json,
          NOW()
        FROM "user" u
        WHERE LOWER(u.email) = LOWER(${c.customer_email});
      `;
    } catch (err) {
      failed++;
      console.error(`  -> EXCEPTION:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed:           ${processed}`);
  console.log(`Already complete:    ${skippedAlreadyDone}`);
  console.log(`Recovered:           ${recovered}`);
  console.log(`Failed:              ${failed}`);
  if (isDryRun) console.log(`(dry-run — no DB writes)`);
}

main().catch((err) => {
  console.error('[reprocess] fatal:', err);
  process.exit(1);
});
