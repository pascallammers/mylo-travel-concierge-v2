# Research – fix-password-reset-link (21-11-2025)

## Context
- User receives reset emails that open `http://reset-password/<token>?callbackURL=...` and land on an error page.
- Current self-service flow should send links to `/reset-password/confirm?token=...` using custom endpoint `/api/auth/forget-password` added on 18-11-2025.

## Findings
- Custom forget route (`app/api/auth/forget-password/route.ts`) builds link with `NEXT_PUBLIC_APP_URL || http://localhost:3000` and path `/reset-password/confirm?token=...&email=...`. Token is 64 hex characters (from `crypto.randomBytes(32)`).
- Confirm page (`app/(auth)/reset-password/confirm/page.tsx`) expects query param `token` and posts to `/api/auth/reset-password`.
- Better-Auth callback `sendResetPassword` in `lib/auth.ts` currently sends whatever `url` better-auth passes. No normalization of base URL.
- Admin reset endpoint (`app/api/admin/users/[id]/reset-password/route.ts`) uses `auth.api.forgetPassword({ redirectTo: `${baseUrl}/reset-password` })` (Better-Auth). Fallback builds `${baseUrl}/reset-password?token=...`.
- Tokens from custom route differ in shape from the reported token (`fTKsskc...` -> short, not hex), suggesting the faulty link likely comes from Better-Auth-generated URL rather than the custom flow.
- Env: `.env.local` sets `NEXT_PUBLIC_APP_URL=http://localhost:3000`; production value unknown. Missing or malformed base URL could yield wrong host in Better-Auth generated link.

## Hypothesis
- Better-Auth produces an incorrect reset URL when base URL/redirect is malformed, leading to `http://reset-password/<token>?callbackURL=...`.
- We need a single, normalized URL builder for all reset flows and ensure Better-Auth callback emails use it instead of the raw `url` argument.
