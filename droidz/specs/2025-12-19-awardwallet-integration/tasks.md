# AwardWallet Integration Tasks

## Overview
Complete task breakdown for integrating AwardWallet loyalty program tracking into MYLO Travel Concierge, following the 6-phase implementation plan from the specification.

---

## Phase 1: Foundation (Infrastructure & Core Setup)

### 1.1 Environment Configuration
- [x] Add `AWARDWALLET_API_KEY` to `env/server.ts` Zod schema
- [x] Add optional `AWARDWALLET_CALLBACK_URL` env var for local dev override
- [x] Update `.env.example` with AwardWallet variables documentation
- [x] Verify environment variables load correctly in development

**Dependencies:** None  
**Acceptance:** Environment validates without errors, API key accessible server-side

### 1.2 Database Schema & Migration
- [x] Add `awardwalletConnectionStatus` type array to `lib/db/schema.ts`
- [x] Create `awardwalletConnections` table definition with Drizzle
- [x] Add `loyaltyBalanceUnit` type array to schema
- [x] Create `loyaltyAccounts` table definition with Drizzle
- [x] Export TypeScript types (`AwardWalletConnection`, `LoyaltyAccount`)
- [x] Generate migration SQL with `bunx drizzle-kit generate`
- [x] Apply migration with `bunx drizzle-kit push`
- [x] Create indexes for performance (user_id, connection_id, balance DESC, expiration_date)

**Dependencies:** 1.1 (env vars for DB connection)  
**Acceptance:** Tables exist in database, types available for import

### 1.3 AwardWallet API Client
- [x] Create `lib/api/awardwallet-client.ts` with typed interfaces
- [x] Implement `createAuthUrl()` - generate OAuth consent URL
- [x] Implement `getConnectionInfo(code: string)` - exchange code for userId
- [x] Implement `getConnectedUser(userId: string)` - fetch all loyalty accounts
- [x] Add proper error handling with ChatSDKError patterns
- [x] Add structured logging for all API operations
- [ ] Create `lib/api/awardwallet-client.test.ts` with unit tests

**Dependencies:** 1.1 (AWARDWALLET_API_KEY)  
**Acceptance:** All API methods work, tests pass with `bunx vitest run awardwallet-client`

### 1.4 Database Query Functions
- [x] Create `lib/db/queries/awardwallet.ts` for DB operations
- [x] Implement `createConnection(userId, awUserId)` - insert new connection
- [x] Implement `getConnection(userId)` - get user's AW connection
- [x] Implement `updateConnectionStatus(id, status, errorMessage?)` 
- [x] Implement `deleteConnection(userId)` - soft delete / cascade
- [x] Implement `getLoyaltyAccounts(connectionId)` - get accounts sorted by balance
- [x] Implement `syncLoyaltyAccounts(connectionId, accounts[])` - upsert accounts
- [x] Implement `getUserLoyaltyData(userId)` - combined query for UI
- [x] Add `.$withCache()` patterns for read queries
- [ ] Create `lib/db/queries/awardwallet.test.ts` with unit tests

**Dependencies:** 1.2 (schema tables)  
**Acceptance:** All queries work, tests pass

---

## Phase 2: OAuth Flow (Authentication)

### 2.1 Auth Initiate Route
- [x] Create `app/api/awardwallet/auth/initiate/route.ts`
- [x] Validate user session with `auth()` from `@/lib/auth`
- [ ] Generate state parameter for CSRF protection
- [x] Call AwardWallet client `createAuthUrl()`
- [x] Return JSON with `authUrl` for frontend redirect
- [ ] Add Zod validation for response schema
- [x] Handle errors with proper ChatSDKError codes

**Dependencies:** 1.3 (API client), 1.4 (queries)  
**Acceptance:** Returns valid OAuth URL, requires authentication

### 2.2 Auth Callback Route
- [x] Create `app/api/awardwallet/auth/callback/route.ts`
- [x] Parse `code` and `state` query parameters with Zod
- [ ] Validate state parameter matches stored value
- [x] Call `getConnectionInfo(code)` to exchange code
- [x] Store connection in DB via `createConnection()`
- [x] Trigger initial sync of loyalty accounts
- [x] Redirect to `/?tab=loyalty#settings` on success
- [x] Redirect with `?error=connection_failed` on failure

**Dependencies:** 2.1, 1.3, 1.4  
**Acceptance:** OAuth flow completes, connection stored, user redirected

### 2.3 OAuth Integration Tests
- [ ] Test initiate route requires authentication
- [ ] Test callback handles valid code exchange
- [ ] Test callback handles invalid/expired codes
- [ ] Test state parameter validation
- [ ] Test duplicate connection handling

**Dependencies:** 2.1, 2.2  
**Acceptance:** All integration tests pass

---

## Phase 3: Data Sync (API Endpoints & Cron)

### 3.1 Accounts Endpoint
- [x] Create `app/api/awardwallet/accounts/route.ts`
- [x] Validate user session
- [x] Query user's loyalty data with `getUserLoyaltyData()`
- [x] Return accounts sorted by balance DESC
- [x] Include `connected` boolean and `lastSyncedAt` timestamp
- [x] Handle not-connected state gracefully (empty array)
- [x] Add response Zod schema validation

**Dependencies:** Phase 2 complete  
**Acceptance:** Returns loyalty accounts for connected users

### 3.2 Manual Sync Endpoint
- [x] Create `app/api/awardwallet/sync/route.ts`
- [x] Validate user session
- [x] Check for existing connection
- [x] Implement rate limiting (1 sync per 5 minutes)
- [x] Call AwardWallet API to fetch latest data
- [x] Update DB via `syncLoyaltyAccounts()`
- [x] Update `lastSyncedAt` timestamp
- [x] Return success with `syncedAt` and `accountCount`

**Dependencies:** 3.1, 1.3, 1.4  
**Acceptance:** Syncs data, respects rate limits

### 3.3 Disconnect Endpoint
- [x] Create `app/api/awardwallet/disconnect/route.ts`
- [x] Validate user session
- [x] Delete connection and cascade loyalty accounts
- [x] Return success confirmation
- [x] Handle not-connected state gracefully

**Dependencies:** 1.4  
**Acceptance:** Removes all user AW data cleanly

### 3.4 Cron Job for Scheduled Sync
- [x] Create `app/api/cron/awardwallet-sync/route.ts`
- [x] Validate `CRON_SECRET` header
- [x] Query all active connections
- [x] Iterate and sync each connection
- [x] Track success/failure counts
- [x] Log results with structured logging
- [x] Return detailed sync report
- [x] Update `vercel.json` with cron schedule (`"0 */6 * * *"`)

**Dependencies:** 3.2, 1.4  
**Acceptance:** Cron executes every 6 hours, syncs all connections

### 3.5 Data Sync Tests
- [ ] Test accounts endpoint returns correct structure
- [ ] Test sync endpoint rate limiting
- [ ] Test disconnect removes all data
- [ ] Test cron authorization validation
- [ ] Test cron handles partial failures gracefully

**Dependencies:** 3.1-3.4  
**Acceptance:** All endpoint tests pass

---

## Phase 4: UI Components (Frontend)

### 4.1 Settings Tab Structure
- [ ] Add "Loyalty Programs" tab to `components/settings-dialog.tsx`
- [ ] Use `Wallet02Icon` from `@hugeicons/core-free-icons`
- [ ] Create tab trigger with proper ordering
- [ ] Add TabsContent container for loyalty section

**Dependencies:** Phase 3 complete  
**Acceptance:** New tab visible and navigable in Settings

### 4.2 Loyalty Connect Button Component
- [ ] Create `components/awardwallet/connect-button.tsx`
- [ ] Support variants: 'default', 'outline', 'ghost'
- [ ] Support sizes: 'sm', 'default', 'lg'
- [ ] Implement states: idle, loading, redirecting
- [ ] Call `/api/awardwallet/auth/initiate` on click
- [ ] Handle redirect to OAuth consent page
- [ ] Show helpful text for users without AW account

**Dependencies:** 4.1  
**Acceptance:** Button triggers OAuth flow correctly

### 4.3 Loyalty Program Card Component
- [ ] Create `components/awardwallet/loyalty-program-card.tsx`
- [ ] Display provider logo, name, balance with unit
- [ ] Show elite status badge if present
- [ ] Show expiration date with warning styling if soon
- [ ] Support `compact` mode for header display
- [ ] Format numbers with `toLocaleString()`

**Dependencies:** None (can parallel with 4.1)  
**Acceptance:** Card renders all program data correctly

### 4.4 Loyalty Programs List Component
- [ ] Create `components/awardwallet/loyalty-programs-list.tsx`
- [ ] Fetch data with `useQuery` from TanStack Query
- [ ] Show skeleton loading state
- [ ] Show empty state for no accounts
- [ ] Render list of `LoyaltyProgramCard` components
- [ ] Add "Last synced" timestamp display
- [ ] Add manual refresh button (triggers sync endpoint)
- [ ] Add disconnect button with confirmation dialog

**Dependencies:** 4.3, 3.1  
**Acceptance:** List displays all accounts, refresh works

### 4.5 Settings Loyalty Section
- [ ] Create `components/awardwallet/settings-section.tsx`
- [ ] Show connect flow when not connected
- [ ] Show programs list when connected
- [ ] Handle error states from callback redirect
- [ ] Integrate into Settings dialog tab content

**Dependencies:** 4.2, 4.4  
**Acceptance:** Full settings experience complete

### 4.6 Loyalty Header Widget
- [ ] Create `components/awardwallet/loyalty-header-widget.tsx`
- [ ] Display top 2-3 programs (highest balances)
- [ ] Compact inline display: icons + abbreviated values
- [ ] Click opens Settings to Loyalty tab
- [ ] Hover/click expands to show details (desktop)
- [ ] Show "Connect Loyalty" button when not connected
- [ ] Responsive: collapse on mobile

**Dependencies:** 4.3, 3.1  
**Acceptance:** Widget shows in header, navigates to settings

### 4.7 Homepage Integration
- [ ] Add header widget to homepage/navbar area
- [ ] Conditionally render based on connection status
- [ ] Handle URL params for direct tab navigation
- [ ] Process `?error=connection_failed` display

**Dependencies:** 4.6  
**Acceptance:** Widget visible on homepage, error handling works

### 4.8 UI Component Tests
- [ ] Test connect button states and click handler
- [ ] Test program card renders all data variants
- [ ] Test programs list loading/empty/populated states
- [ ] Test header widget responsive behavior
- [ ] Snapshot tests for visual regression

**Dependencies:** 4.1-4.7  
**Acceptance:** All component tests pass

---

## Phase 5: AI Integration (Context & Suggestions)

### 5.1 Loyalty Context Builder
- [ ] Create `lib/ai/loyalty-context.ts`
- [ ] Define `LoyaltyContext` interface
- [ ] Implement `formatLoyaltyContextForAI()` function
- [ ] Format programs list with balance, unit, status, expiration
- [ ] Include guidance text for AI suggestions
- [ ] Handle empty/no-connection gracefully

**Dependencies:** 1.4 (queries)  
**Acceptance:** Returns properly formatted context string

### 5.2 System Prompt Integration
- [ ] Locate system prompt generation in chat flow
- [ ] Fetch user's loyalty data at chat init
- [ ] Inject loyalty context into system prompt
- [ ] Ensure context only added for connected users
- [ ] Test AI awareness of loyalty balances

**Dependencies:** 5.1  
**Acceptance:** AI knows about user's loyalty programs in responses

### 5.3 Expiration Warning Logic
- [ ] Create `lib/ai/loyalty-warnings.ts`
- [ ] Implement `getExpiringPrograms(accounts, months=6)` filter
- [ ] Implement `shouldShowExpirationWarning(userId)` with Redis check
- [ ] Implement `markExpirationWarningShown(userId)` - set 24h TTL
- [ ] Format warning message for AI to communicate

**Dependencies:** 5.1, Redis access  
**Acceptance:** Warnings shown max 1x/day, correctly identify expiring balances

### 5.4 Warning Integration
- [ ] Check for expiring programs at chat start
- [ ] Check if warning already shown today
- [ ] Inject warning into AI's first response if needed
- [ ] Mark warning as shown after display

**Dependencies:** 5.3, 5.2  
**Acceptance:** Users see expiration warnings appropriately

### 5.5 AI Integration Tests
- [ ] Test context formatting with various data
- [ ] Test empty context for non-connected users
- [ ] Test warning threshold detection
- [ ] Test daily limit on warnings
- [ ] Test AI response includes loyalty suggestions

**Dependencies:** 5.1-5.4  
**Acceptance:** All AI integration tests pass

---

## Phase 6: Testing & Polish (Final Validation)

### 6.1 End-to-End Testing
- [ ] Create `e2e/awardwallet.spec.ts` Playwright tests
- [ ] Test: User initiates connection flow
- [ ] Test: OAuth callback success path
- [ ] Test: Connected user views loyalty balances
- [ ] Test: Manual refresh triggers sync
- [ ] Test: User disconnects AwardWallet
- [ ] Test: Header widget display and navigation

**Dependencies:** All previous phases  
**Acceptance:** All E2E tests pass

### 6.2 Error Handling Review
- [ ] Verify all error states have user-friendly messages
- [ ] Test API unavailable fallback (show cached data)
- [ ] Test OAuth flow failures
- [ ] Test sync failures with retry option
- [ ] Verify error codes follow ChatSDKError patterns

**Dependencies:** 6.1  
**Acceptance:** No unhandled errors in UI

### 6.3 Mobile Responsive Testing
- [ ] Test Settings loyalty tab on mobile viewport
- [ ] Test header widget collapse behavior
- [ ] Test touch interactions for all buttons
- [ ] Verify no horizontal scroll issues
- [ ] Test in drawer vs dialog mode (mobile vs desktop)

**Dependencies:** Phase 4 complete  
**Acceptance:** Full mobile compatibility

### 6.4 Performance Optimization
- [ ] Verify DB queries use indexes effectively
- [ ] Add `.$withCache()` to read queries
- [ ] Implement optimistic updates where appropriate
- [ ] Test load time with many loyalty accounts
- [ ] Profile and optimize any slow paths

**Dependencies:** All phases  
**Acceptance:** Page loads under 2s, no jank

### 6.5 Security Audit
- [ ] Verify session validation on all routes
- [ ] Confirm user isolation (no cross-user data access)
- [ ] Validate API key never exposed to client
- [ ] Test rate limiting effectiveness
- [ ] Review OAuth state parameter implementation

**Dependencies:** All phases  
**Acceptance:** Security checklist complete

### 6.6 Documentation & Cleanup
- [ ] Add JSDoc comments to all public functions
- [ ] Update any relevant README sections
- [ ] Remove any debug logging
- [ ] Clean up unused imports
- [ ] Final lint pass: `bun run lint`
- [ ] Final type check: `bun run typecheck`

**Dependencies:** All phases  
**Acceptance:** Clean lint/typecheck, documented code

---

## Summary

| Phase | Tasks | Est. Effort |
|-------|-------|-------------|
| Phase 1: Foundation | 4 major tasks | Medium |
| Phase 2: OAuth Flow | 3 major tasks | Medium |
| Phase 3: Data Sync | 5 major tasks | Medium |
| Phase 4: UI Components | 8 major tasks | High |
| Phase 5: AI Integration | 5 major tasks | High |
| Phase 6: Testing & Polish | 6 major tasks | Medium |

**Total:** 31 parent tasks, ~100+ sub-tasks

**Critical Path:** Phase 1 → Phase 2 → Phase 3 → (Phase 4 || Phase 5) → Phase 6

---

## Commands Reference

```bash
# Development
bun run dev

# Testing
bunx vitest run                    # All tests
bunx vitest run awardwallet        # Feature-specific tests
bunx playwright test e2e/awardwallet.spec.ts  # E2E tests

# Database
bunx drizzle-kit generate          # Generate migration
bunx drizzle-kit push              # Apply migration

# Linting & Types
bun run lint
bun run typecheck
```
