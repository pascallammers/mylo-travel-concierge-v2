-- ============================================================
-- CLEANUP: Fälschlich angelegte MYLO-User deaktivieren
--
-- Diese User haben KEIN MYLO-Produkt (ID 5) gekauft, aber
-- durch einen Bug im ThriveCart-Webhook einen MYLO-Account
-- mit aktiver Subscription bekommen.
--
-- Betrifft: 345 User (seit 11.03.2026, Direct-Webhook-Ära)
--
-- Aktionen:
--   1. Subscription status → 'canceled'
--   2. User is_active → false
--   3. User activation_status → 'suspended'
--
-- SICHERHEIT: Echte MYLO-Käufer (base_product=5) werden
--             explizit ausgeschlossen.
-- ============================================================

BEGIN;

-- Temporäre Tabelle mit den betroffenen E-Mails
CREATE TEMP TABLE wrong_emails AS
SELECT DISTINCT customer_email AS email
FROM thrivecart_webhook_log
WHERE event_type = 'order.success'
  AND (payload->>'base_product')::int != 5
  AND result = 'success'
EXCEPT
SELECT DISTINCT customer_email AS email
FROM thrivecart_webhook_log
WHERE event_type = 'order.success'
  AND (payload->>'base_product')::int = 5;

-- Sicherheits-Check: Wie viele E-Mails betroffen?
SELECT count(*) AS "Betroffene E-Mails" FROM wrong_emails;

-- 1. Subscriptions auf 'canceled' setzen
UPDATE subscription
SET status = 'canceled',
    "canceledAt" = NOW(),
    "modifiedAt" = NOW()
WHERE "userId" IN (
  SELECT u.id FROM "user" u
  JOIN wrong_emails we ON we.email = u.email
)
AND status = 'active';

-- Zeige wie viele Subscriptions geändert wurden
-- (sollte ~345 sein)

-- 2. User deaktivieren
UPDATE "user"
SET is_active = false,
    activation_status = 'suspended',
    updated_at = NOW()
WHERE email IN (SELECT email FROM wrong_emails)
AND is_active = true;

-- Zeige wie viele User geändert wurden
-- (sollte ~345 sein)

-- Aufräumen
DROP TABLE wrong_emails;

-- Verifizierung: Neue Zahlen
SELECT
  (SELECT count(*) FROM "user" WHERE is_active = true) AS "Aktive User nachher",
  (SELECT count(*) FROM subscription WHERE status = 'active') AS "Aktive Subs nachher";

COMMIT;
