import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';
import {
  isProductPurchase,
  normalizeThriveCartPayload,
} from '../lib/thrivecart/payload-normalizer';
import { SUPPORT_RECOVERY_EMAILS } from '../lib/thrivecart/support-recovery-emails';
const sql = neon(process.env.DATABASE_URL!);
const MYLO_IDS = [1, 5];

async function main(): Promise<void> {
  for (const email of SUPPORT_RECOVERY_EMAILS) {
    const u = await sql`
      SELECT id, email, is_active
      FROM "user"
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;
    const w = await sql`
      SELECT w.id, w.order_id, w.action, w.processed_at, w.payload
      FROM thrivecart_webhook_log w
      WHERE lower(w.customer_email) = lower(${email})
        AND w.event_type = 'order.success'
      ORDER BY w.processed_at DESC
      LIMIT 3
    `;

    let myloOrder: string | null = null;
    let orderDate: string | null = null;
    let nextPay: string | null = null;

    for (const row of w) {
      const norm = normalizeThriveCartPayload(row.payload as Record<string, unknown>);
      if (!isProductPurchase(norm, MYLO_IDS)) continue;
      myloOrder = String(row.order_id);
      orderDate = norm.order?.date ?? null;
      const purchase = norm.purchases?.find((p) =>
        MYLO_IDS.includes(Number(p.product_id))
      );
      nextPay = purchase?.subscription?.next_payment_date ?? null;
      break;
    }

    const sub = u[0]
      ? await sql`
          SELECT "checkoutId", status, "currentPeriodEnd", plan_name
          FROM subscription
          WHERE "userId" = ${u[0].id}
          LIMIT 1
        `
      : [];

    console.log(
      JSON.stringify({
        email,
        hasUser: Boolean(u[0]),
        isActive: u[0]?.is_active ?? null,
        sub: sub[0] ?? null,
        myloWebhookOrder: myloOrder,
        orderDate,
        nextPaymentDate: nextPay,
        webhookCount: w.length,
      })
    );
  }
}

main();
