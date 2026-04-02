-- ============================================================
-- NORMALIZE: Subscription amounts to cents
--
-- ThriveCart sends amounts in cents (4700 = EUR 47.00).
-- Some subscriptions were stored in euros (47) due to a bug
-- in createSubscription that divided by 100.
--
-- Rules:
--   - Values 1-999: clearly euros, multiply by 100
--   - Values >= 1000: already in cents, leave as-is
--   - Value 0: legacy/free, leave as-is
--
-- Does NOT change price points (4900 stays 4900, not 4700).
-- Historical data is preserved.
-- ============================================================

BEGIN;

-- Preview: show what would change
SELECT
  amount AS current_amount,
  CASE
    WHEN amount >= 1 AND amount <= 999 THEN amount * 100
    ELSE amount
  END AS new_amount,
  count(*) AS sub_count,
  CASE
    WHEN amount >= 1 AND amount <= 999 THEN 'WILL CHANGE (euros -> cents)'
    ELSE 'NO CHANGE (already cents or zero)'
  END AS action
FROM subscription
WHERE status = 'active'
GROUP BY amount
ORDER BY sub_count DESC;

-- Execute the normalization
UPDATE subscription
SET amount = amount * 100,
    "modifiedAt" = now()
WHERE amount >= 1 AND amount <= 999
  AND status = 'active';

-- Also normalize amounts in archive_subscription (if any exist)
UPDATE archive_subscription
SET amount = amount * 100,
    "modifiedAt" = now()
WHERE amount >= 1 AND amount <= 999;

-- Verify: no active subscription should have euro-range amounts
SELECT amount, count(*) AS cnt
FROM subscription
WHERE status = 'active'
GROUP BY amount
ORDER BY cnt DESC;

COMMIT;
