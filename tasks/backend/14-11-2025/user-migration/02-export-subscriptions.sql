-- Supabase Query: Export ThriveCard Subscription Data
-- Run this in Supabase SQL Editor and export as JSON

SELECT 
  s.id,
  s.user_id,
  s.status,
  s.plan_type,
  s.plan_name,
  s.thrivecard_customer_id,
  s.thrivecard_subscription_id,
  s.start_date,
  s.end_date,
  s.cancelled_at,
  s.trial_end_date,
  s.is_trial,
  s.auto_renew,
  s.next_payment_date,
  s.last_payment_date,
  s.payment_method,
  usa.grace_period_end,
  usa.access_level,
  usa.features,
  -- Mapping für Neon subscription-Felder
  s.start_date as "startedAt",
  s.end_date as "endsAt",
  s.cancelled_at as "canceledAt",
  s.start_date as "currentPeriodStart",
  COALESCE(s.next_payment_date, s.end_date) as "currentPeriodEnd",
  CASE WHEN s.cancelled_at IS NOT NULL THEN true ELSE false END as "cancelAtPeriodEnd"
FROM public.subscriptions s
LEFT JOIN public.user_subscription_access usa ON usa.subscription_id = s.id
ORDER BY s.created_at;
