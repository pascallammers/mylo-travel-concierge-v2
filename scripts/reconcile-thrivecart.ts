/**
 * ThriveCart Reconciliation Script
 *
 * Queries every active MYLO user against the ThriveCart API.
 * Users without an active MYLO subscription (product ID 5) get:
 *   1. Subscription copied to archive_subscription
 *   2. Subscription status set to 'canceled'
 *   3. User set to is_active=false, activation_status='suspended'
 *
 * Usage:
 *   npx tsx scripts/reconcile-thrivecart.ts --dry-run                    # Preview only
 *   npx tsx scripts/reconcile-thrivecart.ts                             # Execute changes
 *   npx tsx scripts/reconcile-thrivecart.ts --start-from user@email.com # Resume from email
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
const THRIVECART_API_KEY = process.env.THRIVECART_API_KEY!;
const MYLO_PRODUCT_ID = Number(process.env.THRIVECART_PRODUCT_ID || '5');
const RATE_LIMIT_MS = 1200; // ~50 req/min (safe margin under 60/min limit)

const isDryRun = process.argv.includes('--dry-run');
const startFromIdx = process.argv.indexOf('--start-from');
const startFromEmail = startFromIdx !== -1 ? process.argv[startFromIdx + 1] : null;
const sql = neon(DATABASE_URL);

interface ActiveUser {
  user_id: string;
  email: string;
  name: string | null;
  sub_id: string;
  sub_status: string;
  sub_created: Date;
  amount: number;
}

interface ThriveCartSubscription {
  status: string;
  item_id: string;
}

interface ReconcileResult {
  totalChecked: number;
  totalDeactivated: number;
  totalKept: number;
  totalErrors: number;
  deactivated: string[];
  errors: Array<{ email: string; error: string }>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a user has an active MYLO subscription in ThriveCart.
 */
async function hasActiveMYLOSub(email: string): Promise<boolean> {
  const res = await fetch('https://thrivecart.com/api/external/customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${THRIVECART_API_KEY}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    throw new Error(`TC API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const subscriptions: ThriveCartSubscription[] = data.subscriptions || [];

  return subscriptions.some(
    (s) => s.status === 'active' && String(s.item_id) === String(MYLO_PRODUCT_ID)
  );
}

/**
 * Archive a subscription: copy to archive_subscription, then update original.
 */
async function archiveAndDeactivate(
  userId: string,
  subId: string,
  email: string
): Promise<void> {
  // 1. Copy subscription to archive
  await sql`
    INSERT INTO archive_subscription
    SELECT s.*, now() AS archived_at, 'cleanup' AS archive_reason
    FROM subscription s
    WHERE s.id = ${subId}
    ON CONFLICT (id) DO NOTHING
  `;

  // 2. Cancel subscription
  await sql`
    UPDATE subscription
    SET status = 'canceled',
        "canceledAt" = now(),
        "modifiedAt" = now(),
        "cancelAtPeriodEnd" = true
    WHERE id = ${subId}
  `;

  // 3. Deactivate user
  await sql`
    UPDATE "user"
    SET is_active = false,
        activation_status = 'suspended',
        updated_at = now()
    WHERE id = ${userId}
  `;
}

async function run(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ThriveCart Reconciliation — ${isDryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log(`${new Date().toISOString()}`);
  console.log(`MYLO Product ID: ${MYLO_PRODUCT_ID}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all active users with their latest subscription
  const activeUsers: ActiveUser[] = await sql`
    SELECT DISTINCT ON (u.id)
      u.id AS user_id,
      u.email,
      u.name,
      s.id AS sub_id,
      s.status AS sub_status,
      s."createdAt" AS sub_created,
      s.amount
    FROM "user" u
    JOIN subscription s ON s."userId" = u.id
    WHERE u.is_active = true
      AND u.role != 'admin'
      AND s.status = 'active'
    ORDER BY u.id, s."currentPeriodEnd" DESC
  `;

  console.log(`Found ${activeUsers.length} active non-admin users with active subscriptions`);

  // Resume support: skip users before the start-from email
  let startIndex = 0;
  if (startFromEmail) {
    startIndex = activeUsers.findIndex((u) => u.email === startFromEmail);
    if (startIndex === -1) {
      console.error(`Email ${startFromEmail} not found in active users. Starting from beginning.`);
      startIndex = 0;
    } else {
      console.log(`Resuming from ${startFromEmail} (index ${startIndex})`);
    }
  }
  console.log('');

  const result: ReconcileResult = {
    totalChecked: 0,
    totalDeactivated: 0,
    totalKept: 0,
    totalErrors: 0,
    deactivated: [],
    errors: [],
  };

  for (let i = startIndex; i < activeUsers.length; i++) {
    const u = activeUsers[i];
    result.totalChecked++;

    const progress = `[${i + 1}/${activeUsers.length}]`;

    try {
      const hasActive = await hasActiveMYLOSub(u.email);

      if (hasActive) {
        result.totalKept++;
        console.log(`${progress} ✅ ${u.email} — active MYLO sub in TC`);
      } else {
        result.totalDeactivated++;
        result.deactivated.push(u.email);

        if (isDryRun) {
          console.log(`${progress} ❌ ${u.email} — NO active MYLO sub → WOULD deactivate (amount: ${u.amount})`);
        } else {
          await archiveAndDeactivate(u.user_id, u.sub_id, u.email);
          console.log(`${progress} ❌ ${u.email} — NO active MYLO sub → DEACTIVATED`);
        }
      }
    } catch (error) {
      result.totalErrors++;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ email: u.email, error: msg });
      console.log(`${progress} ⚠️  ${u.email} — ERROR: ${msg}`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Handle users with multiple active subscriptions (archive all non-latest)
  if (!isDryRun) {
    const extraSubs = await sql`
      SELECT s.id AS sub_id, s."userId" AS user_id, u.email
      FROM subscription s
      JOIN "user" u ON u.id = s."userId"
      WHERE u.is_active = false
        AND u.activation_status = 'suspended'
        AND s.status = 'active'
    `;

    if (extraSubs.length > 0) {
      console.log(`\nArchiving ${extraSubs.length} additional active subs for deactivated users...`);
      for (const es of extraSubs) {
        await sql`
          INSERT INTO archive_subscription
          SELECT s.*, now() AS archived_at, 'cleanup' AS archive_reason
          FROM subscription s
          WHERE s.id = ${es.sub_id}
          ON CONFLICT (id) DO NOTHING
        `;
        await sql`
          UPDATE subscription
          SET status = 'canceled', "canceledAt" = now(), "modifiedAt" = now()
          WHERE id = ${es.sub_id}
        `;
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY ${isDryRun ? '(DRY RUN)' : '(EXECUTED)'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total checked:     ${result.totalChecked}`);
  console.log(`Kept active:       ${result.totalKept}`);
  console.log(`Deactivated:       ${result.totalDeactivated}`);
  console.log(`Errors:            ${result.totalErrors}`);

  if (!isDryRun) {
    // Verify final counts
    const finalActive = await sql`SELECT count(*) AS cnt FROM "user" WHERE is_active = true`;
    const finalSubs = await sql`SELECT count(*) AS cnt FROM subscription WHERE status = 'active'`;
    const archived = await sql`SELECT count(*) AS cnt FROM archive_subscription`;

    console.log(`\nAfter reconciliation:`);
    console.log(`  Active users:        ${finalActive[0].cnt}`);
    console.log(`  Active subscriptions: ${finalSubs[0].cnt}`);
    console.log(`  Archived subs:       ${archived[0].cnt}`);
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    result.errors.forEach((e) => console.log(`  ${e.email}: ${e.error}`));
  }

  console.log('');
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
