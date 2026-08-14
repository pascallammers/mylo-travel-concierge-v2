/**
 * Restore Mylo users whose ThriveCart MYLO subscription is still active.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/restore-active-tc-users.ts
 *   npx tsx --env-file=.env.local scripts/restore-active-tc-users.ts --apply
 *   npx tsx --env-file=.env.local scripts/restore-active-tc-users.ts --apply user@example.com
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import {
  determineSubscriptionStatus,
  pickLatestSubscription,
} from '../lib/thrivecart/subscription-status';
import {
  findMyloApiSubscription,
  resolvePeriodEndFromThriveCart,
} from '../lib/thrivecart/sync-decision';
import type { ThriveCartApiCustomer } from '../lib/thrivecart/types';

const MYLO_IDS = [1, 5] as const;
const RATE_LIMIT_MS = 1200;
const isApply = process.argv.includes('--apply');
const emails = process.argv.filter((arg) => arg.includes('@')).map((arg) => arg.toLowerCase().trim());

const DATABASE_URL = process.env.DATABASE_URL;
const THRIVECART_API_KEY = process.env.THRIVECART_API_KEY;

if (!DATABASE_URL || !THRIVECART_API_KEY) {
  console.error('DATABASE_URL and THRIVECART_API_KEY are required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

type UserRow = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  activation_status: string;
};

type SubRow = {
  id: string;
  userId: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCustomer(email: string): Promise<ThriveCartApiCustomer | null> {
  const res = await fetch('https://thrivecart.com/api/external/customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${THRIVECART_API_KEY}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return null;
  return (await res.json()) as ThriveCartApiCustomer;
}

async function main(): Promise<void> {
  const users = (await sql`
    SELECT id, email, name, is_active, activation_status
    FROM "user"
    WHERE role IS DISTINCT FROM 'admin'
  `) as UserRow[];

  const subs = (await sql`
    SELECT id, "userId", status, "currentPeriodEnd", "cancelAtPeriodEnd"
    FROM subscription
  `) as SubRow[];

  const subsByUser = new Map<string, SubRow[]>();
  for (const sub of subs) {
    const list = subsByUser.get(sub.userId) ?? [];
    list.push({ ...sub, currentPeriodEnd: new Date(sub.currentPeriodEnd) });
    subsByUser.set(sub.userId, list);
  }

  const candidates = users.filter((account) => {
    if (emails.length > 0 && !emails.includes(account.email.toLowerCase())) {
      return false;
    }
    const picked = pickLatestSubscription(subsByUser.get(account.id) ?? []);
    const badge = determineSubscriptionStatus(
      picked
        ? {
            status: picked.status,
            currentPeriodEnd: new Date(picked.currentPeriodEnd),
            cancelAtPeriodEnd: Boolean(picked.cancelAtPeriodEnd),
          }
        : null
    );
    return !account.is_active || badge.status === 'inactive' || badge.status === 'none';
  });

  console.log(`Checking ${candidates.length} inactive/expired Mylo users against ThriveCart...`);

  const restorations: Array<{
    email: string;
    userId: string;
    subId: string | null;
    nextPaymentDate?: string;
    badge: string;
  }> = [];

  for (const [index, account] of candidates.entries()) {
    if ((index + 1) % 10 === 0 || index === 0) {
      console.log(`Progress ${index + 1}/${candidates.length}`);
    }
    const customer = await fetchCustomer(account.email);
    await sleep(RATE_LIMIT_MS);
    const tcSub = findMyloApiSubscription(customer, MYLO_IDS);
    if (!tcSub || tcSub.status.toLowerCase() !== 'active') {
      continue;
    }

    const picked = pickLatestSubscription(subsByUser.get(account.id) ?? []);
    const badge = determineSubscriptionStatus(
      picked
        ? {
            status: picked.status,
            currentPeriodEnd: new Date(picked.currentPeriodEnd),
            cancelAtPeriodEnd: Boolean(picked.cancelAtPeriodEnd),
          }
        : null
    );

    restorations.push({
      email: account.email,
      userId: account.id,
      subId: picked?.id ?? null,
      nextPaymentDate: tcSub.nextPaymentDate,
      badge: badge.status,
    });
  }

  console.log(JSON.stringify({ dryRun: !isApply, count: restorations.length, restorations }, null, 2));

  if (!isApply || restorations.length === 0) {
    return;
  }

  const now = new Date();
  for (const row of restorations) {
    const periodEnd = resolvePeriodEndFromThriveCart(row.nextPaymentDate, now);

    await sql`
      UPDATE "user"
      SET is_active = true,
          activation_status = 'active',
          deactivated_at = null,
          updated_at = ${now}
      WHERE id = ${row.userId}
    `;

    if (row.subId) {
      await sql`
        UPDATE subscription
        SET status = 'active',
            "currentPeriodEnd" = ${periodEnd},
            next_payment_date = ${periodEnd},
            "cancelAtPeriodEnd" = false,
            "canceledAt" = null,
            "endedAt" = null,
            "modifiedAt" = ${now}
        WHERE id = ${row.subId}
      `;
    }

    await sql`
      INSERT INTO admin_activity_log (id, target_user_id, performed_by, action, details, created_at)
      VALUES (
        ${`restore_${row.userId}_${now.getTime()}`},
        ${row.userId},
        null,
        'sync.user_restored',
        ${JSON.stringify({
          email: row.email,
          nextPaymentDate: row.nextPaymentDate ?? null,
          previousBadge: row.badge,
        })}::json,
        ${now}
      )
    `;

    console.log(`Restored ${row.email} until ${periodEnd.toISOString()}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
