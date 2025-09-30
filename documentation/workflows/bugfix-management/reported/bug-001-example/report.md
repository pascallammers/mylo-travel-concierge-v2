# Bug Report: Example Authentication Redirect Issue

> ### 🔴 Current Status: `REPORTED`
> **Location:** `/reported/bug-001-example/`
> **Last Updated:** 2024-01-25

**Bug ID:** bug-001-example
**Reported:** 2024-01-25
**Severity:** Medium
**Priority:** P2
**Affected Features:** Authentication, User Dashboard

## Description
Example bug report showing the template structure. Users experience intermittent redirect failures after successful login.

## Reproduction Steps
1. Navigate to `/login`
2. Enter valid credentials
3. Click "Sign In"
4. Expected: Redirect to `/dashboard`
5. Actual: Sometimes redirects to home page `/`

## Environment
- Browser/OS: Chrome 120 / macOS 14.2
- Version: Production v1.2.3
- User Type: Standard users
- Frequency: ~30% of attempts

## Error Messages
```
Console: Navigation cancelled from "/login" to "/" with new navigation to "/dashboard"
```

## Impact
- Users affected: 100-200 daily
- Features broken: Post-login navigation
- Workaround: Manual navigation to dashboard

## Related Issues
- Previous: bug-087-auth-timeout
- Feature: /feature-development/completed/user-auth/

## Next Steps
When moving to `INVESTIGATING`:
1. Update status badge to `INVESTIGATING`
2. Move folder to `/investigating/`
3. Add `analysis.md` and `fix-plan.md`