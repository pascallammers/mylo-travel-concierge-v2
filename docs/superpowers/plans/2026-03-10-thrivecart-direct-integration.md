# ThriveCart Direct Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zapier-based ThriveCart integration with direct webhooks and periodic API sync for reliable subscription lifecycle management.

**Architecture:** Single webhook endpoint receives all ThriveCart events and dispatches to handlers. A cron job syncs all subscriptions every 6 hours as a safety net. Both share a common ThriveCart API client and reuse existing subscription helper functions.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Neon PostgreSQL, Vercel Cron, ThriveCart REST API

**Spec:** `docs/superpowers/specs/2026-03-10-thrivecart-direct-integration-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/thrivecart/types.ts` | TypeScript types for ThriveCart webhook payloads and API responses |
| `lib/thrivecart/config.ts` | ThriveCart environment config (API key, secret, product ID) |
| `lib/thrivecart/client.ts` | ThriveCart REST API client (query customers, subscriptions) |
| `lib/thrivecart/webhook-handler.ts` | Event dispatching and processing logic for all webhook events |
| `lib/thrivecart/sync.ts` | Sync job logic (compare ThriveCart state vs DB, correct discrepancies) |
| `app/api/webhooks/thrivecart/route.ts` | Unified webhook endpoint (POST + HEAD) |
| `app/api/cron/thrivecart-sync/route.ts` | Cron endpoint for periodic sync |

### Modified Files
| File | Change |
|------|--------|
| `lib/db/schema.ts` | Add `lastSyncedAt` to subscription, `syncSource` to payment, new `thrivecartWebhookLog` and `thrivecartSyncLog` tables |
| `env/server.ts` | Add THRIVECART_* environment variables |
| `vercel.json` | Add thrivecart-sync cron schedule |

---

## Chunk 1: Foundation (Types, Config, Schema, Env)

### Task 1: Add ThriveCart environment variables

**Files:**
- Modify: `env/server.ts`
- Modify: `.env.local` (manual — not committed)

- [ ] **Step 1: Add ThriveCart env vars to server schema**

In `env/server.ts`, add inside the `server: { ... }` block after the `AWARDWALLET_PROXY_URL` entry:

```typescript
// ThriveCart Integration
THRIVECART_API_KEY: z.string().min(1),
THRIVECART_SECRET_WORD: z.string().min(1),
THRIVECART_PRODUCT_ID: z.string().optional().default('5'),
THRIVECART_ACCOUNT_ID: z.string().optional().default('never-economy-again'),
```

Note: `CRON_SECRET` already exists and will be reused for the sync cron endpoint.

- [ ] **Step 2: Add env vars to `.env.local`**

Add to your `.env.local`:
```
THRIVECART_API_KEY=<your-api-key>
THRIVECART_SECRET_WORD=<your-secret-word>
THRIVECART_PRODUCT_ID=5
THRIVECART_ACCOUNT_ID=never-economy-again
```

- [ ] **Step 3: Verify the app still builds**

Run: `pnpm build` (or `pnpm dev` and check for env validation errors)

- [ ] **Step 4: Commit**

```bash
git add env/server.ts
git commit -m "feat(thrivecart): add environment variables for ThriveCart integration"
```

---

### Task 2: Create ThriveCart types

**Files:**
- Create: `lib/thrivecart/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * ThriveCart webhook payload types.
 *
 * Standard webhooks send data as multipart/form-data.
 * All price fields are in "hundreds" (cents) — divide by 100 for actual amount.
 * The `amount_str` field provides pre-formatted currency strings.
 */

// --- Webhook Payload Types ---

export interface ThriveCartCustomer {
  name: string;
  firstname: string;
  lastname: string;
  email: string;
  address: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface ThriveCartCharge {
  amount: number;       // in hundreds (cents)
  amount_str: string;   // formatted, e.g. "$47.00"
  status: string;
}

export interface ThriveCartOrder {
  date: string;
  total: number;        // in hundreds
  total_str: string;
  tax: number;
  tax_type: string;
  processor: string;    // 'thrivepay', 'paypal_v2', 'stripe', etc.
  payment_method: string;
  charges: ThriveCartCharge[];
  future_charges?: ThriveCartCharge[];
}

export interface ThriveCartPurchase {
  product_id: number;
  product_name: string;
  pricing_option: string;
  type: 'product' | 'bump' | 'upsell' | 'downsell';
  amount: number;       // in hundreds
  amount_str: string;
  subscription?: {
    id: string;         // processor subscription ID
    status: string;     // 'active', 'cancelled', 'paused', etc.
    frequency: string;  // 'month', 'year', etc.
    next_payment_date?: string;
  };
}

export interface ThriveCartWebhookPayload {
  event: ThriveCartEventType;
  event_id?: number;
  mode: 'live' | 'test';
  thrivecart_account: string;
  thrivecart_secret: string;
  base_product: number;
  order_id: number;
  invoice_id: string;
  currency: string;
  customer_id: number;
  customer_identifier?: string;
  customer: ThriveCartCustomer;
  order: ThriveCartOrder;
  purchases: ThriveCartPurchase[];
  purchase_map?: Record<string, unknown>;
}

export type ThriveCartEventType =
  | 'order.success'
  | 'order.refund'
  | 'order.subscription_payment'
  | 'order.subscription_cancelled'
  | 'order.subscription_paused'
  | 'order.subscription_resumed'
  | 'order.rebill_failed'
  | 'cart.abandoned';

// --- API Response Types ---

export interface ThriveCartApiCustomer {
  id: number;
  email: string;
  name: string;
  purchases: ThriveCartApiPurchase[];
}

export interface ThriveCartApiPurchase {
  order_id: number;
  product_id: number;
  product_name: string;
  status: string;
  subscription?: {
    id: string;
    status: 'active' | 'cancelled' | 'paused' | 'completed';
    frequency: string;
    next_payment_date?: string;
    last_payment_date?: string;
    amount: number;
    currency: string;
  };
}

export interface ThriveCartApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Internal Processing Types ---

export type WebhookProcessingResult = {
  success: boolean;
  action: string;
  userId?: string;
  subscriptionId?: string;
  error?: string;
};

export type SyncDiscrepancy = {
  userId: string;
  email: string;
  field: string;
  dbValue: string;
  thriveCartValue: string;
  corrected: boolean;
};

export type SyncResult = {
  totalChecked: number;
  totalCorrected: number;
  totalErrors: number;
  discrepancies: SyncDiscrepancy[];
  errors: Array<{ email: string; error: string }>;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/thrivecart/types.ts
git commit -m "feat(thrivecart): add TypeScript types for webhook payloads and API responses"
```

---

### Task 3: Create ThriveCart config

**Files:**
- Create: `lib/thrivecart/config.ts`

- [ ] **Step 1: Create the config file**

```typescript
import { serverEnv } from '@/env/server';

export const thrivecartConfig = {
  apiKey: serverEnv.THRIVECART_API_KEY,
  secretWord: serverEnv.THRIVECART_SECRET_WORD,
  productId: serverEnv.THRIVECART_PRODUCT_ID,
  accountId: serverEnv.THRIVECART_ACCOUNT_ID,
  apiBaseUrl: 'https://thrivecart.com/api/external',
  rateLimitPerMinute: 60,
} as const;

/**
 * Verify that a webhook request is authentic by checking the thrivecart_secret.
 */
export function verifyWebhookSecret(secret: string): boolean {
  return secret === thrivecartConfig.secretWord;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/thrivecart/config.ts
git commit -m "feat(thrivecart): add config module with secret verification"
```

---

### Task 4: Add database schema changes

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add `lastSyncedAt` to subscription table**

In `lib/db/schema.ts`, add after the `paymentMethod` field in the `subscription` table (line ~152):

```typescript
  // ThriveCart sync tracking
  lastSyncedAt: timestamp('last_synced_at'),
```

- [ ] **Step 2: Add `syncSource` to payment table**

In `lib/db/schema.ts`, add after the `webhookSource` field in the `payment` table (line ~236):

```typescript
  syncSource: text('sync_source'), // 'webhook' | 'sync' | 'manual'
```

- [ ] **Step 3: Add `thrivecartWebhookLog` table**

Add after the `payment` table definition (after line ~237):

```typescript
// ThriveCart webhook event log for idempotency and debugging
export const thrivecartWebhookLog = pgTable('thrivecart_webhook_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  eventType: text('event_type').notNull(),
  eventId: text('event_id'),
  orderId: text('order_id'),
  customerEmail: text('customer_email').notNull(),
  payload: json('payload'),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
  result: text('result').notNull(), // 'success' | 'error' | 'skipped'
  errorMessage: text('error_message'),
});

// ThriveCart sync job log
export const thrivecartSyncLog = pgTable('thrivecart_sync_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  totalChecked: integer('total_checked').default(0),
  totalCorrected: integer('total_corrected').default(0),
  totalErrors: integer('total_errors').default(0),
  details: json('details'),
  status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed'
});
```

- [ ] **Step 4: Add type exports**

Add after the existing type exports (after line ~491):

```typescript
export type ThriveCartWebhookLog = InferSelectModel<typeof thrivecartWebhookLog>;
export type ThriveCartSyncLog = InferSelectModel<typeof thrivecartSyncLog>;
```

- [ ] **Step 5: Generate and run migration**

```bash
pnpm drizzle-kit generate
```

Review the generated SQL in `drizzle/migrations/`, then apply:

```bash
pnpm drizzle-kit push
```

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(thrivecart): add webhook log, sync log tables and subscription sync fields"
```

---

## Chunk 2: ThriveCart API Client

### Task 5: Create ThriveCart REST API client

**Files:**
- Create: `lib/thrivecart/client.ts`

- [ ] **Step 1: Create the API client**

```typescript
import { thrivecartConfig } from './config';
import type { ThriveCartApiCustomer, ThriveCartApiResponse } from './types';

const RATE_LIMIT_DELAY_MS = 1100; // ~55 requests/minute (safe margin under 60/min limit)

/**
 * Make an authenticated request to the ThriveCart API.
 */
async function thriveCartRequest<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<ThriveCartApiResponse<T>> {
  try {
    const response = await fetch(`${thrivecartConfig.apiBaseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${thrivecartConfig.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ThriveCart API] ${endpoint} failed:`, response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data: data as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ThriveCart API] ${endpoint} error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Ping the ThriveCart API to verify connectivity and credentials.
 */
export async function ping(): Promise<boolean> {
  const result = await thriveCartRequest('ping');
  return result.success;
}

/**
 * Fetch customer data by email, including purchases and subscriptions.
 */
export async function getCustomerByEmail(
  email: string
): Promise<ThriveCartApiResponse<ThriveCartApiCustomer>> {
  return thriveCartRequest<ThriveCartApiCustomer>('customer', { email });
}

/**
 * Fetch all customers for a specific product.
 * Returns paginated results — use `page` parameter for pagination.
 */
export async function getProductCustomers(
  productId: string | number,
  page = 1
): Promise<ThriveCartApiResponse<ThriveCartApiCustomer[]>> {
  return thriveCartRequest<ThriveCartApiCustomer[]>('products/customers', {
    product_id: Number(productId),
    page,
  });
}

/**
 * Sleep helper for rate limiting.
 */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
```

- [ ] **Step 2: Verify API connectivity**

Create a quick test script or use the dev console:
```bash
# After adding env vars, test in your app by temporarily calling ping() from a route
```

- [ ] **Step 3: Commit**

```bash
git add lib/thrivecart/client.ts
git commit -m "feat(thrivecart): add REST API client with rate limiting"
```

---

## Chunk 3: Webhook Endpoint

### Task 6: Create webhook event handler

**Files:**
- Create: `lib/thrivecart/webhook-handler.ts`

- [ ] **Step 1: Create the webhook handler**

This file contains the core business logic for each event type. It reuses existing helper functions from the old Zapier handlers.

```typescript
import { db } from '@/lib/db';
import {
  user,
  account,
  subscription,
  payment,
  thrivecartWebhookLog,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail, sendFailedPaymentAdminAlert } from '@/lib/email';
import {
  extendSubscriptionPeriod,
  reactivateUser,
  suspendUser,
  markSubscriptionCancelled,
  markSubscriptionPastDue,
  getGracePeriodDays,
  findUserByEmail,
  findUserSubscription,
} from '@/app/api/webhooks/subscription/_lib/helpers';
import type { ThriveCartWebhookPayload, WebhookProcessingResult } from './types';
import { generateId } from 'ai';

/**
 * Process a ThriveCart webhook event.
 * Logs the event, checks for duplicates, then dispatches to the appropriate handler.
 */
export async function processWebhookEvent(
  payload: ThriveCartWebhookPayload
): Promise<WebhookProcessingResult> {
  const email = payload.customer?.email?.toLowerCase().trim();
  const eventType = payload.event;
  const orderId = String(payload.order_id || '');
  const eventId = payload.event_id ? String(payload.event_id) : null;

  if (!email) {
    return { success: false, action: 'rejected', error: 'No customer email in payload' };
  }

  // Check for duplicate event processing (idempotency)
  if (eventId) {
    const existing = await db.query.thrivecartWebhookLog.findFirst({
      where: eq(thrivecartWebhookLog.eventId, eventId),
    });
    if (existing) {
      console.log(`[ThriveCart] Duplicate event ${eventId} skipped`);
      return { success: true, action: 'skipped_duplicate' };
    }
  }

  let result: WebhookProcessingResult;

  try {
    switch (eventType) {
      case 'order.success':
        result = await handleOrderSuccess(payload, email);
        break;
      case 'order.subscription_payment':
        result = await handleSubscriptionPayment(payload, email);
        break;
      case 'order.subscription_cancelled':
        result = await handleSubscriptionCancelled(payload, email);
        break;
      case 'order.rebill_failed':
        result = await handleRebillFailed(payload, email);
        break;
      case 'order.subscription_paused':
        result = await handleSubscriptionPaused(email);
        break;
      case 'order.subscription_resumed':
        result = await handleSubscriptionResumed(email);
        break;
      default:
        result = { success: true, action: `ignored_event_${eventType}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result = { success: false, action: `error_${eventType}`, error: errorMsg };
  }

  // Log the webhook event
  await db.insert(thrivecartWebhookLog).values({
    id: generateId(),
    eventType,
    eventId,
    orderId,
    customerEmail: email,
    payload: payload as unknown as Record<string, unknown>,
    processedAt: new Date(),
    result: result.success ? 'success' : 'error',
    errorMessage: result.error || null,
  });

  return result;
}

// --- Event Handlers ---

async function handleOrderSuccess(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const { customer, order, purchases, order_id, customer_id, currency } = payload;
  const firstName = customer.firstname || '';
  const lastName = customer.lastname || '';
  const orderId = String(order_id);
  const customerId = String(customer_id);

  // Find MYLO product purchase
  const myloPurchase = purchases?.find((p) => p.product_id === 5) || purchases?.[0];
  const amount = myloPurchase?.amount || order?.total || 0;

  // Check if user already exists
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    // User exists — check if they need a new subscription
    const existingSub = await findUserSubscription(existingUser.id);

    if (existingSub) {
      // Extend existing subscription
      const updated = await extendSubscriptionPeriod(existingSub.id, new Date());
      if (!existingUser.isActive) await reactivateUser(existingUser.id);
      return {
        success: true,
        action: 'existing_user_subscription_extended',
        userId: existingUser.id,
        subscriptionId: existingSub.id,
      };
    }

    // Create new subscription for existing user
    const subId = await createSubscription(existingUser.id, {
      amount, currency, orderId, customerId,
      productName: myloPurchase?.product_name,
      subscriptionId: myloPurchase?.subscription?.id,
    });
    if (!existingUser.isActive) await reactivateUser(existingUser.id);

    return {
      success: true,
      action: 'existing_user_new_subscription',
      userId: existingUser.id,
      subscriptionId: subId,
    };
  }

  // New user — create user + account + subscription + send welcome email
  const userId = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(12).toString('base64').slice(0, 12);
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    email,
    name: firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0],
    emailVerified: true,
    createdAt: now,
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
    createdAt: now,
    updatedAt: now,
  });

  const subId = await createSubscription(userId, {
    amount, currency, orderId, customerId,
    productName: myloPurchase?.product_name,
    subscriptionId: myloPurchase?.subscription?.id,
  });

  // Record initial payment
  await recordPayment(userId, {
    orderId, customerId, amount, currency,
    event: 'initial_purchase',
    productName: myloPurchase?.product_name,
  });

  // Send welcome email
  try {
    await sendWelcomeEmail(email, password, firstName);
  } catch (emailError) {
    console.error('[ThriveCart] Failed to send welcome email:', emailError);
  }

  return {
    success: true,
    action: 'new_user_created',
    userId,
    subscriptionId: subId,
  };
}

async function handleSubscriptionPayment(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'rebill', error: `User not found: ${email}` };

  // Idempotency: check if this order was already processed
  const orderId = String(payload.order_id || '');
  if (orderId) {
    const existing = await db.query.payment.findFirst({
      where: eq(payment.thrivecardPaymentId, orderId),
    });
    if (existing) return { success: true, action: 'rebill_already_processed' };
  }

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'rebill', error: `No subscription for: ${email}` };

  await extendSubscriptionPeriod(sub.id, new Date());
  if (!foundUser.isActive || foundUser.activationStatus !== 'active') {
    await reactivateUser(foundUser.id);
  }

  const myloPurchase = payload.purchases?.find((p) => p.product_id === 5) || payload.purchases?.[0];
  await recordPayment(foundUser.id, {
    orderId,
    customerId: String(payload.customer_id || ''),
    amount: myloPurchase?.amount || payload.order?.total || 0,
    currency: payload.currency || 'EUR',
    event: 'rebill',
    productName: myloPurchase?.product_name,
  });

  return {
    success: true,
    action: 'subscription_extended',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleSubscriptionCancelled(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'cancel', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'cancel', error: `No subscription for: ${email}` };

  await markSubscriptionCancelled(sub.id);

  return {
    success: true,
    action: 'subscription_cancelled_at_period_end',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleRebillFailed(
  payload: ThriveCartWebhookPayload,
  email: string
): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'failed', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'failed', error: `No subscription for: ${email}` };

  await markSubscriptionPastDue(sub.id);

  if (getGracePeriodDays() === 0) {
    await suspendUser(foundUser.id);
  }

  // Send admin alert
  try {
    await sendFailedPaymentAdminAlert(
      email,
      foundUser.name || 'Unbekannt',
      String(payload.order_id || 'N/A'),
      new Date()
    );
  } catch (e) {
    console.error('[ThriveCart] Failed to send admin alert:', e);
  }

  return {
    success: true,
    action: 'subscription_marked_past_due',
    userId: foundUser.id,
    subscriptionId: sub.id,
  };
}

async function handleSubscriptionPaused(email: string): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'paused', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'paused', error: `No subscription for: ${email}` };

  await db
    .update(subscription)
    .set({ status: 'past_due', modifiedAt: new Date() })
    .where(eq(subscription.id, sub.id));

  return { success: true, action: 'subscription_paused', userId: foundUser.id, subscriptionId: sub.id };
}

async function handleSubscriptionResumed(email: string): Promise<WebhookProcessingResult> {
  const foundUser = await findUserByEmail(email);
  if (!foundUser) return { success: false, action: 'resumed', error: `User not found: ${email}` };

  const sub = await findUserSubscription(foundUser.id);
  if (!sub) return { success: false, action: 'resumed', error: `No subscription for: ${email}` };

  await db
    .update(subscription)
    .set({ status: 'active', modifiedAt: new Date() })
    .where(eq(subscription.id, sub.id));

  if (!foundUser.isActive) await reactivateUser(foundUser.id);

  return { success: true, action: 'subscription_resumed', userId: foundUser.id, subscriptionId: sub.id };
}

// --- Helpers ---

async function createSubscription(
  userId: string,
  opts: {
    amount: number;
    currency: string;
    orderId: string;
    customerId: string;
    productName?: string;
    subscriptionId?: string;
  }
): Promise<string> {
  const subId = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  await db.insert(subscription).values({
    id: subId,
    userId,
    status: 'active',
    amount: Math.round(opts.amount / 100), // ThriveCart sends in hundreds
    currency: opts.currency || 'EUR',
    recurringInterval: 'month',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    startedAt: now,
    createdAt: now,
    customerId: opts.customerId || userId,
    productId: 'mylo-subscription',
    checkoutId: opts.orderId || crypto.randomBytes(8).toString('hex'),
    thrivecardCustomerId: opts.customerId || null,
    thrivecardSubscriptionId: opts.subscriptionId || opts.orderId || null,
    planType: 'standard',
    planName: opts.productName || 'MYLO Miles & Travel Concierge',
    lastPaymentDate: now,
    nextPaymentDate: periodEnd,
  });

  return subId;
}

async function recordPayment(
  userId: string,
  opts: {
    orderId: string;
    customerId: string;
    amount: number;
    currency: string;
    event: string;
    productName?: string;
  }
): Promise<void> {
  const now = new Date();
  await db.insert(payment).values({
    id: crypto.randomBytes(16).toString('hex'),
    createdAt: now,
    updatedAt: now,
    userId,
    totalAmount: Math.round(opts.amount / 100) * 100, // normalize to cents
    currency: opts.currency || 'EUR',
    status: 'succeeded',
    thrivecardPaymentId: opts.orderId || null,
    thrivecardCustomerId: opts.customerId || null,
    paymentProvider: 'thrivecart',
    webhookSource: 'direct',
    syncSource: 'webhook',
    metadata: JSON.stringify({
      event: opts.event,
      productName: opts.productName || null,
      processedAt: now.toISOString(),
    }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/thrivecart/webhook-handler.ts
git commit -m "feat(thrivecart): add webhook event handler with all subscription lifecycle events"
```

---

### Task 7: Create the webhook route

**Files:**
- Create: `app/api/webhooks/thrivecart/route.ts`

- [ ] **Step 1: Create the route handler**

ThriveCart sends standard webhooks as `multipart/form-data` or `application/x-www-form-urlencoded`. It also pings with HEAD to verify the endpoint. We must handle both.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSecret } from '@/lib/thrivecart/config';
import { processWebhookEvent } from '@/lib/thrivecart/webhook-handler';
import type { ThriveCartWebhookPayload } from '@/lib/thrivecart/types';

/**
 * HEAD /api/webhooks/thrivecart
 * ThriveCart pings this to verify the endpoint exists.
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * POST /api/webhooks/thrivecart
 * Receives all ThriveCart webhook events.
 */
export async function POST(req: NextRequest) {
  try {
    let payload: ThriveCartWebhookPayload;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // ThriveCart standard webhooks send form-encoded data
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as ThriveCartWebhookPayload;

      // Parse nested JSON fields that ThriveCart sends as strings
      for (const key of ['customer', 'order', 'purchases', 'purchase_map'] as const) {
        if (typeof (payload as Record<string, unknown>)[key] === 'string') {
          try {
            (payload as Record<string, unknown>)[key] = JSON.parse(
              (payload as Record<string, unknown>)[key] as string
            );
          } catch {
            // Leave as string if not valid JSON
          }
        }
      }

      // Parse numeric fields
      if (typeof payload.order_id === 'string') {
        payload.order_id = Number(payload.order_id);
      }
      if (typeof payload.customer_id === 'string') {
        payload.customer_id = Number(payload.customer_id);
      }
      if (typeof payload.base_product === 'string') {
        payload.base_product = Number(payload.base_product);
      }
    }

    // Verify webhook authenticity
    if (!payload.thrivecart_secret || !verifyWebhookSecret(payload.thrivecart_secret)) {
      console.warn('[ThriveCart Webhook] Invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[ThriveCart Webhook] ${payload.event} for ${payload.customer?.email}`);

    // Process the event
    const result = await processWebhookEvent(payload);

    console.log(`[ThriveCart Webhook] Result:`, result.action, result.success ? '✅' : '❌');

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('[ThriveCart Webhook] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify endpoint responds to HEAD request**

Start dev server and test:
```bash
curl -I http://localhost:3000/api/webhooks/thrivecart
# Expected: HTTP 200
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/thrivecart/route.ts
git commit -m "feat(thrivecart): add unified webhook endpoint with form-data and JSON support"
```

---

## Chunk 4: Sync Job

### Task 8: Create sync logic

**Files:**
- Create: `lib/thrivecart/sync.ts`

- [ ] **Step 1: Create the sync module**

```typescript
import { db } from '@/lib/db';
import { user, subscription, thrivecartSyncLog } from '@/lib/db/schema';
import { eq, isNotNull, desc } from 'drizzle-orm';
import { getCustomerByEmail, rateLimitDelay } from './client';
import {
  extendSubscriptionPeriod,
  reactivateUser,
  suspendUser,
  markSubscriptionCancelled,
  markSubscriptionPastDue,
} from '@/app/api/webhooks/subscription/_lib/helpers';
import type { SyncResult, SyncDiscrepancy } from './types';
import { generateId } from 'ai';

/**
 * Run a full sync of all ThriveCart subscriptions.
 * Queries each user's status from ThriveCart API and corrects discrepancies.
 */
export async function runFullSync(): Promise<SyncResult> {
  const syncId = generateId();
  const now = new Date();

  // Create sync log entry
  await db.insert(thrivecartSyncLog).values({
    id: syncId,
    startedAt: now,
    status: 'running',
  });

  const result: SyncResult = {
    totalChecked: 0,
    totalCorrected: 0,
    totalErrors: 0,
    discrepancies: [],
    errors: [],
  };

  try {
    // Fetch all users that have a ThriveCart subscription
    const usersWithSubs = await db
      .select({
        userId: user.id,
        email: user.email,
        isActive: user.isActive,
        activationStatus: user.activationStatus,
        subId: subscription.id,
        subStatus: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        thrivecardCustomerId: subscription.thrivecardCustomerId,
      })
      .from(user)
      .innerJoin(subscription, eq(subscription.userId, user.id))
      .where(isNotNull(subscription.thrivecardCustomerId))
      .orderBy(desc(subscription.currentPeriodEnd));

    // Deduplicate by userId (keep most recent subscription)
    const seen = new Set<string>();
    const uniqueUsers = usersWithSubs.filter((u) => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    });

    console.log(`[ThriveCart Sync] Starting sync for ${uniqueUsers.length} users`);

    for (const dbUser of uniqueUsers) {
      result.totalChecked++;

      try {
        // Query ThriveCart for this customer
        const tcResult = await getCustomerByEmail(dbUser.email);
        await rateLimitDelay();

        if (!tcResult.success || !tcResult.data) {
          // Customer not found in ThriveCart — might be deleted
          result.errors.push({ email: dbUser.email, error: tcResult.error || 'Not found in ThriveCart' });
          result.totalErrors++;
          continue;
        }

        const tcCustomer = tcResult.data;
        const tcPurchase = tcCustomer.purchases?.find(
          (p) => p.product_id === 5 && p.subscription
        );

        if (!tcPurchase?.subscription) {
          // No active subscription found in ThriveCart
          if (dbUser.subStatus === 'active' && !dbUser.cancelAtPeriodEnd) {
            // DB says active but ThriveCart has no subscription — mark as cancelled
            await markSubscriptionCancelled(dbUser.subId);
            result.discrepancies.push({
              userId: dbUser.userId,
              email: dbUser.email,
              field: 'subscription_status',
              dbValue: 'active',
              thriveCartValue: 'no_subscription',
              corrected: true,
            });
            result.totalCorrected++;
          }
          continue;
        }

        const tcSub = tcPurchase.subscription;

        // Compare subscription status
        if (tcSub.status === 'cancelled' && dbUser.subStatus === 'active' && !dbUser.cancelAtPeriodEnd) {
          await markSubscriptionCancelled(dbUser.subId);
          result.discrepancies.push({
            userId: dbUser.userId,
            email: dbUser.email,
            field: 'cancel_status',
            dbValue: 'active',
            thriveCartValue: 'cancelled',
            corrected: true,
          });
          result.totalCorrected++;
        }

        if (tcSub.status === 'active' && dbUser.subStatus !== 'active') {
          // ThriveCart says active but DB doesn't — reactivate
          await db
            .update(subscription)
            .set({ status: 'active', modifiedAt: new Date() })
            .where(eq(subscription.id, dbUser.subId));
          if (!dbUser.isActive) await reactivateUser(dbUser.userId);
          result.discrepancies.push({
            userId: dbUser.userId,
            email: dbUser.email,
            field: 'subscription_status',
            dbValue: dbUser.subStatus,
            thriveCartValue: 'active',
            corrected: true,
          });
          result.totalCorrected++;
        }

        // Update lastSyncedAt
        await db
          .update(subscription)
          .set({ lastSyncedAt: new Date() })
          .where(eq(subscription.id, dbUser.subId));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ email: dbUser.email, error: errorMsg });
        result.totalErrors++;
      }

      // Log progress every 50 users
      if (result.totalChecked % 50 === 0) {
        console.log(`[ThriveCart Sync] Progress: ${result.totalChecked}/${uniqueUsers.length}`);
      }
    }

    // Update sync log
    await db
      .update(thrivecartSyncLog)
      .set({
        completedAt: new Date(),
        totalChecked: result.totalChecked,
        totalCorrected: result.totalCorrected,
        totalErrors: result.totalErrors,
        details: {
          discrepancies: result.discrepancies,
          errors: result.errors,
        },
        status: 'completed',
      })
      .where(eq(thrivecartSyncLog.id, syncId));

    console.log(
      `[ThriveCart Sync] Complete: ${result.totalChecked} checked, ${result.totalCorrected} corrected, ${result.totalErrors} errors`
    );
  } catch (error) {
    await db
      .update(thrivecartSyncLog)
      .set({
        completedAt: new Date(),
        status: 'failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      })
      .where(eq(thrivecartSyncLog.id, syncId));

    throw error;
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/thrivecart/sync.ts
git commit -m "feat(thrivecart): add periodic sync logic with discrepancy detection and correction"
```

---

### Task 9: Create sync cron endpoint

**Files:**
- Create: `app/api/cron/thrivecart-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

Follow the same pattern as `app/api/cron/awardwallet-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runFullSync } from '@/lib/thrivecart/sync';

/**
 * POST /api/cron/thrivecart-sync
 * Scheduled sync for all ThriveCart subscriptions.
 * Runs every 6 hours via Vercel Cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[ThriveCart Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[ThriveCart Cron] Starting scheduled sync...');

  try {
    const result = await runFullSync();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[ThriveCart Cron] Sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minute timeout for large user bases
```

- [ ] **Step 2: Add cron schedule to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/thrivecart-sync",
  "schedule": "0 */6 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/thrivecart-sync/route.ts vercel.json
git commit -m "feat(thrivecart): add cron sync endpoint running every 6 hours"
```

---

## Chunk 5: Deployment & Activation

### Task 10: Deploy and activate

- [ ] **Step 1: Add environment variables to Vercel**

In the Vercel dashboard, add:
- `THRIVECART_API_KEY`
- `THRIVECART_SECRET_WORD`
- `THRIVECART_PRODUCT_ID` = `5`
- `THRIVECART_ACCOUNT_ID` = `never-economy-again`

- [ ] **Step 2: Deploy**

Push to main and let Vercel deploy.

- [ ] **Step 3: Verify webhook endpoint**

```bash
curl -I https://chat.never-economy-again.com/api/webhooks/thrivecart
# Expected: HTTP 200
```

- [ ] **Step 4: Configure ThriveCart webhook**

In ThriveCart:
1. Go to **Settings → API & Webhooks → Webhooks & notifications**
2. Delete the "Zapier" webhook
3. Click **"+ Add another webhook"**
4. Name: `MYLO Direct`
5. URL: `https://chat.never-economy-again.com/api/webhooks/thrivecart`
6. ThriveCart will ping the URL to verify — should succeed

- [ ] **Step 5: Test with ThriveCart test mode**

In ThriveCart, create a test purchase for the MYLO product. Verify in the logs that:
- The webhook was received
- A user was created (or subscription extended)
- The `thrivecart_webhook_log` table has the entry

- [ ] **Step 6: Run initial full sync**

Trigger manually:
```bash
curl -X POST https://chat.never-economy-again.com/api/cron/thrivecart-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Review the sync results in the `thrivecart_sync_log` table.

- [ ] **Step 7: Monitor for 1-2 weeks**

Check the webhook log and sync log regularly. After confirming stability:
- The old Zapier webhook endpoints can be removed (Task 11)

---

### Task 11: Cleanup (after 2 weeks of stable operation)

- [ ] **Step 1: Remove old Zapier webhook handlers**

Delete these files:
- `app/api/webhooks/create-user/route.ts`
- `app/api/webhooks/subscription/rebill/route.ts`
- `app/api/webhooks/subscription/cancel/route.ts`
- `app/api/webhooks/subscription/failed/route.ts`
- `app/api/webhooks/subscription/_lib/helpers.ts`
- `app/api/webhooks/subscription/_lib/types.ts`

**Important:** Do NOT delete the helpers yet if `lib/thrivecart/webhook-handler.ts` still imports from them. First refactor to inline or duplicate the needed functions, then remove.

- [ ] **Step 2: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove legacy Zapier webhook endpoints after ThriveCart direct integration"
```
