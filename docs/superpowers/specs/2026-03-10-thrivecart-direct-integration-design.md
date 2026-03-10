# ThriveCart Direct Integration Design

## Problem

User subscription management currently runs through Zapier as middleware between ThriveCart and the MYLO database. This is error-prone: missed webhooks, delayed processing, and no automatic recovery when events are lost. The goal is a direct ThriveCart integration that handles all subscription lifecycle events reliably.

## Approach: Webhooks + API Sync

Two complementary mechanisms:

1. **Direct Webhooks** — ThriveCart sends events directly to our server (real-time)
2. **Periodic API Sync** — Cron job queries ThriveCart API every 6 hours (safety net)

---

## 1. Webhook Endpoint

### Route: `POST /api/webhooks/thrivecart`

Single endpoint receiving all ThriveCart events. Dispatches internally based on the `event` field.

### Events Handled

| ThriveCart Event | Action |
|---|---|
| `order.success` | Create user (if new) + start subscription (30 days) + send welcome email |
| `order.subscription_payment` | Extend subscription by 1 month, reactivate if suspended |
| `order.subscription_cancelled` | Set `cancelAtPeriodEnd = true`, access continues until period end |
| `order.rebill_failed` | Set status to `past_due`, start grace period |
| `order.subscription_paused` | Set status to `paused` |
| `order.subscription_resumed` | Reactivate to `active` |

### Authentication

Every ThriveCart webhook includes a `thrivecart_secret` field. We verify this matches our stored secret word. Requests with invalid secrets are rejected with 401.

### Payload Format

ThriveCart sends POST data as `multipart/form-data` (standard webhooks) or JSON (event subscription API). Key fields:

- `event` — event type string
- `thrivecart_secret` — secret word for verification
- `customer.email` — customer email address
- `customer.name`, `customer.firstname`, `customer.lastname`
- `order_id`, `invoice_id`, `customer_id`
- `order.total` — amount in cents (divide by 100)
- `currency` — 3-letter currency code
- `base_product` — product ID (5 for MYLO)

### Idempotency

Use `order_id` + `event` as idempotency key. Store processed event IDs to prevent duplicate processing (important for webhook retries).

### Response

Must return HTTP 2xx to acknowledge receipt. ThriveCart may retry on non-2xx responses.

---

## 2. API Sync Job

### Route: `GET /api/cron/thrivecart-sync`

Triggered every 6 hours via Vercel Cron or external scheduler. Protected by a cron secret header.

### Process

1. Fetch all users with ThriveCart subscriptions from the database
2. For each user, query ThriveCart API: `POST https://thrivecart.com/api/external/` with customer email
3. Compare ThriveCart subscription status with database status
4. Correct discrepancies:
   - Subscription cancelled in ThriveCart but active in DB → mark cancelled
   - Subscription active in ThriveCart but expired in DB → extend period
   - Payment failed in ThriveCart but not reflected in DB → mark past_due
5. Log sync results

### Rate Limiting

ThriveCart API: 60 requests/minute. With ~566 users, sync takes ~10 minutes. Requests are batched with delays to stay within limits.

### API Authentication

```
Authorization: Bearer {THRIVECART_API_KEY}
```

---

## 3. Database Changes

### Existing Schema (no changes needed)

The `subscription` table already has:
- `thrivecardCustomerId`, `thrivecardSubscriptionId`
- `status` (active, past_due, canceled, expired, trialing)
- `currentPeriodStart`, `currentPeriodEnd`
- `cancelAtPeriodEnd`, `canceledAt`
- `gracePeriodEnd`
- `lastPaymentDate`, `nextPaymentDate`

The `payment` table already has:
- `thrivecardPaymentId`, `thrivecardCustomerId`
- `paymentProvider`, `webhookSource`

### New Fields

**`subscription` table:**
- `lastSyncedAt` (timestamp, nullable) — last time the sync job verified this subscription against ThriveCart

**`payment` table:**
- `syncSource` (text, nullable) — 'webhook' | 'sync' | 'manual' — how this payment record was created

### New Table: `thrivecart_webhook_log`

For idempotency and debugging:
- `id` (text, primary key)
- `eventType` (text) — e.g. 'order.success'
- `eventId` (text) — ThriveCart event ID for deduplication
- `orderId` (text)
- `customerEmail` (text)
- `payload` (jsonb) — raw webhook payload
- `processedAt` (timestamp)
- `result` (text) — 'success' | 'error' | 'skipped'
- `errorMessage` (text, nullable)

### New Table: `thrivecart_sync_log`

For sync job tracking:
- `id` (text, primary key)
- `startedAt` (timestamp)
- `completedAt` (timestamp, nullable)
- `totalChecked` (integer)
- `totalCorrected` (integer)
- `totalErrors` (integer)
- `details` (jsonb) — per-user sync results
- `status` (text) — 'running' | 'completed' | 'failed'

---

## 4. Environment Variables

```
THRIVECART_API_KEY=...                    # API key for REST API queries
THRIVECART_SECRET_WORD=...                # Secret word for webhook verification
THRIVECART_PRODUCT_ID=5                   # MYLO product ID
THRIVECART_ACCOUNT_ID=never-economy-again # Account identifier
THRIVECART_SYNC_CRON_SECRET=...           # Secret to protect cron endpoint
```

---

## 5. Admin Dashboard Extensions

Extend the existing User Management page with:

### Sync Status Panel
- Last sync timestamp and result (success/failed)
- Count: users checked, corrected, errors
- "Sync Now" button (triggers manual full sync)
- "Sync User" button on individual user rows

### Webhook Event Log
- Filterable list of recent webhook events
- Columns: timestamp, event type, customer email, result, error message
- Useful for debugging missed or failed events

---

## 6. Migration & Rollout

### Phase 1: Build & Test
- Implement new webhook endpoint and sync job
- Test with ThriveCart test mode transactions

### Phase 2: Switch Webhooks
- Delete "Zapier" webhook in ThriveCart dashboard
- Add new webhook pointing to `https://{domain}/api/webhooks/thrivecart`
- Keep old Zapier endpoints as temporary fallback

### Phase 3: Initial Sync
- Run full sync to align all existing user data with ThriveCart
- Verify all subscription statuses match

### Phase 4: Monitor & Clean Up
- Monitor webhook logs and sync results for 2 weeks
- Remove old Zapier webhook endpoints after confirmed stability

---

## 7. Key Files

### New Files
- `app/api/webhooks/thrivecart/route.ts` — unified webhook endpoint
- `app/api/cron/thrivecart-sync/route.ts` — periodic sync job
- `lib/thrivecart/client.ts` — ThriveCart API client (REST calls)
- `lib/thrivecart/webhook-handler.ts` — event processing logic
- `lib/thrivecart/sync.ts` — sync job logic
- `lib/thrivecart/types.ts` — TypeScript types for ThriveCart payloads
- `lib/db/schema-thrivecart.ts` — new tables (webhook_log, sync_log)

### Modified Files
- `lib/db/schema.ts` — add `lastSyncedAt` to subscription, `syncSource` to payment
- `env/server.ts` — add new environment variables
- Admin dashboard components — add sync status panel and event log

### Files to Eventually Remove
- `app/api/webhooks/create-user/route.ts`
- `app/api/webhooks/subscription/rebill/route.ts`
- `app/api/webhooks/subscription/cancel/route.ts`
- `app/api/webhooks/subscription/failed/route.ts`
- `app/api/webhooks/subscription/_lib/` (helpers, types)

---

## 8. Subscription Lifecycle Rules

### Initial Purchase
- User created with `isActive = true`, `activationStatus = 'active'`
- Subscription: `status = 'active'`, `currentPeriodEnd = now + 30 days`

### Successful Rebill
- Extend `currentPeriodEnd` by 1 month from current end date (or now, whichever is later)
- If user was suspended: reactivate (`isActive = true`, `activationStatus = 'active'`)
- Record payment entry

### Cancellation
- Set `cancelAtPeriodEnd = true`, `canceledAt = now`
- User retains access until `currentPeriodEnd`
- Example: Cancelled on March 15, last payment on March 1 → access until April 1

### Payment Failed
- Set subscription status to `past_due`
- Calculate `gracePeriodEnd = now + GRACE_PERIOD_DAYS`
- If `GRACE_PERIOD_DAYS = 0`: suspend user immediately
- If `GRACE_PERIOD_DAYS > 0`: user retains access during grace period

### Period Expiration
- Checked at login via `checkUserAccess()`
- If `currentPeriodEnd < now` and no active subscription: block access
- Redirect to subscription-expired page
