# Implementation Plan: Admin Dashboard

**Date:** 14-11-2025  
**Task ID:** admin-dashboard  
**Type:** Full-Stack (Backend + Frontend)

## Overview
Implement a comprehensive admin dashboard with role-based access control, user management, and analytics for the MYLO travel concierge application.

## Architecture

### Data Flow
```
User Request → Middleware → Role Check → Admin Route → API → Database → UI
```

### Database Schema Change
```sql
-- Add role column to user table
ALTER TABLE "user" 
ADD COLUMN role text NOT NULL DEFAULT 'user' 
CHECK (role IN ('user', 'admin'));

-- Create index for role queries
CREATE INDEX idx_user_role ON "user"(role);

-- Update existing users to have default role
UPDATE "user" SET role = 'user' WHERE role IS NULL;
```

### API Routes Structure
```
/app/api/admin/
├── stats/
│   └── route.ts          # Overall system statistics
├── users/
│   ├── route.ts          # List/search users
│   └── [id]/
│       ├── route.ts      # Get/update user
│       └── role/
│           └── route.ts  # Update user role
└── analytics/
    ├── tokens/
    │   └── route.ts      # Token usage analytics
    └── activity/
        └── route.ts      # User activity analytics
```

### Frontend Structure
```
/app/admin/
├── layout.tsx            # Admin layout with sidebar
├── page.tsx             # Dashboard overview
├── users/
│   └── page.tsx         # User management
└── analytics/
    └── page.tsx         # Detailed analytics
```

## Implementation Steps

### Phase 1: Database Migration (Using Neon MCP)
- [ ] Use Neon MCP to add `role` column to `user` table
- [ ] Add CHECK constraint for role values
- [ ] Create index on `role` column
- [ ] Set default role for existing users
- [ ] Verify migration success

**Files Modified:**
- Database schema (via MCP)

**Estimated Time:** 15 minutes

---

### Phase 2: Schema & Type Updates
- [ ] Update `lib/db/schema.ts` to include `role` field
- [ ] Update User type exports
- [ ] Update auth webhook handlers to set default role
- [ ] Create role utilities in `lib/auth-utils.ts`

**Files Modified:**
- `lib/db/schema.ts`
- `lib/auth.ts` (webhook handlers)
- `lib/auth-utils.ts` (new utility functions)

**New Functions:**
```typescript
// lib/auth-utils.ts
export async function getUserRole(userId: string): Promise<'user' | 'admin'>
export async function isAdmin(userId: string): Promise<boolean>
export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void>
```

**Estimated Time:** 30 minutes

---

### Phase 3: Middleware Enhancement
- [ ] Update `middleware.ts` to check admin role for `/admin` routes
- [ ] Add role-based redirect logic
- [ ] Test middleware with mock users

**Files Modified:**
- `middleware.ts`

**Logic:**
```typescript
// For /admin routes
if (pathname.startsWith('/admin')) {
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  
  const user = await getUserFromSession(sessionCookie);
  if (user.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url)); // Forbidden
  }
}
```

**Estimated Time:** 20 minutes

---

### Phase 4: Admin API Routes
- [ ] Create `/app/api/admin/stats/route.ts` for system stats
- [ ] Create `/app/api/admin/users/route.ts` for user listing
- [ ] Create `/app/api/admin/users/[id]/route.ts` for user details
- [ ] Create `/app/api/admin/users/[id]/role/route.ts` for role updates
- [ ] Create `/app/api/admin/analytics/tokens/route.ts` for token analytics
- [ ] Create `/app/api/admin/analytics/activity/route.ts` for activity analytics
- [ ] Add role validation to all routes
- [ ] Implement pagination for user listing
- [ ] Add error handling

**API Contracts:**

```typescript
// GET /api/admin/stats
Response: {
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  totalMedia: number;
  storageUsed: number;
  systemStatus: 'active' | 'maintenance';
}

// GET /api/admin/users?page=1&limit=50&search=email
Response: {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    lastLogin: string;
    activedays: number;
    sessions: number;
    tokensUsed: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

// PUT /api/admin/users/[id]/role
Request: { role: 'user' | 'admin' }
Response: { success: boolean; user: User }

// GET /api/admin/analytics/tokens?days=30
Response: {
  totalTokens: number;
  totalCost: number;
  topUsers: Array<{ email: string; tokens: number }>;
  dailyUsage: Array<{ date: string; tokens: number }>;
}

// GET /api/admin/analytics/activity?days=30
Response: {
  totalInteractions: number;
  avgInteractionsPerUser: number;
  activeUsersByDay: Array<{ date: string; count: number }>;
  mostActiveUser: { email: string; activity: number };
}
```

**Estimated Time:** 2 hours

---

### Phase 5: Admin Dashboard UI
- [ ] Create `/app/admin/layout.tsx` with sidebar navigation
- [ ] Create `/app/admin/page.tsx` - dashboard overview
- [ ] Create statistics cards component
- [ ] Create user table component with filtering
- [ ] Create charts for token usage (recharts)
- [ ] Create charts for active users over time
- [ ] Add loading states
- [ ] Add error handling
- [ ] Make responsive for mobile

**Components to Create:**
```
/components/admin/
├── stats-card.tsx           # Reusable stat card
├── user-table.tsx          # User management table
├── token-usage-chart.tsx   # Token usage visualization
├── activity-chart.tsx      # Activity over time chart
├── role-badge.tsx          # Role indicator badge
└── admin-nav.tsx           # Admin sidebar navigation
```

**Estimated Time:** 3 hours

---

### Phase 6: Testing & Verification
- [ ] Test database migration
- [ ] Test middleware protection
- [ ] Test admin API routes (Postman/curl)
- [ ] Test UI with different user roles
- [ ] Test role updates
- [ ] Test pagination
- [ ] Test error scenarios
- [ ] Verify cache invalidation on role changes
- [ ] Security audit

**Test Scenarios:**
1. Non-admin user cannot access `/admin`
2. Admin user can access all admin features
3. Role updates invalidate caches
4. Statistics are accurate
5. Charts render correctly
6. Mobile responsiveness

**Estimated Time:** 1 hour

---

## Dependencies

### External Libraries
- ✅ Drizzle ORM (already installed)
- ✅ Better Auth (already installed)
- ✅ shadcn/ui (already installed)
- ✅ lucide-react (already installed)
- ❓ recharts (need to check if installed)

### New Dependencies (if needed)
```bash
pnpm add recharts
pnpm add @types/recharts -D
```

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Unauthorized access | HIGH | Multiple layers: middleware + API validation |
| Privilege escalation | HIGH | Server-side role checks, no client-side trust |
| Performance with large datasets | MEDIUM | Pagination, indexing, query optimization |
| Cache staleness | MEDIUM | Explicit cache invalidation on role changes |

## Rollback Plan
1. Database migration can be reverted:
   ```sql
   ALTER TABLE "user" DROP COLUMN role;
   DROP INDEX idx_user_role;
   ```
2. Git revert for code changes
3. Admin routes can be disabled by middleware config

## Success Criteria
- ✅ Admin users can access `/admin` dashboard
- ✅ Non-admin users are redirected from `/admin`
- ✅ Dashboard displays accurate statistics
- ✅ User management works (list, search, update roles)
- ✅ Charts render correctly
- ✅ All tests pass
- ✅ No performance degradation
- ✅ Mobile responsive

## Total Estimated Time
**~7 hours** (can be broken into smaller sessions)

## Implementation Order
1. Database (30 min)
2. Backend utilities (30 min)
3. Middleware (20 min)
4. API routes (2 hours)
5. UI components (3 hours)
6. Testing (1 hour)

---

## Open Questions
1. Should we track admin actions (audit log)?
   - **Recommendation:** Future enhancement, log in Phase 2
2. Export functionality for user data?
   - **Recommendation:** Future enhancement
3. Email notifications for role changes?
   - **Recommendation:** Future enhancement
