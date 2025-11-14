# Research: Admin Dashboard Implementation

**Date:** 14-11-2025  
**Task ID:** admin-dashboard  
**Type:** Backend + Frontend (Full-Stack)

## Current System Analysis

### Authentication & Authorization
- **Auth System:** Better Auth with email/password authentication
- **Session Management:** Cookie-based sessions via `getSessionCookie()`
- **Middleware:** Existing route protection at `/middleware.ts`
- **User Table:** No role column currently exists
- **Database:** PostgreSQL via Neon (project: `lingering-waterfall-35566132`)

### Current User Schema
```typescript
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
```

**Missing:** `role` column for role-based access control

### Current Middleware Pattern
The app uses Next.js middleware for route protection:
- Public routes: `/terms`, `/privacy-policy`
- Auth routes: `/sign-in`, `/reset-password`
- Protected routes: Everything else (requires session)
- API routes: Allowed without middleware checks

### Existing Patterns
1. **User Context:** `contexts/user-context.tsx` manages user state
2. **User Data Hooks:** `hooks/use-user-data.ts`, `hooks/use-cached-user-data.tsx`
3. **Server-side User Utils:** `lib/user-data-server.ts`
4. **Auth Utilities:** `lib/auth-utils.ts`

## Requirements Analysis

### Database Changes
1. Add `role` column to `user` table
   - Type: `text` or enum (`'user' | 'admin'`)
   - Default: `'user'`
   - Nullable: `false`

2. Update existing users to have default role

### Admin Dashboard Features (Based on Screenshot)
The dashboard shows:
1. **Stats Cards:**
   - Documents count (85 Testdokumente)
   - Media count (0 Audio/Video files)
   - Storage usage (0 MB Gesamtspeicher)
   - System status (Aktiv)
   - User count (311 Registrierte User)

2. **Token Usage Statistics:**
   - Total users (311, with 85 active in 30 days)
   - Token consumption (6,272,499 tokens over 30 days)
   - Costs (Aggregierte API-Kosten)
   - Interactions (10.5 per active user / 30 days)

3. **Charts:**
   - Top users by token usage
   - Active users per day (30-day window)

4. **Activity Tracking:**
   - Highest activity user
   - Limit usage warnings (60% threshold)

5. **User Details Table:**
   - Username/Email
   - Last login
   - Last activity
   - Active days
   - Sessions
   - Tokens (30d)
   - Costs (30d)
   - Limit usage

### Required Components
1. **Backend:**
   - Admin-only API routes for stats
   - User management endpoints
   - Token/usage aggregation queries
   - Role-based middleware

2. **Frontend:**
   - Admin dashboard layout
   - Statistics cards
   - Charts (using recharts or similar)
   - User table with filters
   - Protected admin route

## Technical Decisions

### Role Management
**Decision:** Add `role` column as text enum
**Rationale:**
- Simple to implement
- Extensible for future roles
- PostgreSQL supports CHECK constraints for enum-like behavior

### Authorization Pattern
**Decision:** Server-side role checks with middleware enhancement
**Approach:**
1. Extend middleware to check user role for `/admin` routes
2. Create server-side utility `getUserRole(userId)`
3. Add role validation to admin API routes

### Data Aggregation
**Decision:** Use Drizzle ORM with direct SQL for complex queries
**Rationale:**
- Already using Drizzle
- Complex aggregations better with raw SQL
- Can use MCP for query optimization

## External References

### Similar Implementations
- Next.js Admin Dashboard patterns
- Role-based access control (RBAC) in Next.js
- Better Auth role management

### Libraries to Use
- Existing: Drizzle ORM, Better Auth, Next.js
- UI: shadcn/ui components (already in use)
- Charts: recharts (if not already present)
- Icons: lucide-react (already in use)

## Questions & Clarifications

1. ✅ Should we support multiple roles or just `user` and `admin`?
   - **Decision:** Start with `user` and `admin`, design for extensibility

2. ✅ Who should be the initial admin?
   - **Suggestion:** Manual database update for first admin, then admin can promote others

3. ✅ Should admins be able to promote/demote users?
   - **Assumption:** Yes, via admin dashboard

4. What analytics should be tracked?
   - Token usage (already exists in `message` table)
   - Search usage (already exists in `extremeSearchUsage`)
   - Session duration
   - Active days

## Risks & Considerations

1. **Security:** Admin routes must be properly protected
2. **Performance:** Large user tables may need pagination/indexing
3. **Migration:** Existing users need default role assigned
4. **Authorization:** Need to prevent privilege escalation
5. **Cache Invalidation:** Role changes must invalidate user caches

## Next Steps
1. Create migration to add `role` column
2. Update schema definitions
3. Extend middleware for admin protection
4. Create admin API routes
5. Build admin dashboard UI
6. Test role-based access control
