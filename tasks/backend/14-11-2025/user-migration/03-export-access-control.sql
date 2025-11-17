-- Supabase Query: Export User Access Control Data
-- Run this in Supabase SQL Editor and export as JSON

SELECT 
  usa.id,
  usa.user_id,
  usa.subscription_id,
  usa.has_access,
  usa.access_level,
  usa.grace_period_end,
  usa.features,
  usa.last_access_check,
  usa.access_granted_at,
  usa.access_revoked_at,
  usa.status_flag,
  usa.created_at,
  usa.updated_at
FROM public.user_subscription_access usa
ORDER BY usa.created_at;
