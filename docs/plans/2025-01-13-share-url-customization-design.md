# Share URL Customization Design

**Date:** 2025-01-13
**Status:** Approved
**Author:** Claude Code

## Problem

The Share Chat feature hardcodes `scira.ai` in multiple files. Users who share chats see the wrong domain in their links. The application deploys to `https://chat.never-economy-again.com` on Vercel but generates share URLs for a different domain.

## Solution

Replace hardcoded URLs with a configurable environment variable `NEXT_PUBLIC_APP_URL`. This variable controls the base URL for all share links and metadata.

## Architecture

### Environment Variable

**Variable Name:** `NEXT_PUBLIC_APP_URL`
**Format:** Full URL without trailing slash
**Example:** `https://chat.never-economy-again.com`

The `NEXT_PUBLIC_` prefix exposes the variable to client-side code automatically.

### Implementation Points

Four locations require changes:

1. **Client-side share dialogs** (2 files):
   - `components/share/share-dialog.tsx:42`
   - `components/dialogs/share-dialog.tsx:30`
   - Use fallback: `process.env.NEXT_PUBLIC_APP_URL || window.location.origin`

2. **Server-side metadata** (1 file):
   - `app/search/[id]/page.tsx:64,78,91`
   - Use fallback: `process.env.NEXT_PUBLIC_APP_URL || 'https://chat.never-economy-again.com'`

### Fallback Strategy

**Client-side:** The code reads `window.location.origin` when the variable is unset. This ensures share links work in development without configuration.

**Server-side:** The code uses the production URL as a hardcoded fallback. Social media crawlers need valid URLs during server rendering. OpenGraph and Twitter Cards fail without this fallback.

## Configuration

### Local Development

Add to `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (Vercel)

Add to Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_APP_URL=https://chat.never-economy-again.com
```

Deploy after adding the variable. Vercel injects environment variables during build time.

### Environment Variable Documentation

Update `.env.example`:
```
# Application Base URL
NEXT_PUBLIC_APP_URL=https://chat.never-economy-again.com
```

## Testing

Test these scenarios after deployment:

1. Open Share Dialog → Verify URL contains `chat.never-economy-again.com`
2. Set chat to Public → Copy link → Check domain in copied URL
3. Click social share buttons → Verify shared URLs use correct domain
4. Open shared chat page → Inspect OpenGraph tags in HTML
5. Test in development → Verify localhost URLs work

## Rollback Plan

Remove the environment variable from Vercel. The fallback logic handles missing variables gracefully. Client-side code uses `window.location.origin`. Server-side code uses the hardcoded production URL.

## Files Changed

- `components/share/share-dialog.tsx`
- `components/dialogs/share-dialog.tsx`
- `app/search/[id]/page.tsx`
- `.env.example`

## Trade-offs

**Chosen approach:** Environment variable with fallbacks
**Alternatives considered:**
- Automatic detection only (fails for server-side metadata)
- Config file with optional override (adds complexity)

The environment variable approach balances simplicity with control. Developers configure one variable. The code handles missing configuration automatically.
