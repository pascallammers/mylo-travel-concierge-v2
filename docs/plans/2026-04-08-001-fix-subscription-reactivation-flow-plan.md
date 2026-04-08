---
title: "fix: Subscription Reactivation Flow — Re-Purchase nach Kündigung"
type: fix
status: active
date: 2026-04-08
---

# Subscription Reactivation Flow — Re-Purchase nach Kündigung

## Overview

Wenn ein gekündigter/deaktivierter User MYLO erneut kauft, bekommt er nicht zuverlässig Zugriff zurück. Drei unkoordinierte Systeme (Webhook-Handler, Cron-Sync, Admin-Dashboard) können sich gegenseitig den Subscription-State überschreiben. Das Ergebnis: der Kunde zahlt, kann sich aber nicht einloggen.

## Problem Frame

Konkreter Fall (matthias_gerber@hotmail.com, 08.04.2026): User war durch das Reconciliation-Script vom 02.04. korrekt deaktiviert worden (Ghost-User ohne MYLO-Abo). Am 08.04. kaufte er tatsächlich MYLO. Der Webhook meldete success, aber bei manueller Prüfung 7 Stunden später war die Subscription immer noch `status='canceled'` mit der alten `currentPeriodEnd`. Die Webhook-Änderungen hatten nicht persistiert — vermutlich überschrieben durch den Cron-Sync.

Zusätzlich: Das Admin-Dashboard setzt `cancelAtPeriodEnd` nicht zurück bei manueller Reaktivierung, was dazu führt, dass der nächste Cron den User erneut als "gekündigt" behandelt.

## Requirements Trace

- R1. Ein User, der MYLO erneut kauft (nach Kündigung, Refund, oder Deaktivierung), bekommt sofort vollen Zugriff
- R2. Der Cron-Sync darf kürzliche Webhook-Reaktivierungen nicht überschreiben
- R3. Das Admin-Dashboard muss bei manueller Reaktivierung alle Cancellation-Flags zurücksetzen
- R4. Jede Reaktivierung wird im Admin-Activity-Log dokumentiert
- R5. Der aktuelle Kundenfall (matthias_gerber@hotmail.com, cancelAtPeriodEnd=true) wird sofort behoben

## Scope Boundaries

- NICHT: Umstrukturierung des gesamten Sync-Systems
- NICHT: Änderung der ThriveCart-Produktkonfiguration
- NICHT: Änderung der Access-Control-Logik (checkUserAccess/doesSubscriptionGrantAccess)
- NICHT: Änderung des Reconciliation-Scripts (das war ein einmaliger Cleanup)

## Context & Research

### Relevant Code and Patterns

- `lib/thrivecart/webhook-handler.ts` — handleOrderSuccess (Zeile 110-228): Hauptlogik für neue Käufe. Ruft extendSubscriptionPeriod und reactivateUser auf
- `app/api/webhooks/subscription/_lib/helpers.ts` — extendSubscriptionPeriod (Zeile 73-110): Setzt bereits `cancelAtPeriodEnd: false` und `canceledAt: null`. Die Logik selbst ist korrekt
- `lib/thrivecart/sync.ts` — runFullSync (Zeile 87-106): Prüft TC-API auf MYLO-Abo. Wenn keins gefunden, wird die Subscription re-cancelled — ohne zu prüfen ob ein kürzliches Webhook-Event existiert
- `app/api/admin/users/[id]/subscription/route.ts` — PATCH (Zeile 44-78): Aktualisiert status und currentPeriodEnd, aber setzt cancelAtPeriodEnd, canceledAt, endedAt NICHT zurück
- `lib/thrivecart/webhook-handler.ts` — handleOrderSuccess Zeile 145: `if (!existingUser.isActive) await reactivateUser(...)` — wird korrekt aufgerufen wenn User inaktiv
- `lib/db/schema.ts` — thrivecartWebhookLog Table mit processedAt-Timestamp für Webhook-Events

### Institutional Learnings

- Prior learning `[thrivecart-webhook-product-filter-missing]` (confidence 10/10): base_product-Filter war die Ursache für Ghost-Users, inzwischen gefixt
- Der vorherige Plan (2026-04-02-001) hat das Reconciliation-Script und den Archive-Flow eingeführt, aber den Re-Purchase-Flow nicht adressiert
- Sync-Log (thrivecart_sync_log) hat 0 Einträge — der Cron scheint nicht korrekt zu laufen oder vor dem Log-Insert zu scheitern

## Key Technical Decisions

- **Webhook-Schutz im Cron statt Cron-Deaktivierung**: Der Cron-Sync ist sinnvoll als Safety-Net. Statt ihn zu entfernen, bekommt er eine "kürzliches Webhook"-Prüfung. Wenn ein order.success-Event in den letzten 24h verarbeitet wurde, wird die Subscription nicht re-cancelled. Rationale: Der Webhook ist die aktuellere und zuverlässigere Quelle als die TC-API.

- **Admin-Endpoint erweitern statt Frontend-only-Fix**: cancelAtPeriodEnd wird serverseitig zurückgesetzt wenn status='active' gesetzt wird. Das schützt auch gegen API-Aufrufe außerhalb des Dashboards.

- **Webhook-Handler: Admin-Log bei Reaktivierung**: Jede automatische Reaktivierung durch einen Re-Purchase wird geloggt, damit im Dashboard sichtbar ist, dass der Webhook gehandelt hat (und nicht nur "success" im Log steht).

## Open Questions

### Resolved During Planning

- **Warum hat extendSubscriptionPeriod nicht persistiert?** Unklar — der Code ist korrekt und der Webhook meldet success. Vermutlich hat der Cron die Änderungen überschrieben bevor Pascal nachschaute. Alternativ ein Serverless-Connection-Issue. Der Sync-Schutz (Unit 2) verhindert in jedem Fall die Übersteuerung.

### Deferred to Implementation

- **Soll der Cron-Sync gefixt werden (leeres Sync-Log)?** Separates Issue. Das Sync-Log ist leer, was auf ein Auth- oder Connection-Problem hindeutet. Nicht Teil dieses Fixes, aber sollte untersucht werden.

## Implementation Units

- [ ] **Unit 1: Admin-Subscription-Endpoint — cancelAtPeriodEnd bei Reaktivierung zurücksetzen**

**Goal:** Wenn ein Admin die Subscription auf status='active' setzt, werden alle Cancellation-Flags automatisch zurückgesetzt.

**Requirements:** R3

**Dependencies:** Keine

**Files:**
- Modify: `app/api/admin/users/[id]/subscription/route.ts`
- Test: `app/api/admin/users/[id]/subscription/route.test.ts`

**Approach:**
- Im PATCH-Handler: wenn `body.status === 'active'`, automatisch `cancelAtPeriodEnd: false`, `canceledAt: null`, `endedAt: null` setzen
- Die zusätzlichen Felder werden dem `updates`-Objekt hinzugefügt, keine separate DB-Query nötig
- Pattern folgen von `extendSubscriptionPeriod` in helpers.ts, das dasselbe Set an Flags zurücksetzt

**Patterns to follow:**
- `extendSubscriptionPeriod` in `app/api/webhooks/subscription/_lib/helpers.ts` Zeile 96-106 — setzt dieselben Cancel-Flags

**Test scenarios:**
- Happy path: PATCH mit `{ status: 'active' }` → cancelAtPeriodEnd wird false, canceledAt wird null
- Happy path: PATCH mit `{ status: 'active', validUntil: '2026-05-08' }` → beide Felder plus Cancel-Flags werden korrekt gesetzt
- Edge case: PATCH mit `{ status: 'canceled' }` → cancelAtPeriodEnd wird NICHT geändert (kein Seiteneffekt bei Nicht-Aktivierung)
- Edge case: PATCH mit `{ validUntil: '2026-06-01' }` ohne status → Cancel-Flags werden NICHT geändert (nur explizite Aktivierung resettet)

**Verification:**
- Admin-Dashboard zeigt nach manueller Reaktivierung "active" statt "cancelled"
- Admin-Activity-Log enthält die resetted Cancel-Flags in den Changes

---

- [ ] **Unit 2: Cron-Sync — Webhook-Schutz vor Re-Cancel**

**Goal:** Der runFullSync-Cron darf eine Subscription nicht re-canceln wenn ein kürzliches order.success Webhook-Event für denselben User existiert.

**Requirements:** R2

**Dependencies:** Keine

**Files:**
- Modify: `lib/thrivecart/sync.ts`
- Test: `lib/thrivecart/sync.test.ts`

**Approach:**
- In runFullSync(), bevor `markSubscriptionCancelled` aufgerufen wird (Zeile 93-105 und Zeile 112-123): eine Prüfung gegen `thrivecart_webhook_log` einfügen
- Query: `SELECT 1 FROM thrivecart_webhook_log WHERE customer_email = $email AND event_type = 'order.success' AND processed_at > NOW() - INTERVAL '24 hours' AND result = 'success' LIMIT 1`
- Wenn ein kürzliches Event existiert: Skip statt Cancel, mit Log-Message `[ThriveCart Sync] Skipping ${email}: recent webhook event found, webhook is authoritative`
- Die 24h-Schwelle ist bewusst großzügig — sie deckt TC-API-Propagationsdelays und Cron-Timing ab
- Die Prüfung als wiederverwendbare Helper-Funktion `hasRecentWebhookEvent(email: string, hours?: number)` im selben File implementieren

**Patterns to follow:**
- Bestehende Webhook-Log-Queries in `webhook-handler.ts` Zeile 48-56 (Duplikat-Check)
- Bestehender Skip-Pattern in runFullSync Zeile 93 mit `continue`

**Test scenarios:**
- Happy path: User hat KEIN kürzliches Webhook-Event → Sync cancelled wie bisher
- Happy path: User hat kürzliches order.success Event (< 24h) → Sync überspringt Cancel
- Edge case: User hat kürzliches Event aber event_type ist 'order.subscription_cancelled' → Sync cancelled normal (nur order.success schützt)
- Edge case: User hat Event das 25h alt ist → Schutz greift nicht mehr, Sync cancelled normal
- Integration: Webhook verarbeitet order.success → Cron läuft innerhalb von 24h → Subscription bleibt active

**Verification:**
- Cron-Sync überspringt Subscriptions mit kürzlichem Webhook-Event
- Log-Output enthält die Skip-Message

---

- [ ] **Unit 3: Webhook-Handler — Admin-Log bei Reaktivierung**

**Goal:** Jede automatische Reaktivierung durch Re-Purchase wird im Admin-Activity-Log dokumentiert.

**Requirements:** R4

**Dependencies:** Keine

**Files:**
- Modify: `lib/thrivecart/webhook-handler.ts`

**Approach:**
- In handleOrderSuccess, nach erfolgreicher extendSubscriptionPeriod + reactivateUser: einen logAdminActivity-Aufruf einfügen
- Action: `webhook.reactivation_processed`
- Details: email, orderId, previousStatus (von existingSub), newPeriodEnd
- Pattern von handleSubscriptionCancelled Zeile 284-288 folgen (logAdminActivity mit Webhook-Kontext)
- Kein separater Test nötig — das Activity-Logging ist ein Fire-and-Forget Side-Effect, der bestehende Activity-Logger ist getestet

**Patterns to follow:**
- `handleSubscriptionCancelled` Zeile 284-288 — logAdminActivity nach Webhook-Processing

**Test expectation: none** — Activity-Logging ist ein idempotenter Side-Effect, der bestehende Logger hat eigene Tests. Integration wird durch Unit 2's Integration-Test abgedeckt.

**Verification:**
- Admin-Activity-Log enthält `webhook.reactivation_processed` Einträge nach Re-Purchases
- Dashboard zeigt Reaktivierungs-Events in der User-History

---

- [ ] **Unit 4: Sofort-Fix — matthias_gerber@hotmail.com cancelAtPeriodEnd zurücksetzen**

**Goal:** Den konkreten Kundenfall beheben (cancelAtPeriodEnd ist aktuell noch true).

**Requirements:** R5

**Dependencies:** Unit 1 (damit der Fix über das Admin-Dashboard nachvollziehbar ist, oder alternativ per SQL)

**Files:**
- Keine Code-Änderung — DB-Update per SQL oder Admin-Dashboard

**Approach:**
- Subscription `9669e5b3b4bc72ae76f66f3e88f0166b`: `cancelAtPeriodEnd = false`, `canceledAt = null` setzen
- Kann nach Unit 1 über das Admin-Dashboard gemacht werden, oder direkt per SQL:
  `UPDATE subscription SET "cancelAtPeriodEnd" = false, "canceledAt" = null, "modifiedAt" = now() WHERE id = '9669e5b3b4bc72ae76f66f3e88f0166b'`

**Test expectation: none** — Einmaliger Daten-Fix, kein Code.

**Verification:**
- Subscription zeigt cancelAtPeriodEnd=false in der DB
- Admin-Dashboard zeigt "active" für diesen User (nicht "cancelled")

## System-Wide Impact

- **Interaction graph:** Der Cron-Sync (alle 6h) und der Webhook-Handler teilen sich den Subscription-State. Die neue Webhook-Log-Prüfung im Sync schafft eine explizite Koordination zwischen beiden. Der Admin-Endpoint wird unabhängig gefixt.
- **Error propagation:** Wenn die Webhook-Log-Query im Sync fehlschlägt (DB-Timeout), sollte der Sync konservativ handeln und den Cancel NICHT durchführen (fail-safe). Ein fehlendes Webhook-Log ist kein Beweis für fehlendes Abo.
- **State lifecycle risks:** Die cancelAtPeriodEnd/canceledAt Flags können nach dem Fix nur noch explizit gesetzt werden durch: (1) Webhook subscription_cancelled Event, (2) Admin-Dashboard Aktion. Der Cron-Sync setzt diese Flags weiterhin, aber nur wenn kein kürzliches Webhook-Event existiert.
- **API surface parity:** Keine externe API betroffen.
- **Unchanged invariants:** checkUserAccess und doesSubscriptionGrantAccess bleiben unverändert. Die Access-Control-Logik prüft `isActive`, `status`, und `currentPeriodEnd` — nicht `cancelAtPeriodEnd`. Das bedeutet cancelAtPeriodEnd ist ein internes Tracking-Flag, kein Access-Gate.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Cron-Sync-Log ist leer (Cron läuft möglicherweise nicht) | Separates Issue. Dieser Fix schützt trotzdem, weil er den Sync-Code ändert der beim nächsten erfolgreichen Run greift |
| 24h-Schutzfenster könnte zu kurz sein wenn TC-API langsam propagiert | 24h ist sehr großzügig für API-Propagation (normalerweise Minuten). Bei Bedarf auf 48h erweiterbar |
| extendSubscriptionPeriod könnte in Serverless-Umgebung silent-failen | Unit 3 (Admin-Log) macht Reaktivierungen sichtbar. Wenn kein Log-Eintrag erscheint, ist das ein Alarm-Signal |

## Sources & References

- Related plan: [2026-04-02-001-fix-thrivecart-data-integrity-plan.md](docs/plans/2026-04-02-001-fix-thrivecart-data-integrity-plan.md)
- Related commit: `4b058ba` — base_product=5 Filter
- Related commit: `b5886d2` — ThriveCart data integrity cleanup
- Untersuchter Kundenfall: matthias_gerber@hotmail.com (User-ID: 3dac519b065d72cf2c824806d52a05a4)
