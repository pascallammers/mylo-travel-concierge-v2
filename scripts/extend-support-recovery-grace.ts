/**
 * Kulanz-Verlängerung für Support-Recovery-Kunden mit abgelaufenem Abo.
 * Setzt currentPeriodEnd auf Ende Juni 2026 und reaktiviert den Zugang.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/extend-support-recovery-grace.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/extend-support-recovery-grace.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { dbUncached as db } from '@/lib/db';
import { subscription, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { findUserByEmail, findUserSubscription, reactivateUser } from '@/app/api/webhooks/subscription/_lib/helpers';
import { logAdminActivity } from '@/lib/admin/activity-logger';
import { SUPPORT_RECOVERY_EMAILS } from '../lib/thrivecart/support-recovery-emails';

/** End of June 2026 (UTC), inclusive grace period for expired recoveries. */
export const SUPPORT_RECOVERY_GRACE_END = new Date('2026-06-30T23:59:59.999Z');

const isDryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const now = new Date();
  console.log(
    isDryRun
      ? '=== DRY RUN — Kulanz bis 30.06.2026 ===\n'
      : '=== LIVE — Kulanz-Verlängerung ===\n'
  );

  let extended = 0;
  let skipped = 0;
  let missing = 0;

  for (const email of SUPPORT_RECOVERY_EMAILS) {
    const foundUser = await findUserByEmail(email);
    if (!foundUser) {
      missing += 1;
      console.log(`✗ ${email}: kein User`);
      continue;
    }

    const sub = await findUserSubscription(foundUser.id);
    if (!sub) {
      missing += 1;
      console.log(`✗ ${email}: kein Abo`);
      continue;
    }

    const periodEnd = sub.currentPeriodEnd;
    const isExpired = periodEnd.getTime() < now.getTime();
    const needsGrace = isExpired && periodEnd.getTime() < SUPPORT_RECOVERY_GRACE_END.getTime();

    if (!needsGrace) {
      skipped += 1;
      const label = isExpired ? 'abgelaufen' : 'aktiv';
      console.log(
        `– ${email}: übersprungen (${label}, Ende ${periodEnd.toISOString().slice(0, 10)})`
      );
      continue;
    }

    const previousEnd = periodEnd.toISOString().slice(0, 10);
    const newEnd = SUPPORT_RECOVERY_GRACE_END.toISOString().slice(0, 10);

    if (isDryRun) {
      extended += 1;
      console.log(`✓ ${email}: würde ${previousEnd} → ${newEnd} verlängern`);
      continue;
    }

    await db
      .update(subscription)
      .set({
        status: 'active',
        currentPeriodEnd: SUPPORT_RECOVERY_GRACE_END,
        nextPaymentDate: SUPPORT_RECOVERY_GRACE_END,
        cancelAtPeriodEnd: false,
        modifiedAt: now,
      })
      .where(eq(subscription.id, sub.id));

    if (!foundUser.isActive || foundUser.activationStatus !== 'active') {
      await reactivateUser(foundUser.id);
    }

    await db
      .update(user)
      .set({ isActive: true, activationStatus: 'active', updatedAt: now })
      .where(eq(user.id, foundUser.id));

    await logAdminActivity(foundUser.id, 'support.recovery_grace_extension', null, {
      email,
      previousPeriodEnd: periodEnd.toISOString(),
      gracePeriodEnd: SUPPORT_RECOVERY_GRACE_END.toISOString(),
      subscriptionId: sub.id,
    });

    extended += 1;
    console.log(`✓ ${email}: ${previousEnd} → ${newEnd}`);
  }

  console.log(`\nFertig: ${extended} verlängert, ${skipped} übersprungen, ${missing} fehlend`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
