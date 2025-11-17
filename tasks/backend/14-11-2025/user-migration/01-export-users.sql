-- Supabase Query: Export User Data with ThriveCard Status
-- Run this in Supabase SQL Editor and export as JSON

SELECT 
  u.id as supabase_user_id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.email) as name,
  u.email_confirmed_at IS NOT NULL as email_verified,
  u.raw_user_meta_data->>'avatar_url' as image,
  u.created_at,
  u.updated_at,
  CASE WHEN ur.role = 'admin' THEN 'admin' ELSE 'user' END as role,
  u.last_sign_in_at as last_active_at,
  u.raw_user_meta_data,
  -- Aktiv-Status basierend auf ThriveCard Subscription
  EXISTS(
    SELECT 1 FROM public.user_subscription_access usa
    JOIN public.subscriptions s ON usa.subscription_id = s.id
    WHERE usa.user_id = u.id 
    AND usa.has_access = true
    AND s.status IN ('active', 'trialing')
  ) as is_active,
  -- Activation Status
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM public.user_subscription_access usa
      JOIN public.subscriptions s ON usa.subscription_id = s.id
      WHERE usa.user_id = u.id 
      AND usa.has_access = true
      AND s.status IN ('active', 'trialing')
    ) THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM public.user_subscription_access usa
      WHERE usa.user_id = u.id 
      AND usa.grace_period_end > NOW()
    ) THEN 'grace_period'
    ELSE 'inactive'
  END as activation_status
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY u.created_at;
