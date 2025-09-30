# Bug Report: Example Template Bug

**Bug ID:** bug-example-template
**Reported:** 2024-01-25
**Severity:** Medium
**Priority:** P2
**Affected Features:** Authentication, User Dashboard

## Description
This is an example bug report template. When users try to login with valid credentials, they sometimes get redirected to the home page instead of the dashboard.

## Reproduction Steps
1. Navigate to `/login`
2. Enter valid email and password
3. Click "Sign In" button
4. Expected: Redirect to `/dashboard`
5. Actual: Sometimes redirects to `/` (home page)

## Environment
- Browser/OS: Chrome 120 on macOS 14.2
- Version: Production v1.2.3
- User Type: Standard users (not admin)
- Frequency: ~30% of login attempts

## Error Messages
```
Console Warning: Navigation cancelled from "/login" to "/" with a new navigation to "/dashboard"
```

## Screenshots/Videos
[Screenshot showing incorrect redirect]

## Impact
- Users affected: ~100-200 daily
- Features broken: Post-login navigation
- Workaround available: Yes - Users can manually navigate to dashboard

## Related Issues
- Previous bug: bug-087-auth-timeout
- Related feature: /feature-development/completed/user-authentication/
- Stack reference: /stack/clerk/authentication-flows.md

## Initial Thoughts
Might be related to race condition in auth state management or redirect logic timing issue.

## Acceptance Criteria for Fix
- [ ] Login consistently redirects to dashboard
- [ ] No console warnings during navigation
- [ ] Works across all browsers
- [ ] Unit tests cover redirect logic
- [ ] E2E test validates login flow