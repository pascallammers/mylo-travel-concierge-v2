---
title: "fix: ThriveCart Data Integrity — Cleanup, Auto-Sync, Amount Normalization"
type: fix
status: active
date: 2026-04-02
deepened: 2026-04-02
---

# ThriveCart Data Integrity — Cleanup, Auto-Sync, Amount Normalization

## Overview

The ThriveCart webhook handler has been creating MYLO user accounts for every product purchase since 11.03.2026, not just MYLO (product ID 5). This produced 345 invalid active subscriptions. Additionally, ~200 Zapier-era users have cancelled in ThriveCart but remain active in our DB, and subscription amounts are stored inconsistently (mix of cents, "hundreds", and euros). The KPI dashboard shows 792 active subscribers when the real number is ~247 (matching ThriveCart).

This plan fixes the root cause (already deployed), cleans the database to match ThriveCart as source of truth, introduces automatic transaction recording via webhooks (eliminating manual imports), normalizes amounts, and adds an archive system for cancelled subscriptions.

## Problem Frame

Three interlocking problems:

1. **345 users got free MYLO access** — the webhook handler's `|| purchases?.[0]` fallback created accounts for any ThriveCart purchase. Fix already deployed (`4b058ba`).

2. **DB is out of sync with ThriveCart** — 796 active subs in DB vs 247 in ThriveCart. The 6-hour sync cron (`thrivecart-sync`) produces empty logs, suggesting it fails silently. The transaction import cron hasn't run since 13.03.

3. **Amount chaos** — subscriptions store amounts as 4900 (TC "hundreds"), 4700, 47, 7, 0, and other values depending on which code path created them. The KPI page MRR is correct (sourced from transaction table) but subscriber count is wrong (sourced from subscription table).

## Requirements Trace

- R1. Database active subscriber count matches ThriveCart active subscriber count (~247)
- R2. No user receives MYLO access without purchasing MYLO product (ID 5) — already fixed
- R3. Cancelled subscriptions are soft-archived (moved to `archive_subscription`, user stays in main table with `is_active=false`)
- R4. Webhook handler writes transactions directly to `thrivecart_transaction` table — no separate cron import needed
- R5. All subscription amounts are stored consistently in cents (4700 = €47.00)
- R6. KPI dashboard shows correct numbers based on clean data
- R7. Automated archiving: when a subscription is cancelled and expires, it moves to archive table automatically
- R8. Transaction import cron becomes a safety-net sync, not the primary data path

## Scope Boundaries

- NOT changing the ThriveCart product setup or pricing
- NOT rebuilding the KPI dashboard UI — only fixing its data source
- NOT touching the Zapier `/api/webhooks/create-user` endpoint (deprecated, should be disabled separately)
- NOT migrating away from the current subscription model

## Context & Research

### Relevant Code and Patterns

- `lib/thrivecart/webhook-handler.ts` — event dispatcher, already has `handleOrderSuccess`, `handleSubscriptionPayment`, etc.
- `lib/thrivecart/transaction-import.ts` — `mapTransaction()` function maps TC API transactions to DB rows, filters by `MYLO_PRODUCT_ID`
- `lib/thrivecart/sync.ts` — `runFullSync()` iterates all users, queries TC API per email, corrects discrepancies
- `lib/thrivecart/kpi.ts` — `computeKPIs()` uses `thriveCartTransaction` table for revenue, `subscription` table for active count
- `lib/db/schema.ts` — `subscription` table uses `pgTable`, amounts stored as `integer('amount')`
- `app/api/webhooks/subscription/_lib/helpers.ts` — shared helpers: `extendSubscriptionPeriod`, `reactivateUser`, `suspendUser`, `markSubscriptionCancelled`, `revokeUserAccessImmediately`
- `vercel.json` — crons: `thrivecart-sync` every 6h, `thrivecart-transactions` daily at 3am

### Amount Storage Reality

| Table | Column | Current Unit | How stored | Example |
|-------|--------|-------------|------------|---------|
| `subscription` | `amount` | **euros** (integer) | `Math.round(tcAmount / 100)` | 47 |
| `subscription` (Zapier-era) | `amount` | **raw TC value or 0** | inconsistent | 4900, 4700, 0 |
| `payment` | `totalAmount` | **cents** (lossy) | `Math.round(tcAmount / 100) * 100` | 4700 |
| `thriveCartTransaction` | `amount` | **cents** (correct) | raw from TC API | 4700 |

Key issues:
- `subscription.amount` stores euros (47) for direct-webhook-created subs, but Zapier-era stored raw TC values (4900) or zero
- `payment.totalAmount` has a rounding bug: `Math.round(x/100)*100` loses precision for non-round amounts (e.g., 4950 → 5000)
- `thriveCartTransaction.amount` is the only consistently correct field (raw cents from API)

### Subscription Cancellation Lifecycle (Critical for Archive Logic)

`markSubscriptionCancelled()` does NOT change `subscription.status`. It only sets `cancelAtPeriodEnd=true` and `canceledAt=now`. The subscription stays `status='active'` until the 6-hourly cron finds `currentPeriodEnd < now` and sets `status='expired'`. This means:
- A "cancelled" user still has `status='active'` with `cancelAtPeriodEnd=true`
- Archive logic must check BOTH `status` and `cancelAtPeriodEnd` + `currentPeriodEnd`

### Multiple Subscriptions per User

No unique constraint on `userId` in the subscription table. Both `sync.ts` and helpers use `ORDER BY currentPeriodEnd DESC LIMIT 1` to get the "latest" subscription. The cleanup and archive logic must handle multiple subs per user.

### DB Column Naming

Mixed conventions: `user` table uses snake_case (`is_active`, `created_at`), `subscription` table uses camelCase (`userId`, `createdAt`, `canceledAt`). Plan must use correct column names per table.

## Key Technical Decisions

- **ThriveCart is the single source of truth** for subscription status. Our DB mirrors it, not the other way around.
- **Soft-archive strategy**: cancelled subscriptions move to `archive_subscription` table. User record stays in `user` table with `is_active=false`. If user re-purchases, they get reactivated with a new subscription.
- **Amounts stored in cents consistently**: all subscription amounts normalized to cents (4700 = €47.00). The KPI page reads revenue from `thriveCartTransaction` (already cents, divides by 100 for display). The `subscription.amount` field is currently in euros for direct-webhook subs — must be migrated to cents for consistency.
- **Webhook writes transactions directly**: eliminates the gap between webhook events and transaction table, making KPI data real-time instead of daily-batch.
- **Transaction import cron becomes backup**: still runs daily to catch any missed events, but is no longer the primary data path.

## Open Questions

### Resolved During Planning

- **Archive table schema**: Mirror the `subscription` table schema plus `archived_at` timestamp and `archive_reason` field.
- **Amount normalization direction**: Normalize TO cents (not euros), because TC API and transaction table already use cents, and the KPI page already divides by 100. Current `subscription.amount` stores euros for direct-webhook subs — these get multiplied by 100. Zapier-era subs with raw TC values (4900, 4700) are already in cents.
- **Cancellation status handling**: `markSubscriptionCancelled()` only sets `cancelAtPeriodEnd=true`, status stays 'active'. Archive logic must check both `cancelAtPeriodEnd` AND `currentPeriodEnd < now`.
- **What happens to the thrivecart-sync cron?**: Keep it but fix it — it serves as the 6-hourly reconciliation safety net.

### Deferred to Implementation

- **Exact list of Zapier-era users to deactivate**: determined at runtime by querying each against TC API
- **Whether the deprecated `/api/webhooks/create-user` endpoint still receives traffic**: check Vercel logs during implementation

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW (AFTER)                        │
│                                                             │
│  ThriveCart ──webhook──▶ /api/webhooks/thrivecart           │
│                              │                              │
│                              ├──▶ user table (create/update)│
│                              ├──▶ subscription table        │
│                              └──▶ thrivecart_transaction ◄──NEW   │
│                                                             │
│  Cron (daily) ──▶ transaction-import (safety net only)      │
│  Cron (6h)   ──▶ thrivecart-sync (reconciliation)          │
│                      └──▶ archive expired subs              │
│                                                             │
│  KPI Page reads from:                                       │
│    - thrivecart_transaction (revenue, MRR)                  │
│    - subscription table (active count) ◄── now accurate     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Units

### Phase 1: Database Schema & Cleanup

- [ ] **Unit 1: Create archive_subscription table + migration**

  **Goal:** Add the archive table and archive_reason enum for soft-archiving cancelled subscriptions.

  **Requirements:** R3, R7

  **Dependencies:** None

  **Files:**
  - Create: `drizzle/migrations/XXXX_add_archive_subscription.sql`
  - Modify: `lib/db/schema.ts`

  **Approach:**
  - Add `archive_subscription` table mirroring `subscription` columns plus `archived_at` (timestamp, not null) and `archive_reason` (text: 'cancelled', 'refunded', 'expired', 'cleanup')
  - Add drizzle schema definition alongside existing subscription schema
  - Run migration against Neon

  **Patterns to follow:**
  - Existing migration style in `drizzle/migrations/`
  - Schema definition pattern in `lib/db/schema.ts`

  **Test scenarios:**
  - Happy path: migration creates table with all expected columns and constraints
  - Edge case: table can store a subscription row copied from the subscription table with additional archive fields

  **Verification:**
  - `archive_subscription` table exists in Neon with correct schema
  - Drizzle schema reflects the new table

- [ ] **Unit 2: Run full ThriveCart reconciliation + cleanup SQL**

  **Goal:** Bring DB in sync with ThriveCart. Deactivate all users who don't have an active MYLO subscription in TC. Archive their subscriptions.

  **Requirements:** R1, R3

  **Dependencies:** Unit 1

  **Files:**
  - Create: `scripts/reconcile-thrivecart.ts`

  **Approach:**
  - Script fetches every active user from MYLO DB
  - For each: query ThriveCart API by email for product 5 active subscription
  - If no active MYLO sub in TC: copy subscription to `archive_subscription` (reason: 'cleanup'), set subscription status to 'canceled', set user `is_active=false`
  - Rate-limit TC API calls (1.1s delay per request)
  - Log every action with before/after state
  - Support `--dry-run` flag for safe preview
  - Support `--batch-size` for chunked processing (TC API rate limits)

  **Patterns to follow:**
  - `lib/thrivecart/sync.ts:runFullSync()` for TC API query pattern
  - `lib/thrivecart/client.ts:getCustomerByEmail()` for API calls
  - `app/api/webhooks/subscription/_lib/helpers.ts` for user deactivation helpers

  **Test scenarios:**
  - Happy path: user with active TC sub stays active, user without gets archived
  - Edge case: user exists in DB but not in TC at all (treat as no active sub)
  - Edge case: user has TC sub for different product (not 5) — still deactivate
  - Error path: TC API returns error for a user — skip and log, don't fail entire run
  - Happy path: `--dry-run` mode logs actions without modifying DB

  **Verification:**
  - After dry run: report shows expected deactivation count close to ~545 (345 fake + ~200 cancelled Zapier-era)
  - After real run: active subscription count matches ThriveCart (~247)
  - `archive_subscription` table has rows for all deactivated subscriptions

- [ ] **Unit 3: Normalize subscription amounts to cents**

  **Goal:** Fix inconsistent amount storage. All amounts become cents.

  **Requirements:** R5

  **Dependencies:** Unit 2 (run after cleanup so we only fix remaining active subs)

  **Files:**
  - Create: `scripts/normalize-amounts.sql`
  - Modify: `lib/thrivecart/webhook-handler.ts` (fix `createSubscription` helper)

  **Approach:**
  - SQL script to normalize remaining active subscriptions to cents:
    - amount between 1-999 (stored in euros): multiply by 100 (47 → 4700, 36 → 3600, etc.)
    - amount = 4900 (old €49 price in cents): leave as-is or update to 4700 if current price is €47
    - amount = 4700 (correct cents): leave as-is
    - amount = 0: leave as 0 (legacy free/missing data)
  - Fix `createSubscription` in webhook-handler: remove the `Math.round(opts.amount / 100)` division — TC sends cents, store as cents directly
  - Fix `recordPayment`: replace `Math.round(opts.amount / 100) * 100` (lossy rounding) with direct `opts.amount` storage
  - Any code reading `subscription.amount` for display must be checked — currently nothing divides by 100 for display since it was stored in euros. After migration to cents, display code needs `/100`

  **Patterns to follow:**
  - `thrivecart_transaction` table already stores amounts in cents correctly

  **Test scenarios:**
  - Happy path: subscription with amount=47 becomes 4700 after normalization
  - Happy path: subscription with amount=4900 becomes 4700
  - Edge case: subscription with amount=0 remains 0 (free/legacy)
  - Happy path: new webhook creates subscription with amount in cents (no double-division)

  **Verification:**
  - No active subscription has an amount between 1-999 (would indicate euros, not cents)
  - New webhook-created subscriptions store TC's amount value directly

### Phase 2: Webhook Transaction Recording

- [ ] **Unit 4: Webhook handler writes to thrivecart_transaction table**

  **Goal:** Every webhook event automatically records a transaction, making KPI data real-time.

  **Requirements:** R4, R8

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `lib/thrivecart/webhook-handler.ts`

  **Approach:**
  - Add a `recordTransaction()` helper that maps webhook payload to `thrivecart_transaction` insert
  - Call it from `handleOrderSuccess`, `handleSubscriptionPayment`, `handleRefund`, `handleRebillFailed`, `handleSubscriptionCancelled`
  - Use `onConflictDoNothing` on `eventId` for idempotency (same pattern as transaction-import)
  - Only record for MYLO product (base_product check already in place)
  - Map webhook `event_id` to transaction `eventId`, `event` type to `transactionType`

  **Patterns to follow:**
  - `lib/thrivecart/transaction-import.ts:mapTransaction()` for field mapping
  - Existing `onConflictDoNothing({ target: thriveCartTransaction.eventId })` pattern

  **Test scenarios:**
  - Happy path: `order.success` for product 5 creates a 'charge' transaction row
  - Happy path: `order.subscription_payment` creates a 'rebill' transaction row
  - Happy path: `order.refund` creates a 'refund' transaction row with negative amount
  - Happy path: `order.subscription_cancelled` creates a 'cancel' transaction row
  - Edge case: duplicate webhook (same event_id) does not create duplicate transaction
  - Edge case: non-MYLO product webhook does not create transaction row

  **Verification:**
  - After a webhook fires, the corresponding transaction appears in `thrivecart_transaction`
  - KPI dashboard reflects the transaction without waiting for the daily cron

### Phase 3: Automated Archiving & Sync Fix

- [ ] **Unit 5: Auto-archive expired subscriptions in sync cron**

  **Goal:** The 6-hourly sync cron automatically archives cancelled/expired subscriptions.

  **Requirements:** R7

  **Dependencies:** Unit 1, Unit 4

  **Files:**
  - Modify: `lib/thrivecart/sync.ts`
  - Modify: `app/api/webhooks/subscription/_lib/helpers.ts`

  **Approach:**
  - Add `archiveSubscription(subId, reason)` helper that copies row to `archive_subscription`, then deletes from `subscription`
  - In `runFullSync()`: after checking TC status, if subscription has `cancelAtPeriodEnd=true` AND `currentPeriodEnd` is past, OR `status` is 'expired' or 'canceled' → archive it
  - In webhook handlers: when `revokeUserAccessImmediately` fires (refund) → archive immediately. When `markSubscriptionCancelled` fires → do NOT archive yet (user has access until period end; cron will archive after expiry)
  - Add `deactivateExpiredUsers` enhancement: also archive the subscription, not just deactivate the user

  **Patterns to follow:**
  - Existing `markSubscriptionCancelled`, `revokeUserAccessImmediately` in helpers.ts
  - `runFullSync()` discrepancy correction pattern

  **Test scenarios:**
  - Happy path: subscription with `cancelAtPeriodEnd=true` AND `currentPeriodEnd < now` gets archived on next sync
  - Edge case: subscription with `cancelAtPeriodEnd=true` but `currentPeriodEnd` still in future stays in main table (user still has access)
  - Happy path: subscription with `status='expired'` gets archived on next sync
  - Happy path: refunded subscription gets archived immediately (no grace period)
  - Integration: webhook cancellation + next sync run → subscription moves to archive
  - Edge case: user with archived subscription re-purchases → new subscription created in main table, user reactivated

  **Verification:**
  - After sync cron runs, no cancelled+expired subscriptions remain in main `subscription` table
  - `archive_subscription` has the moved rows with correct `archive_reason`

- [ ] **Unit 6: Fix thrivecart-sync cron reliability**

  **Goal:** The 6-hourly sync actually runs and logs results.

  **Requirements:** R1 (ongoing)

  **Dependencies:** Unit 5

  **Files:**
  - Modify: `lib/thrivecart/sync.ts`
  - Modify: `app/api/cron/thrivecart-sync/route.ts`

  **Approach:**
  - Investigate why sync logs are empty (likely: the sync queries every user against TC API, hits rate limits or timeouts on the 300s Vercel function limit)
  - Add batch processing with configurable batch size
  - Add proper logging to `thrivecart_sync_log` table after each run
  - Add error recovery: if a batch fails, log and continue with next batch
  - Consider: only sync users with `is_active=true` (skip already-deactivated)

  **Patterns to follow:**
  - `transaction-import.ts` retry and rate-limit pattern
  - `thrivecart_sync_log` table structure

  **Test scenarios:**
  - Happy path: sync completes within 300s Vercel timeout for ~250 active users
  - Edge case: TC API rate limit hit mid-sync — logs partial results, continues next run
  - Happy path: sync log entry created with correct totals
  - Error path: TC API completely down — sync logs error, doesn't crash

  **Verification:**
  - `thrivecart_sync_log` has entries after cron runs
  - Sync corrects any discrepancies found (e.g., user cancelled in TC but still active in DB)

### Phase 4: KPI Dashboard Accuracy

- [ ] **Unit 7: KPI active subscriber count from clean data**

  **Goal:** KPI dashboard shows accurate numbers now that the data is clean.

  **Requirements:** R6

  **Dependencies:** Units 2, 3, 4

  **Files:**
  - Modify: `lib/thrivecart/kpi.ts`

  **Approach:**
  - `totalActiveSubscribers` query already reads from `subscription` table with `status = 'active'` — after cleanup, this is correct
  - Verify MRR calculation: currently `arpu * totalActiveSubscribers` based on last month's transactions — after transaction recording in webhook, this becomes real-time
  - Add import state check: show warning if last import/webhook transaction is older than 48 hours
  - Consider: add a "data freshness" indicator showing when the last transaction was recorded

  **Patterns to follow:**
  - Existing `computeKPIs()` structure

  **Test scenarios:**
  - Happy path: active subscriber count matches ThriveCart after cleanup
  - Happy path: MRR reflects last month's transaction revenue divided by active subscribers
  - Edge case: no transactions in current month — MRR falls back to previous month

  **Verification:**
  - KPI page shows ~247 active subscribers (matching ThriveCart)
  - MRR figure is consistent between KPI page and ThriveCart dashboard

## System-Wide Impact

- **Interaction graph:** Webhook handler → subscription table → archive table → KPI calculation. The sync cron and transaction import cron also read/write subscription and transaction tables.
- **Error propagation:** Webhook failures are logged in `thrivecart_webhook_log`. Transaction recording failures in the webhook should NOT block user creation (secondary concern).
- **State lifecycle risks:** During the cleanup script, user sessions may be invalidated if `is_active` check is in the auth middleware. Users who are mid-session and get deactivated will be logged out on next request. This is acceptable since they shouldn't have access.
- **API surface parity:** The admin ThriveCart page (`app/admin/thrivecart/`) reads from subscription and sync tables — it will automatically reflect the cleanup.
- **Unchanged invariants:** The auth system, chat functionality, and all other features remain unchanged. Only subscription lifecycle and KPI data sources are affected.
- **Multiple subscriptions per user:** No unique constraint on `userId` in subscription table. Cleanup and archive must handle all subs per user, not just the latest.
- **Legacy Zapier endpoints still exist:** `/api/webhooks/subscription/{rebill,cancel,failed}` share helpers but use different auth (`WEBHOOK_SECRET`), amount conventions (euros), and idempotency (orderId). If Zapier is still active alongside direct webhooks, duplicate events are possible. Consider disabling Zapier path after confirming direct webhooks are stable.
- **Column naming:** `thrivecardCustomerId` (typo: "card" not "cart") is used throughout — maintain this naming for consistency.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| TC API rate limiting during bulk reconciliation | Batch processing with 1.1s delay, resumable script |
| Deactivating a legitimate paying customer by mistake | Dry-run mode first, cross-reference TC API per-user |
| Vercel 300s function timeout for sync cron | Batch processing, only sync active users |
| Amount normalization script miscategorizes edge cases | Run on staging/dry-run first, manual review of edge cases |
| Webhook transaction recording adds latency to user creation | Use fire-and-forget pattern, don't block on transaction insert |

## Sources & References

- Investigation: commit `4b058ba` (webhook product filter fix)
- ThriveCart API docs: `/api/external/customer`, `/api/external/transactions`
- Cleanup SQL prepared: `scripts/cleanup-wrong-users.sql`
- Existing cron config: `vercel.json`
