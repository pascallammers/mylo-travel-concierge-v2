-- Import First 10 Users + Better Auth Accounts (TEST BATCH)
-- Using real data from Supabase export

-- User 1: Michael Heinrich Resch
INSERT INTO "user" (
  id, name, email, "emailVerified", image, "createdAt", "updatedAt",
  role, "isActive", "activationStatus", "lastActiveAt", "supabaseUserId", "rawUserMetaData"
) VALUES (
  gen_random_uuid(),
  'Michael Heinrich Resch',
  'michael.h.resch@gmail.com',
  true,
  NULL,
  '2025-11-13 19:15:34.057789+00',
  '2025-11-13 19:15:34.195831+00',
  'user',
  true,
  'active',
  '2025-11-13 19:15:34.195831+00',
  'd50155b8-7b51-444f-adcc-44eba0f29e23',
  '{"source":"thrivecard","full_name":"Michael Heinrich Resch","email_verified":true,"requires_password_change":true}'::jsonb
) RETURNING id;

-- Better Auth Account for Michael
INSERT INTO "account" (
  id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
) SELECT
  gen_random_uuid(),
  'michael.h.resch@gmail.com',
  'credential',
  id,
  NULL,
  '2025-11-13 19:15:34.057789+00',
  '2025-11-13 19:15:34.195831+00'
FROM "user"
WHERE email = 'michael.h.resch@gmail.com';
