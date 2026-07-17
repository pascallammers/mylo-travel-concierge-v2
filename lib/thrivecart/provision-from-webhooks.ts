import { dbUncached as db } from '@/lib/db';
import {
  user,
  account,
  subscription,
  payment,
  thrivecartWebhookLog,
  thriveCartTransaction,
} from '@/lib/db/schema';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '@/lib/email';
import { findUserByEmail, findUserSubscription } from '@/app/api/webhooks/subscription/_lib/helpers';
import { generateId } from 'ai';
import { logAdminActivity } from '@/lib/admin/activity-logger';
import { thrivecartConfig } from './config';
import {
  findMyloPurchase,
  isProductPurchase,
  normalizeThriveCartPayload,
} from './payload-normalizer';
import type { ThriveCartWebhookPayload } from './types';
import {
  computeSubscriptionWindowFromWebhookHistory,
  findLatestMyloOrderSuccessPayload,
  parseThriveCartOrderDate,
  type SubscriptionWindow,
  type WebhookHistoryRow,
} from './subscription-window';

export interface ProvisionCustomerOptions {
  /** When true, only return the planned actions without writing. */
  dryRun?: boolean;
  /** Send welcome email with generated password (default true for live runs). */
  sendWelcomeEmail?: boolean;
}

export interface ProvisionCustomerResult {
  success: boolean;
  action: string;
  email: string;
  error?: string;
  userId?: string;
  subscriptionId?: string;
  window?: {
    periodStart: string;
    periodEnd: string;
    rebillCount: number;
    cancelAtPeriodEnd: boolean;
  };
  welcomeEmailSent?: boolean;
}

/**
 * Load ThriveCart webhook history for an email.
 *
 * @param email - Customer email
 * @returns Rows for window computation
 */
async function loadWebhookHistory(email: string): Promise<WebhookHistoryRow[]> {
  const rows = await db
    .select({
      event_type: thrivecartWebhookLog.eventType,
      order_id: thrivecartWebhookLog.orderId,
      processed_at: thrivecartWebhookLog.processedAt,
      payload: thrivecartWebhookLog.payload,
    })
    .from(thrivecartWebhookLog)
    .where(
      drizzleSql`lower(${thrivecartWebhookLog.customerEmail}) = lower(${email})`
    );

  return rows.map((r) => ({
    event_type: r.event_type,
    order_id: r.order_id,
    processed_at: r.processed_at,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

async function createSubscriptionWithWindow(
  userId: string,
  opts: {
    amount: number;
    currency: string;
    orderId: string;
    customerId: string;
    productName?: string;
    subscriptionId?: string;
    window: SubscriptionWindow;
  }
): Promise<string> {
  const subId = crypto.randomBytes(16).toString('hex');
  const createdAt = opts.window.periodStart;

  await db.insert(subscription).values({
    id: subId,
    userId,
    status: opts.window.cancelAtPeriodEnd ? 'active' : 'active',
    amount: opts.amount,
    currency: opts.currency || 'EUR',
    recurringInterval: 'month',
    currentPeriodStart: opts.window.periodStart,
    currentPeriodEnd: opts.window.periodEnd,
    startedAt: opts.window.startedAt,
    createdAt,
    customerId: opts.customerId || userId,
    productId: 'mylo-subscription',
    checkoutId: opts.orderId || crypto.randomBytes(8).toString('hex'),
    thrivecardCustomerId: opts.customerId || null,
    thrivecardSubscriptionId: opts.subscriptionId || opts.orderId || null,
    planType: 'standard',
    planName: opts.productName || 'MYLO Miles & Travel Concierge',
    lastPaymentDate: opts.window.periodEnd > new Date() ? new Date() : opts.window.periodEnd,
    nextPaymentDate: opts.window.periodEnd,
    cancelAtPeriodEnd: opts.window.cancelAtPeriodEnd,
  });

  return subId;
}

async function recordPaymentForUser(
  userId: string,
  opts: {
    orderId: string;
    customerId: string;
    amount: number;
    currency: string;
    event: string;
    productName?: string;
    paidAt?: Date;
  }
): Promise<boolean> {
  const existing = await db.query.payment.findFirst({
    where: and(
      eq(payment.userId, userId),
      eq(payment.thrivecardPaymentId, opts.orderId)
    ),
  });
  if (existing) return false;

  const paidAt = opts.paidAt ?? new Date();
  await db.insert(payment).values({
    id: crypto.randomBytes(16).toString('hex'),
    createdAt: paidAt,
    updatedAt: paidAt,
    userId,
    totalAmount: opts.amount,
    currency: opts.currency || 'EUR',
    status: 'succeeded',
    thrivecardPaymentId: opts.orderId || null,
    thrivecardCustomerId: opts.customerId || null,
    paymentProvider: 'thrivecart',
    webhookSource: 'direct',
    syncSource: 'webhook',
    metadata: JSON.stringify({
      event: opts.event,
      productName: opts.productName ?? null,
      processedAt: paidAt.toISOString(),
      source: 'support_provision',
    }),
  });
  return true;
}

async function recordTransactionIfNew(
  payload: ThriveCartWebhookPayload,
  transactionType: 'charge' | 'rebill',
  amount: number
): Promise<void> {
  const eventId = payload.event_id ? String(payload.event_id) : null;
  if (!eventId) return;

  const myloLine = findMyloPurchase(payload, thrivecartConfig.productIds);

  await db
    .insert(thriveCartTransaction)
    .values({
      id: generateId(),
      eventId,
      baseProduct: payload.base_product ? String(payload.base_product) : null,
      transactionDate: parseThriveCartOrderDate(payload.order?.date) ?? new Date(),
      transactionType,
      itemType: 'product',
      itemId: String(myloLine?.product_id ?? payload.base_product ?? ''),
      amount,
      currency: payload.currency?.toUpperCase() || 'EUR',
      orderId: payload.order_id ? String(payload.order_id) : null,
      invoiceId: payload.invoice_id || null,
      processor: payload.order?.processor || null,
      customerName: payload.customer?.name || null,
      customerEmail: payload.customer?.email?.toLowerCase() || 'unknown',
      reference: null,
      rawData: payload as unknown as Record<string, unknown>,
      importedAt: new Date(),
    })
    .onConflictDoNothing({ target: thriveCartTransaction.eventId });
}

async function markWebhooksRecovered(email: string): Promise<void> {
  await db
    .update(thrivecartWebhookLog)
    .set({ action: 'recovered:support_provision' })
    .where(
      drizzleSql`lower(${thrivecartWebhookLog.customerEmail}) = lower(${email})`
    );
}

/**
 * Create a MYLO user from stored ThriveCart webhooks with historically correct dates.
 *
 * @param rawEmail - Customer email
 * @param options - Dry-run and email options
 * @returns Provision result
 */
export async function provisionCustomerFromThriveCartHistory(
  rawEmail: string,
  options: ProvisionCustomerOptions = {}
): Promise<ProvisionCustomerResult> {
  const email = rawEmail.toLowerCase().trim();
  const dryRun = options.dryRun ?? false;
  const shouldSendWelcome = options.sendWelcomeEmail ?? !dryRun;

  const existing = await findUserByEmail(email);
  if (existing) {
    const sub = await findUserSubscription(existing.id);
    return {
      success: false,
      action: sub ? 'skipped_existing_user_with_subscription' : 'skipped_existing_user',
      email,
      userId: existing.id,
      subscriptionId: sub?.id,
      error: 'User already exists',
    };
  }

  const history = await loadWebhookHistory(email);
  const myloProductIds = thrivecartConfig.productIds;
  const window = computeSubscriptionWindowFromWebhookHistory(history, myloProductIds);
  const orderPayload = findLatestMyloOrderSuccessPayload(history, myloProductIds);

  if (!window || !orderPayload) {
    return {
      success: false,
      action: 'no_mylo_webhook_history',
      email,
      error: 'No MYLO order.success webhook found for this email',
    };
  }

  const myloPurchase = findMyloPurchase(orderPayload, myloProductIds);
  const amount = Number(myloPurchase?.amount || orderPayload.order?.total || 0);
  const currency = orderPayload.currency || 'EUR';
  const orderId = String(orderPayload.order_id);
  const customerId = String(orderPayload.customer_id || '');
  const firstName = orderPayload.customer?.firstname || '';

  const windowSummary = {
    periodStart: window.periodStart.toISOString(),
    periodEnd: window.periodEnd.toISOString(),
    rebillCount: window.rebillCount,
    cancelAtPeriodEnd: window.cancelAtPeriodEnd,
  };

  if (dryRun) {
    return {
      success: true,
      action: 'dry_run_would_provision',
      email,
      window: windowSummary,
    };
  }

  const userId = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(12).toString('base64').slice(0, 12);
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    email,
    name:
      firstName && orderPayload.customer?.lastname
        ? `${firstName} ${orderPayload.customer.lastname}`
        : firstName || email.split('@')[0],
    emailVerified: true,
    createdAt: window.periodStart,
    updatedAt: now,
    isActive: true,
    activationStatus: 'active',
  });

  const hashedPassword = bcrypt.hashSync(password, 10);
  await db.insert(account).values({
    id: crypto.randomBytes(16).toString('hex'),
    userId,
    accountId: email,
    providerId: 'credential',
    password: hashedPassword,
    createdAt: window.periodStart,
    updatedAt: now,
  });

  const subId = await createSubscriptionWithWindow(userId, {
    amount,
    currency,
    orderId,
    customerId,
    productName: myloPurchase?.product_name,
    subscriptionId: myloPurchase?.subscription?.id,
    window,
  });

  let paymentsRecorded = 0;
  for (const row of history) {
    const payload = normalizeThriveCartPayload(row.payload);
    if (!isProductPurchase(payload, myloProductIds)) continue;

    const lineAmount = Number(
      findMyloPurchase(payload, myloProductIds)?.amount || payload.order?.total || 0
    );
    const paidAt =
      parseThriveCartOrderDate(payload.order?.date) ?? new Date(row.processed_at);

    if (row.event_type === 'order.success') {
      const added = await recordPaymentForUser(userId, {
        orderId: String(payload.order_id),
        customerId: String(payload.customer_id || ''),
        amount: lineAmount,
        currency: payload.currency || 'EUR',
        event: 'initial_purchase',
        productName: findMyloPurchase(payload, myloProductIds)?.product_name,
        paidAt,
      });
      if (added) paymentsRecorded += 1;
      await recordTransactionIfNew(payload, 'charge', lineAmount);
    }

    if (row.event_type === 'order.subscription_payment') {
      const paymentKey = payload.event_id
        ? String(payload.event_id)
        : `rebill-${payload.order_id}-${paidAt.toISOString()}`;
      const added = await recordPaymentForUser(userId, {
        orderId: paymentKey,
        customerId: String(payload.customer_id || ''),
        amount: lineAmount,
        currency: payload.currency || 'EUR',
        event: 'rebill',
        productName: findMyloPurchase(payload, myloProductIds)?.product_name,
        paidAt,
      });
      if (added) paymentsRecorded += 1;
      await recordTransactionIfNew(payload, 'rebill', lineAmount);
    }
  }

  let welcomeEmailSent = false;
  if (shouldSendWelcome) {
    try {
      await sendWelcomeEmail(email, password, firstName, 'de');
      welcomeEmailSent = true;
    } catch (emailError) {
      console.error(`[SupportProvision] Welcome email failed for ${email}:`, emailError);
    }
  }

  await markWebhooksRecovered(email);

  await logAdminActivity(userId, 'support.provision_from_thrivecart', null, {
    email,
    orderId,
    window: windowSummary,
    paymentsRecorded,
    welcomeEmailSent,
  });

  return {
    success: true,
    action: 'provisioned_from_webhook_history',
    email,
    userId,
    subscriptionId: subId,
    window: windowSummary,
    welcomeEmailSent,
  };
}
