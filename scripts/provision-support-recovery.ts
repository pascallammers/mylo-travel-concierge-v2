/**
 * Provision MYLO access for the support recovery email list using ThriveCart webhook history.
 *
 * Uses purchase/rebill dates from thrivecart_webhook_log (not "today + 1 month").
 * Sends welcome emails with new credentials for users without an account.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/provision-support-recovery.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/provision-support-recovery.ts
 *   npx tsx --env-file=.env.local scripts/provision-support-recovery.ts --only=foo@bar.de
 *   npx tsx --env-file=.env.local scripts/provision-support-recovery.ts --no-email
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { SUPPORT_RECOVERY_EMAILS } from '../lib/thrivecart/support-recovery-emails';
import { provisionCustomerFromThriveCartHistory } from '../lib/thrivecart/provision-from-webhooks';

const isDryRun = process.argv.includes('--dry-run');
const skipEmail = process.argv.includes('--no-email');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyEmail = onlyArg ? onlyArg.slice('--only='.length).toLowerCase().trim() : null;

const emails = onlyEmail
  ? SUPPORT_RECOVERY_EMAILS.filter((e) => e === onlyEmail)
  : [...SUPPORT_RECOVERY_EMAILS];

if (onlyEmail && emails.length === 0) {
  console.error(`Email not in support list: ${onlyEmail}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(
    isDryRun
      ? '=== DRY RUN — no database writes, no emails ===\n'
      : skipEmail
        ? '=== LIVE — provisioning without welcome emails ===\n'
        : '=== LIVE — provisioning + welcome emails ===\n'
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await provisionCustomerFromThriveCartHistory(email, {
      dryRun: isDryRun,
      sendWelcomeEmail: !skipEmail && !isDryRun,
    });

    if (result.success) {
      ok += 1;
      const window = result.window
        ? ` | access ${result.window.periodStart.slice(0, 10)} → ${result.window.periodEnd.slice(0, 10)} (rebills: ${result.window.rebillCount})`
        : '';
      console.log(`✓ ${email}: ${result.action}${window}`);
    } else if (result.action.startsWith('skipped_')) {
      skipped += 1;
      console.log(`– ${email}: ${result.action}${result.error ? ` (${result.error})` : ''}`);
    } else {
      failed += 1;
      console.log(`✗ ${email}: ${result.action} — ${result.error ?? 'unknown'}`);
    }
  }

  console.log(`\nDone: ${ok} ok, ${skipped} skipped, ${failed} failed (${emails.length} total)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
