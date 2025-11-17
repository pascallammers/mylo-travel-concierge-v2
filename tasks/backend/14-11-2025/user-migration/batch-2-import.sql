-- Batch 2: Import von 20 Usern (Beispiel - wird in Transaktion aufgeteilt)
-- Diese SQL wird via Neon MCP Transaction ausgeführt

-- User 1: tillmann66@web.de
INSERT INTO "user" (id, email, name, image, created_at, updated_at, email_verified, is_active, activation_status, last_active_at, supabase_user_id, raw_user_meta_data)
VALUES (gen_random_uuid(), 'tillmann66@web.de', 'Dirk Tillmann', NULL, '2025-09-20 08:58:30.16498+00', '2025-09-28 16:16:07.558814+00', true, true, 'active', '2025-09-21 07:45:57.235627+00', 'c6ae1d1f-78b6-4dd4-9d92-6e7db60f3462', '{"source":"thrivecard","full_name":"Dirk Tillmann","email_verified":true,"requires_password_change":false}')
RETURNING id;

-- Account für User 1
INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.email, 'credential', NULL, NOW(), NOW()
FROM "user" u WHERE u.email = 'tillmann66@web.de' AND u.supabase_user_id = 'c6ae1d1f-78b6-4dd4-9d92-6e7db60f3462';
