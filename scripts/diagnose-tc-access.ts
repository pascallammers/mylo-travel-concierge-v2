/**
 * Feedback loop: compare Mylo access badge vs ThriveCart API for one email.
 * Exit 1 when ThriveCart is active and the Mylo badge is not active.
 *
 * Usage: npx tsx --env-file=.env.local scripts/diagnose-tc-access.ts email@example.com
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import {
  determineSubscriptionStatus,
  pickLatestSubscription,
} from '../lib/thrivecart/subscription-status';
import { decideSyncAction, findMyloApiSubscription } from '../lib/thrivecart/sync-decision';
import type { ThriveCartApiCustomer } from '../lib/thrivecart/types';

const MYLO_IDS = [1, 5] as const;
const email = process.argv[2]?.toLowerCase().trim();

if (!email) {
  console.error('Usage: diagnose-tc-access.ts <email>');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
const THRIVECART_API_KEY = process.env.THRIVECART_API_KEY;

if (!DATABASE_URL || !THRIVECART_API_KEY) {
  console.error('DATABASE_URL and THRIVECART_API_KEY are required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

type SubRow = {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
};

async function fetchThriveCartCustomer(customerEmail: string): Promise<{
  ok: boolean;
  data: ThriveCartApiCustomer | null;
  error?: string;
  raw: unknown;
}> {
  const res = await fetch('https://thrivecart.com/api/external/customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${THRIVECART_API_KEY}`,
    },
    body: JSON.stringify({ email: customerEmail }),
  });

  const text = await res.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = { parseError: true, body: text.slice(0, 500) };
  }

  if (!res.ok) {
    return { ok: false, data: null, error: `HTTP ${res.status}`, raw };
  }

  return { ok: true, data: raw as ThriveCartApiCustomer, raw };
}

function sanitizeCustomer(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const copy = { ...(raw as Record<string, unknown>) };
  delete copy.thrivecart_secret;
  return copy;
}

async function main(): Promise<void> {
  const users = await sql`
    SELECT id, email, name, is_active, activation_status, role, created_at
    FROM "user"
    WHERE lower(email) = lower(${email})
  `;
  const dbUser = users[0] as
    | {
        id: string;
        email: string;
        name: string;
        is_active: boolean;
        activation_status: string;
        role: string;
        created_at: Date;
      }
    | undefined;

  const subs = dbUser
    ? ((await sql`
        SELECT id, status, "currentPeriodEnd", "cancelAtPeriodEnd", "createdAt"
        FROM subscription
        WHERE "userId" = ${dbUser.id}
      `) as SubRow[])
    : [];

  const webhooks = await sql`
    SELECT event_type, action, result, processed_at
    FROM thrivecart_webhook_log
    WHERE lower(customer_email) = lower(${email})
    ORDER BY processed_at DESC
    LIMIT 20
  `;

  const recentCutoff = new Date();
  recentCutoff.setHours(recentCutoff.getHours() - 24);
  const recentWebhook = (webhooks as Array<{ event_type: string; result: string; processed_at: Date }>).some(
    (row) =>
      row.result === 'success' &&
      (row.event_type === 'order.success' || row.event_type === 'order.subscription_payment') &&
      new Date(row.processed_at) > recentCutoff
  );

  const tc = await fetchThriveCartCustomer(email);
  const picked = pickLatestSubscription(
    subs.map((sub) => ({
      ...sub,
      currentPeriodEnd: new Date(sub.currentPeriodEnd),
    }))
  );
  const badge = determineSubscriptionStatus(
    picked
      ? {
          status: picked.status,
          currentPeriodEnd: new Date(picked.currentPeriodEnd),
          cancelAtPeriodEnd: Boolean(picked.cancelAtPeriodEnd),
        }
      : null
  );
  const tcSub = findMyloApiSubscription(tc.data, MYLO_IDS);
  const tcActive = tcSub?.status.toLowerCase() === 'active';
  const action = dbUser && picked
    ? decideSyncAction(
        {
          isActive: Boolean(dbUser.is_active),
          subStatus: picked.status,
          currentPeriodEnd: new Date(picked.currentPeriodEnd),
          cancelAtPeriodEnd: Boolean(picked.cancelAtPeriodEnd),
        },
        tc.data,
        recentWebhook,
        MYLO_IDS
      )
    : null;

  const report = {
    email,
    symptom: 'TC active but Mylo badge is not active',
    red: tcActive && badge.status !== 'active',
    user: dbUser ?? null,
    subscriptions: subs,
    pickedSubscriptionId: picked?.id ?? null,
    myloBadge: badge,
    thriveCart: {
      ok: tc.ok,
      error: tc.error ?? null,
      foundSubscription: tcSub,
      purchaseCount: tc.data?.purchases?.length ?? 0,
      subscriptionCount: tc.data?.subscriptions?.length ?? 0,
    },
    recentWebhook,
    decideSyncAction: action,
    webhooks,
  };

  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/thrivecart/fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  const safeName = email.replace(/[^a-z0-9._-]/gi, '_');
  writeFileSync(
    join(fixtureDir, `${safeName}.tc.json`),
    JSON.stringify(sanitizeCustomer(tc.raw), null, 2)
  );

  console.log(JSON.stringify(report, null, 2));

  if (report.red) {
    console.error(`RED: ${email} is active in ThriveCart but Mylo badge is ${badge.status}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
