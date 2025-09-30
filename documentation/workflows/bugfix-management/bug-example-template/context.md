# Context: Authentication Redirect Bug

## Related Code Locations

### Authentication Flow
- `/app/(auth)/login/page.tsx` - Login page component
- `/app/api/auth/callback/route.ts` - Auth callback handler
- `/lib/auth/clerk-config.ts` - Clerk configuration
- `/middleware.ts` - Auth middleware and redirects

## Feature Documentation
→ [User Authentication Feature](../../../feature-development/completed/user-authentication/)
→ [Clerk Auth Integration](../../../stack/clerk/setup.md)
→ [Protected Routes Pattern](../../../patterns/authentication/protected-routes.md)

## Similar Resolved Bugs
→ [bug-087-auth-timeout](../../resolved/bug-087-auth-timeout/) - Auth state timing
→ [bug-063-redirect-loop](../../resolved/bug-063-redirect-loop/) - Redirect logic

## Relevant Patterns

### Current Redirect Implementation
```typescript
// middleware.ts:45
if (isAuthenticated && isAuthPage) {
  return NextResponse.redirect(new URL('/dashboard', req.url))
}
```

### Clerk Configuration
```typescript
// lib/auth/clerk-config.ts:12
afterSignInUrl: '/dashboard',
afterSignUpUrl: '/onboarding',
```

## Testing Checklist
- [ ] Check middleware logic
- [ ] Verify Clerk webhook handling
- [ ] Test race conditions
- [ ] Check browser console for timing issues
- [ ] Review redirect chain in Network tab

## Potential Areas to Investigate
1. **Middleware Timing**: Check if auth state is available when redirect happens
2. **Clerk Hooks**: Verify useAuth() and useUser() synchronization
3. **Navigation Guards**: Check protected route implementation
4. **State Management**: Review auth context provider
5. **Browser Cache**: Test with cache disabled

## Dependencies
- `@clerk/nextjs`: ^5.0.0
- `next`: ^14.0.0
- Custom middleware implementation
- Auth context provider

## Historical Context
- This redirect pattern was implemented in v1.1.0
- Previous implementation used client-side redirects
- Changed to middleware-based for better UX
- Has worked reliably until v1.2.3

## Questions for Investigation
1. What changed between v1.2.2 and v1.2.3?
2. Is this browser-specific or universal?
3. Does it happen with SSO providers too?
4. Are there any new race conditions with recent changes?
5. Could this be related to new caching strategies?