File: lib/password-reset.ts
Lines: 1-50
Summary: Added shared helpers to normalize base URLs and build absolute reset password links.

File: lib/password-reset.test.ts
Lines: 1-48
Summary: Unit tests covering URL normalization and reset link construction.

File: app/api/auth/forget-password/route.ts
Lines: 60-82
Summary: Switched to shared reset URL builder to ensure absolute links in self-service emails.

File: lib/auth.ts
Lines: 91-109
Summary: Better-Auth reset callback now rebuilds normalized reset URL before sending email.

File: app/api/admin/users/[id]/reset-password/route.ts
Lines: 47-94
Summary: Admin reset flow normalizes base URL, updates redirect target, and aligns fallback token handling with custom flow.
