# AwardWallet Integration Specification

## 1. Feature Overview & Objectives

### 1.1 Purpose

Integrate AwardWallet's loyalty program tracking capabilities into MYLO Travel Concierge, enabling users to:
- Connect their AwardWallet account via OAuth2
- View aggregated loyalty program balances (miles, points, hotel nights)
- Receive AI-powered proactive suggestions based on their balances
- Get expiration warnings for points/miles nearing expiry

### 1.2 Business Goals

1. **Enhanced User Experience**: Provide a unified view of travel loyalty balances
2. **AI-Powered Recommendations**: Leverage balance data for intelligent travel suggestions
3. **Increased Engagement**: Keep users informed about their rewards across programs
4. **Differentiation**: Unique value proposition compared to competitors

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Connection Rate | 40% of active users | Users with active AW connection / Total active users |
| Balance Sync Success | >98% | Successful syncs / Total sync attempts |
| AI Suggestion CTR | >15% | Clicks on loyalty-based suggestions / Total suggestions shown |
| User Retention Impact | +10% | 30-day retention for connected vs non-connected users |

---

## 2. User Stories & Acceptance Criteria

### 2.1 User Story: Initial Connection

**As a** MYLO user  
**I want to** connect my AwardWallet account  
**So that** I can see all my loyalty balances in one place

**Acceptance Criteria:**
- [ ] User can access AwardWallet connection from Settings dialog (new "Loyalty Programs" section)
- [ ] User can access AwardWallet connection from homepage quick-action button
- [ ] If user has no AwardWallet account, show info hint with link to AwardWallet registration
- [ ] OAuth consent flow redirects user to AwardWallet authorization page
- [ ] After successful OAuth, user is redirected back to MYLO with connection status
- [ ] Connection status persists across sessions
- [ ] Error states are handled gracefully with actionable messages

### 2.2 User Story: Viewing Balances

**As a** connected MYLO user  
**I want to** view my loyalty program balances  
**So that** I can understand my available rewards

**Acceptance Criteria:**
- [ ] Header displays top 2-3 programs with highest balances (compact view)
- [ ] Program icons/logos shown alongside point values
- [ ] Clicking header opens detailed view in Settings
- [ ] Settings shows all programs sorted by highest balance first
- [ ] Each program displays: name, logo, balance, unit type, elite status (if any), expiration date
- [ ] Last sync timestamp is visible
- [ ] Manual refresh button triggers immediate sync

### 2.3 User Story: Data Refresh

**As a** connected MYLO user  
**I want to** have my balances automatically updated  
**So that** I always see current information

**Acceptance Criteria:**
- [ ] Balances auto-refresh every 6 hours via cron job
- [ ] Manual refresh button available in Settings
- [ ] During refresh: show loading state, disable refresh button
- [ ] After refresh: update all displayed values, show success toast
- [ ] On refresh failure: show error toast, allow retry

### 2.4 User Story: AI-Powered Suggestions

**As a** connected MYLO user  
**I want to** receive intelligent suggestions based on my balances  
**So that** I can maximize my rewards

**Acceptance Criteria:**
- [ ] AI has full context of all loyalty balances when generating responses
- [ ] AI proactively suggests redemption opportunities (e.g., "You have enough miles for Business Class to Bangkok")
- [ ] AI can compare cash vs miles pricing when relevant
- [ ] Expiration warnings shown at chat start (max 1x per day per user)
- [ ] Suggestions are contextually relevant to user's travel queries

### 2.5 User Story: Disconnection

**As a** connected MYLO user  
**I want to** disconnect my AwardWallet account  
**So that** I can revoke access if needed

**Acceptance Criteria:**
- [ ] Disconnect button available in Settings
- [ ] Confirmation dialog before disconnect
- [ ] On disconnect: remove all cached balance data
- [ ] Homepage reverts to "Connect" button after disconnect

---

## 3. Technical Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MYLO Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │  Frontend   │    │   API Routes    │    │   Cron Jobs      │   │
│  │  (React)    │◄──►│   (Next.js)     │◄──►│   (Vercel)       │   │
│  └─────────────┘    └────────┬────────┘    └────────┬─────────┘   │
│                              │                       │             │
│                              ▼                       ▼             │
│                    ┌─────────────────────────────────────┐        │
│                    │        AwardWallet Service          │        │
│                    │    (lib/api/awardwallet-client.ts)  │        │
│                    └─────────────────┬───────────────────┘        │
│                                      │                             │
│                                      ▼                             │
│                    ┌─────────────────────────────────────┐        │
│                    │         PostgreSQL (Neon)           │        │
│                    │  - awardwallet_connections          │        │
│                    │  - loyalty_accounts                 │        │
│                    └─────────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │        AwardWallet API              │
                    │  business.awardwallet.com/api/      │
                    │  - OAuth2 Flow                      │
                    │  - Account Data Retrieval           │
                    └─────────────────────────────────────┘
```

### 3.2 Data Flow

#### OAuth Connection Flow
```
1. User clicks "Connect AwardWallet"
2. Frontend calls POST /api/awardwallet/auth/initiate
3. Backend calls AwardWallet /create-auth-url
4. User redirected to AwardWallet OAuth consent
5. User approves, redirected to /api/awardwallet/auth/callback
6. Backend calls /get-connection-info/{code}
7. Backend stores userId in awardwallet_connections
8. Backend calls /get-connected-user/{userId} for initial sync
9. Loyalty accounts stored in loyalty_accounts table
10. User redirected to Settings with success message
```

#### Balance Refresh Flow
```
1. Cron job runs every 6 hours OR user clicks "Refresh"
2. Backend iterates active connections
3. For each: call /get-connected-user/{userId}
4. Parse response, update loyalty_accounts
5. Update last_synced_at timestamp
6. Clear any stale cache entries
```

### 3.3 Component Structure

```
lib/
├── api/
│   └── awardwallet-client.ts      # AwardWallet API client
├── db/
│   └── queries/
│       └── awardwallet.ts         # Database queries for AW data

app/
├── api/
│   └── awardwallet/
│       ├── auth/
│       │   ├── initiate/route.ts  # Start OAuth flow
│       │   └── callback/route.ts  # Handle OAuth callback
│       ├── accounts/route.ts      # Get user's loyalty accounts
│       ├── sync/route.ts          # Manual sync trigger
│       └── disconnect/route.ts    # Remove connection
├── cron/
│   └── awardwallet-sync/route.ts  # Scheduled sync endpoint

components/
├── awardwallet/
│   ├── connect-button.tsx         # OAuth connect trigger
│   ├── loyalty-header.tsx         # Compact header display
│   ├── loyalty-programs-list.tsx  # Full list in Settings
│   └── loyalty-program-card.tsx   # Individual program card
```

---

## 4. API Contracts (Internal Routes)

### 4.1 POST /api/awardwallet/auth/initiate

**Purpose:** Generate AwardWallet OAuth consent URL

**Request:**
```typescript
// No body required - uses authenticated session
Headers: {
  Cookie: session token
}
```

**Response:**
```typescript
// Success (200)
{
  authUrl: string;  // AwardWallet OAuth consent URL
}

// Error (401)
{
  code: "unauthorized:auth";
  message: "You need to sign in before continuing.";
}

// Error (500)
{
  code: "bad_request:api";
  message: "Failed to generate authorization URL";
  cause?: string;
}
```

### 4.2 GET /api/awardwallet/auth/callback

**Purpose:** Handle OAuth callback from AwardWallet

**Request:**
```typescript
Query Parameters: {
  code: string;   // OAuth authorization code
  state?: string; // Optional state parameter
}
```

**Response:**
```typescript
// Success: Redirect to /?tab=loyalty#settings

// Error: Redirect to /?tab=loyalty&error=connection_failed#settings
```

### 4.3 GET /api/awardwallet/accounts

**Purpose:** Retrieve user's loyalty accounts

**Request:**
```typescript
Headers: {
  Cookie: session token
}
```

**Response:**
```typescript
// Success (200)
{
  connected: boolean;
  lastSyncedAt: string | null;
  accounts: Array<{
    id: string;
    providerCode: string;
    providerName: string;
    balance: number;
    balanceUnit: "miles" | "points" | "nights" | "credits";
    eliteStatus: string | null;
    expirationDate: string | null;
    accountNumber: string | null;
    logoUrl: string | null;
  }>;
}

// Not Connected (200)
{
  connected: false;
  lastSyncedAt: null;
  accounts: [];
}

// Error (401)
{
  code: "unauthorized:auth";
  message: "You need to sign in before continuing.";
}
```

### 4.4 POST /api/awardwallet/sync

**Purpose:** Trigger manual balance sync

**Request:**
```typescript
Headers: {
  Cookie: session token
}
```

**Response:**
```typescript
// Success (200)
{
  success: true;
  syncedAt: string;
  accountCount: number;
}

// Not Connected (400)
{
  code: "bad_request:api";
  message: "No AwardWallet connection found";
}

// Sync Failed (500)
{
  code: "bad_request:api";
  message: "Failed to sync loyalty accounts";
  cause?: string;
}
```

### 4.5 POST /api/awardwallet/disconnect

**Purpose:** Remove AwardWallet connection

**Request:**
```typescript
Headers: {
  Cookie: session token
}
```

**Response:**
```typescript
// Success (200)
{
  success: true;
}

// Error (500)
{
  code: "bad_request:api";
  message: "Failed to disconnect AwardWallet";
  cause?: string;
}
```

### 4.6 POST /api/cron/awardwallet-sync

**Purpose:** Scheduled sync for all connections (Vercel Cron)

**Request:**
```typescript
Headers: {
  Authorization: Bearer ${CRON_SECRET}
}
```

**Response:**
```typescript
// Success (200)
{
  success: true;
  syncedConnections: number;
  failedConnections: number;
  details: Array<{
    userId: string;
    status: "success" | "failed";
    accountCount?: number;
    error?: string;
  }>;
}

// Unauthorized (401)
{
  error: "Unauthorized";
}
```

---

## 5. Database Schema (Drizzle Format)

### 5.1 awardwallet_connections Table

```typescript
// lib/db/schema.ts

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateId } from 'ai';
import { InferSelectModel } from 'drizzle-orm';
import { user } from './schema';

/**
 * Connection status for AwardWallet integration
 */
export const awardwalletConnectionStatus = ['connected', 'disconnected', 'error'] as const;
export type AwardWalletConnectionStatus = (typeof awardwalletConnectionStatus)[number];

/**
 * AwardWallet connections table.
 * Stores OAuth connection state for each user's AwardWallet account.
 */
export const awardwalletConnections = pgTable('awardwallet_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(), // One connection per user
  
  awUserId: text('aw_user_id')
    .notNull(), // AwardWallet's userId returned after OAuth
  
  connectedAt: timestamp('connected_at')
    .notNull()
    .defaultNow(),
  
  lastSyncedAt: timestamp('last_synced_at'),
  
  status: text('status')
    .$type<AwardWalletConnectionStatus>()
    .notNull()
    .default('connected'),
  
  // Store any error message if status is 'error'
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),
  
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow(),
});

export type AwardWalletConnection = InferSelectModel<typeof awardwalletConnections>;
```

### 5.2 loyalty_accounts Table

```typescript
// lib/db/schema.ts (continued)

/**
 * Balance unit types for loyalty programs
 */
export const loyaltyBalanceUnit = ['miles', 'points', 'nights', 'credits'] as const;
export type LoyaltyBalanceUnit = (typeof loyaltyBalanceUnit)[number];

/**
 * Loyalty accounts table.
 * Stores individual loyalty program balances synced from AwardWallet.
 */
export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  
  connectionId: text('connection_id')
    .notNull()
    .references(() => awardwalletConnections.id, { onDelete: 'cascade' }),
  
  // AwardWallet provider identifiers
  providerCode: text('provider_code')
    .notNull(), // e.g., "aa", "hhonors", "marriott"
  
  providerName: text('provider_name')
    .notNull(), // Human-readable name e.g., "American Airlines AAdvantage"
  
  // Balance information
  balance: integer('balance')
    .notNull()
    .default(0),
  
  balanceUnit: text('balance_unit')
    .$type<LoyaltyBalanceUnit>()
    .notNull()
    .default('points'),
  
  // Account details
  eliteStatus: text('elite_status'), // e.g., "Gold", "Platinum", null
  
  expirationDate: timestamp('expiration_date'), // When points/miles expire
  
  accountNumber: text('account_number'), // Masked account number
  
  // Display metadata
  logoUrl: text('logo_url'), // URL to program logo
  
  // Audit fields
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow(),
  
  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),
});

export type LoyaltyAccount = InferSelectModel<typeof loyaltyAccounts>;
```

### 5.3 Migration SQL

```sql
-- Migration: add_awardwallet_tables

CREATE TABLE IF NOT EXISTS "awardwallet_connections" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE UNIQUE,
  "aw_user_id" TEXT NOT NULL,
  "connected_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_synced_at" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "error_message" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
  "id" TEXT PRIMARY KEY,
  "connection_id" TEXT NOT NULL REFERENCES "awardwallet_connections"("id") ON DELETE CASCADE,
  "provider_code" TEXT NOT NULL,
  "provider_name" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "balance_unit" TEXT NOT NULL DEFAULT 'points',
  "elite_status" TEXT,
  "expiration_date" TIMESTAMP,
  "account_number" TEXT,
  "logo_url" TEXT,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_awardwallet_connections_user_id" ON "awardwallet_connections"("user_id");
CREATE INDEX IF NOT EXISTS "idx_awardwallet_connections_status" ON "awardwallet_connections"("status");
CREATE INDEX IF NOT EXISTS "idx_loyalty_accounts_connection_id" ON "loyalty_accounts"("connection_id");
CREATE INDEX IF NOT EXISTS "idx_loyalty_accounts_balance" ON "loyalty_accounts"("balance" DESC);
CREATE INDEX IF NOT EXISTS "idx_loyalty_accounts_expiration" ON "loyalty_accounts"("expiration_date") WHERE "expiration_date" IS NOT NULL;
```

---

## 6. UI/UX Specifications

### 6.1 Settings Dialog - Loyalty Programs Tab

**Location:** Settings Dialog → New "Loyalty Programs" tab

**Tab Icon:** Use `Wallet02Icon` from `@hugeicons/core-free-icons`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 💳 Loyalty Programs                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🔗 AwardWallet Connection                    │  │
│  │                                             │  │
│  │ [NOT CONNECTED STATE]                       │  │
│  │ Connect your AwardWallet account to view    │  │
│  │ all your loyalty program balances.          │  │
│  │                                             │  │
│  │ ℹ️ Don't have AwardWallet? Sign up free    │  │
│  │    → awardwallet.com                        │  │
│  │                                             │  │
│  │ [Connect AwardWallet] button                │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [CONNECTED STATE - replaces above]                │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ ✓ Connected                    [🔄] [Disconnect]│
│  │ Last synced: Dec 19, 2025 3:45 PM           │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Your Loyalty Programs (sorted by balance)         │
│  ┌─────────────────────────────────────────────┐  │
│  │ [Logo] American Airlines AAdvantage         │  │
│  │        125,430 miles    Gold Status         │  │
│  │        Expires: Mar 2026                    │  │
│  ├─────────────────────────────────────────────┤  │
│  │ [Logo] Marriott Bonvoy                      │  │
│  │        89,200 points    Platinum Elite      │  │
│  │        No expiration                        │  │
│  ├─────────────────────────────────────────────┤  │
│  │ [Logo] Hilton Honors                        │  │
│  │        45,000 points    Gold                │  │
│  │        Expires: Jan 2026                    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.2 Homepage Header Display

**Location:** Homepage header area (next to user avatar or in navbar)

**Compact Display (when connected):**
```
┌──────────────────────────────────────────┐
│ 💳 125K miles · 89K pts · 45K pts        │
└──────────────────────────────────────────┘
        ↓ Click expands to show details
```

**Detail View (on click/hover):**
```
┌────────────────────────────────────────────┐
│ Your Top Balances                          │
├────────────────────────────────────────────┤
│ ✈️ AA AAdvantage    125,430 miles          │
│ 🏨 Marriott Bonvoy   89,200 points         │
│ 🏨 Hilton Honors     45,000 points         │
│                                            │
│ [View All in Settings →]                   │
└────────────────────────────────────────────┘
```

**Quick Connect Button (when not connected):**
```
┌──────────────────────────────────────────┐
│ [💳 Connect Loyalty Programs]            │
└──────────────────────────────────────────┘
```

### 6.3 Component Specifications

#### LoyaltyConnectButton

```typescript
interface LoyaltyConnectButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}
```

**States:**
- `idle`: Shows "Connect AwardWallet"
- `loading`: Shows spinner + "Connecting..."
- `redirecting`: Shows "Redirecting to AwardWallet..."

#### LoyaltyProgramCard

```typescript
interface LoyaltyProgramCardProps {
  program: {
    providerName: string;
    providerCode: string;
    balance: number;
    balanceUnit: 'miles' | 'points' | 'nights' | 'credits';
    eliteStatus: string | null;
    expirationDate: string | null;
    logoUrl: string | null;
  };
  compact?: boolean;
}
```

#### LoyaltyHeaderWidget

```typescript
interface LoyaltyHeaderWidgetProps {
  maxPrograms?: number; // Default: 3
  onViewAll?: () => void;
}
```

### 6.4 Responsive Behavior

**Desktop (>768px):**
- Full loyalty programs list visible in Settings
- Header shows top 3 programs inline
- Hover states for detail popup

**Mobile (<768px):**
- Loyalty programs list scrollable
- Header shows condensed summary (e.g., "5 programs · 350K total")
- Tap to expand details in bottom sheet

### 6.5 Loading & Error States

**Loading States:**
- Skeleton cards while fetching accounts
- Spinner on refresh button during sync
- Disable all actions during operations

**Error States:**
- Connection failed: Red alert with retry button
- Sync failed: Toast notification with retry option
- API unavailable: Graceful degradation, show cached data

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

1. **Session Validation:** All API routes must verify user session via `auth()` from `@/lib/auth`
2. **User Isolation:** Queries must filter by authenticated user ID
3. **No Cross-User Access:** Implement row-level security at query level

```typescript
// Example secure query pattern
export async function getUserLoyaltyAccounts(userId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    throw new ChatSDKError('unauthorized:auth');
  }
  // Proceed with query...
}
```

### 7.2 API Key Security

1. **Environment Variables:** Store `AWARDWALLET_API_KEY` in server-only env
2. **Validation:** Add to `env/server.ts` Zod schema
3. **Never Expose:** API key only used server-side, never sent to client

```typescript
// env/server.ts addition
AWARDWALLET_API_KEY: z.string().min(1),
```

### 7.3 OAuth Security

1. **State Parameter:** Generate and validate state parameter for CSRF protection
2. **Code Exchange:** Exchange happens server-side only
3. **Token Storage:** Never store OAuth tokens client-side

### 7.4 Data Protection

1. **Minimal Storage:** Only store necessary account metadata
2. **No Credentials:** Never store user's AwardWallet password
3. **Masked Numbers:** Account numbers should be partially masked (e.g., "****1234")
4. **Soft Delete:** On disconnect, mark as deleted but retain for audit

### 7.5 Rate Limiting

1. **Manual Sync:** Limit to 1 sync per 5 minutes per user
2. **Cron Protection:** Validate CRON_SECRET header
3. **API Calls:** Respect AwardWallet's rate limits (documented in their API)

---

## 8. Testing Strategy

### 8.1 Unit Tests

**AwardWallet Client (`lib/api/awardwallet-client.test.ts`):**
```typescript
describe('AwardWallet Client', () => {
  describe('createAuthUrl', () => {
    it('should generate valid OAuth URL');
    it('should handle API errors gracefully');
  });
  
  describe('getConnectionInfo', () => {
    it('should exchange code for userId');
    it('should throw on invalid code');
  });
  
  describe('getConnectedUser', () => {
    it('should return all loyalty accounts');
    it('should handle empty accounts list');
    it('should transform API response correctly');
  });
});
```

**Database Queries (`lib/db/queries/awardwallet.test.ts`):**
```typescript
describe('AwardWallet Queries', () => {
  describe('createConnection', () => {
    it('should create new connection record');
    it('should prevent duplicate connections per user');
  });
  
  describe('getLoyaltyAccounts', () => {
    it('should return accounts sorted by balance');
    it('should filter by user ID correctly');
  });
  
  describe('syncLoyaltyAccounts', () => {
    it('should upsert accounts correctly');
    it('should remove stale accounts');
  });
});
```

### 8.2 Integration Tests

**API Routes:**
```typescript
describe('POST /api/awardwallet/auth/initiate', () => {
  it('should require authentication');
  it('should return auth URL');
  it('should handle AwardWallet API errors');
});

describe('GET /api/awardwallet/accounts', () => {
  it('should return empty for non-connected users');
  it('should return accounts for connected users');
  it('should sort by balance descending');
});

describe('POST /api/awardwallet/sync', () => {
  it('should sync and update accounts');
  it('should respect rate limits');
  it('should handle connection errors');
});
```

### 8.3 E2E Tests (Playwright)

```typescript
describe('AwardWallet Integration', () => {
  test('user can initiate connection flow', async ({ page }) => {
    // Navigate to settings
    // Click Connect AwardWallet
    // Verify redirect to AwardWallet OAuth
  });
  
  test('connected user sees loyalty balances', async ({ page }) => {
    // Login as connected user
    // Navigate to settings
    // Verify loyalty programs displayed
  });
  
  test('user can disconnect AwardWallet', async ({ page }) => {
    // Login as connected user
    // Navigate to settings
    // Click Disconnect
    // Confirm dialog
    // Verify disconnection
  });
});
```

### 8.4 Test Data Fixtures

```typescript
export const mockLoyaltyAccounts = [
  {
    providerCode: 'aa',
    providerName: 'American Airlines AAdvantage',
    balance: 125430,
    balanceUnit: 'miles',
    eliteStatus: 'Gold',
    expirationDate: '2026-03-15',
  },
  {
    providerCode: 'marriott',
    providerName: 'Marriott Bonvoy',
    balance: 89200,
    balanceUnit: 'points',
    eliteStatus: 'Platinum Elite',
    expirationDate: null,
  },
];
```

---

## 9. AI Integration Specification

### 9.1 Context Injection

**Location:** System prompt generation in chat flow

**Implementation:**
```typescript
// lib/ai/loyalty-context.ts

export interface LoyaltyContext {
  hasConnection: boolean;
  lastSyncedAt: string | null;
  programs: Array<{
    name: string;
    balance: number;
    unit: string;
    eliteStatus: string | null;
    expiresAt: string | null;
  }>;
}

export function formatLoyaltyContextForAI(context: LoyaltyContext): string {
  if (!context.hasConnection || context.programs.length === 0) {
    return '';
  }

  const programList = context.programs
    .map(p => `- ${p.name}: ${p.balance.toLocaleString()} ${p.unit}${p.eliteStatus ? ` (${p.eliteStatus})` : ''}${p.expiresAt ? ` - expires ${p.expiresAt}` : ''}`)
    .join('\n');

  return `
## User's Loyalty Program Balances
Last updated: ${context.lastSyncedAt}

${programList}

When relevant to travel planning:
- Proactively suggest redemption opportunities
- Compare cash vs miles/points pricing when appropriate
- Warn about expiring balances (within 6 months)
- Consider elite status benefits in recommendations
`;
}
```

### 9.2 Expiration Warning Logic

**Trigger:** At chat session start, if user has expiring points within 6 months

**Frequency:** Maximum 1x per day per user

**Implementation:**
```typescript
// lib/ai/loyalty-warnings.ts

export async function shouldShowExpirationWarning(userId: string): Promise<boolean> {
  const lastWarningKey = `loyalty_expiration_warning:${userId}`;
  const lastWarning = await redis.get(lastWarningKey);
  
  if (lastWarning) {
    const lastWarningDate = new Date(lastWarning);
    const now = new Date();
    if (now.getTime() - lastWarningDate.getTime() < 24 * 60 * 60 * 1000) {
      return false;
    }
  }
  
  return true;
}

export async function markExpirationWarningShown(userId: string): Promise<void> {
  await redis.set(
    `loyalty_expiration_warning:${userId}`,
    new Date().toISOString(),
    { ex: 24 * 60 * 60 }
  );
}

export function getExpiringPrograms(accounts: LoyaltyAccount[]): LoyaltyAccount[] {
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  
  return accounts.filter(
    acc => acc.expirationDate && new Date(acc.expirationDate) <= sixMonthsFromNow
  );
}
```

### 9.3 Proactive Suggestion Examples

The AI should be trained to generate suggestions like:

1. **Flight Booking Context:**
   > "I notice you have 125,000 AA miles. A Business Class round-trip to Bangkok typically costs 140,000 miles—you're just 15,000 miles short! Would you like me to search for award availability?"

2. **Hotel Search Context:**
   > "With your 89,200 Marriott Bonvoy points, you could book up to 4 nights at a Category 5 property. Should I look for Marriott options in your destination?"

3. **Expiration Warning:**
   > "⚠️ Heads up: Your 45,000 Hilton Honors points expire in March 2026. Consider using them or earning qualifying activity to extend the expiration."

4. **Elite Status Awareness:**
   > "As a Marriott Platinum Elite member, you'll enjoy complimentary breakfast and room upgrades. I'll prioritize Marriott properties that honor these benefits."

---

## 10. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Add `AWARDWALLET_API_KEY` to environment schema
- [ ] Create database migration for new tables
- [ ] Implement `awardwallet-client.ts` API wrapper
- [ ] Write unit tests for API client
- [ ] Create database query functions

### Phase 2: OAuth Flow (Week 1-2)
- [ ] Implement `/api/awardwallet/auth/initiate`
- [ ] Implement `/api/awardwallet/auth/callback`
- [ ] Add callback page UI
- [ ] Test OAuth flow end-to-end

### Phase 3: Data Sync (Week 2)
- [ ] Implement `/api/awardwallet/accounts`
- [ ] Implement `/api/awardwallet/sync`
- [ ] Create cron job for scheduled sync
- [ ] Add to Vercel cron configuration

### Phase 4: UI Components (Week 2-3)
- [ ] Create Settings "Loyalty Programs" tab
- [ ] Build `LoyaltyProgramCard` component
- [ ] Build `LoyaltyHeaderWidget` component
- [ ] Add connection/disconnection UI
- [ ] Implement loading and error states

### Phase 5: AI Integration (Week 3)
- [ ] Implement loyalty context injection
- [ ] Add expiration warning logic
- [ ] Test AI suggestions with real data
- [ ] Fine-tune prompt for proactive suggestions

### Phase 6: Testing & Polish (Week 3-4)
- [ ] Complete integration tests
- [ ] E2E testing with Playwright
- [ ] Mobile responsive testing
- [ ] Performance optimization
- [ ] Documentation

---

## 11. Environment Variables

Add to `env/server.ts`:

```typescript
// AwardWallet Integration
AWARDWALLET_API_KEY: z.string().min(1),
AWARDWALLET_CALLBACK_URL: z.string().url().optional(), // Override for local dev
```

Add to `.env.example`:

```bash
# AwardWallet Integration
AWARDWALLET_API_KEY=your_api_key_here
# Optional: Override callback URL for development
# AWARDWALLET_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/awardwallet/auth/callback
```

---

## 12. Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/awardwallet-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This schedules the sync job to run every 6 hours at minute 0.

---

## 13. Error Handling Standards

Follow existing `ChatSDKError` pattern:

```typescript
// New error codes for AwardWallet
export type AwardWalletErrorType =
  | 'connection_failed'
  | 'sync_failed'
  | 'rate_limited'
  | 'api_unavailable';

// Usage example
throw new ChatSDKError('bad_request:api', 'AwardWallet API returned error: ' + errorMessage);
```

---

## 14. Logging & Monitoring

Implement structured logging for key events:

```typescript
// Connection events
console.log('[AwardWallet] OAuth initiated', { userId });
console.log('[AwardWallet] Connection established', { userId, awUserId });
console.log('[AwardWallet] Connection failed', { userId, error });

// Sync events
console.log('[AwardWallet] Sync started', { userId });
console.log('[AwardWallet] Sync completed', { userId, accountCount, duration });
console.log('[AwardWallet] Sync failed', { userId, error });

// Cron events
console.log('[AwardWallet] Cron job started', { timestamp });
console.log('[AwardWallet] Cron job completed', { syncedCount, failedCount, duration });
```

---

## 15. Future Considerations

1. **Award Search Integration:** Deep link to AwardWallet's award search when suggesting redemptions
2. **Program-Specific Logic:** Handle unique features of different loyalty programs
3. **Balance Notifications:** Push notifications when balances change significantly
4. **Transfer Partner Suggestions:** Suggest point transfers between programs
5. **Historical Tracking:** Track balance changes over time for insights
