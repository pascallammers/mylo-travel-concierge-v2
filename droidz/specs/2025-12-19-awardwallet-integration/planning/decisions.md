# Key Decisions: AwardWallet Integration

## Architecture Decisions

### AD-1: API Choice - Account Access API Only

**Context**: AwardWallet bietet zwei APIs an:
- Account Access API (OAuth2, kostenlos)
- Web Parsing API (Credentials, kostenpflichtig)

**Decision**: Nur Account Access API verwenden

**Rationale**:
- Kostenlos = keine laufenden API-Kosten
- Sicherer: Keine User-Credentials in MYLO gespeichert
- OAuth2 ist Industry-Standard
- User haben volle Kontrolle über geteilte Daten

**Consequence**: User müssen AwardWallet Account haben. Wer keinen hat, bekommt Info-Hinweis.

---

### AD-2: Data Storage - Cached in DB

**Context**: Loyalty-Daten können live abgefragt oder gecached werden.

**Decision**: In PostgreSQL DB cachen, bei Refresh überschreiben

**Rationale**:
- Schnelle UI-Darstellung (keine API-Latenz)
- Reduziert API-Calls
- Daten verfügbar auch wenn AwardWallet offline
- 6h-Intervall ist ausreichend aktuell für Punktestände

**Schema-Konzept**:
```
awardwallet_connections
├── id
├── user_id (FK → users)
├── aw_user_id (AwardWallet userId)
├── connected_at
├── last_synced_at
└── status (connected/disconnected)

loyalty_accounts
├── id
├── connection_id (FK → awardwallet_connections)
├── provider_code (e.g., "aa", "hhonors")
├── provider_name
├── balance
├── balance_unit (miles/points/nights)
├── elite_status
├── expiration_date
├── account_number (masked?)
└── updated_at
```

---

### AD-3: Refresh Strategy - 6 Hour Intervals

**Context**: Wie oft sollen Daten aktualisiert werden?

**Decision**: Automatisch alle 6 Stunden + manueller Refresh

**Implementation**:
- Cron-Job / Vercel Cron alle 6 Stunden
- "Refresh" Button in Settings für sofortige Aktualisierung
- `last_synced_at` Timestamp tracken

**Rationale**:
- Punktestände ändern sich nicht minütlich
- 6h ist guter Kompromiss zwischen Aktualität und API-Last
- Manueller Refresh für Edge-Cases

---

### AD-4: AI Integration - Full Context Injection

**Context**: Wie tief soll AI die Loyalty-Daten nutzen?

**Decision**: Vollständige Integration mit proaktiven Empfehlungen

**Implementation**:
- System-Prompt enthält alle Loyalty-Balances
- Bei Flugsuchen: Vergleich Cash vs. Miles
- Proaktive Vorschläge wenn Route mit vorhandenen Miles buchbar
- Expiration-Warnungen bei Chat-Start

**Prompt-Injection Format**:
```
User's Loyalty Balances:
- Lufthansa Miles & More: 85,000 miles (Elite: Senator, expires: 2025-06-15)
- Hilton Honors: 120,000 points (Elite: Gold)
- American Airlines AAdvantage: 45,000 miles
```

---

### AD-5: Header Display - Top 2-3 Programs

**Context**: Wie Punkte im Header anzeigen?

**Decision**: Icons der Top 2-3 Programme mit Werten

**Implementation**:
- Sortiert nach Punktestand (höchste zuerst)
- Max 3 Programme im Header
- Kompakte Darstellung: `[Logo] 85k | [Logo] 120k`
- Click → öffnet Settings/Detail-View
- Responsive: Auf Mobile ggf. nur 1-2 oder Collapse

---

### AD-6: Expiration Warnings

**Context**: Soll MYLO vor Punkteverfall warnen?

**Decision**: Ja, proaktive Warnungen implementieren

**Implementation**:
- Bei Chat-Start: Prüfen ob Punkte in nächsten 30/60 Tagen verfallen
- Warnung als AI-Message am Anfang des Chats
- Nicht bei jedem Chat, sondern 1x pro Tag max
- DB-Flag `expiration_warning_shown_at` tracken

**Example Message**:
> "Heads up! Deine 15,000 Lufthansa Miles verfallen am 15. Juni. Soll ich dir zeigen, wofür du sie einlösen könntest?"

---

## UI/UX Decisions

### UX-1: Connect Button Placement

- **Settings**: Eigener Bereich "Loyalty Programs" oder "AwardWallet"
- **Startseite**: Prominent platzierter Button für nicht-verbundene User
- **Nach Connection**: Startseiten-Button wird zur Punkteübersicht

### UX-2: No-Account Handling

- Freundlicher Hinweis: "Um deine Meilen zu tracken, brauchst du einen kostenlosen AwardWallet Account"
- Link zur AwardWallet Registrierung
- Kein alternativer Flow
