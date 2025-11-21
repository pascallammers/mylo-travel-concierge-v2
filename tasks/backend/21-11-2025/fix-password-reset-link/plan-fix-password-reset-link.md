# Plan – fix-password-reset-link (21-11-2025)

## Goal
Ensure all password reset emails generate a correct absolute link that lands on `/reset-password/confirm`, eliminating malformed `http://reset-password/...` URLs.

## Steps
1. Add a small helper in `lib/auth/password-reset.ts` to normalize the base URL and build the reset link (`/reset-password/confirm?token=...&email=...`).
2. Update all reset senders to use the helper:
   - Better-Auth `sendResetPassword` callback in `lib/auth.ts` (ignore raw `url`, rebuild using helper).
   - Custom endpoint `app/api/auth/forget-password/route.ts`.
   - Admin reset endpoint `app/api/admin/users/[id]/reset-password/route.ts` (both redirectTo and fallback link).
3. Add unit tests for the helper (base URL normalization, trailing slashes, missing protocol, double slashes).
4. Run targeted tests via `npx tsx --test "lib/auth/password-reset.test.ts"` and capture output in verification.
5. Record edited files summary (`files-edited.md`) and test log (`verification.md`).
