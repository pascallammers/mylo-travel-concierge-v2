# PRD: AwardWallet Chatbot Integration

## 1. Introduction/Overview

Der MYLO-Chatbot soll die Punktestände aus der AwardWallet-Integration eines Users kennen und aktiv damit arbeiten können. Aktuell werden die Loyalty-Daten zwar gespeichert und in der UI angezeigt, aber der Chatbot hat keinen Zugriff darauf.

**Problem:** User fragen den Chatbot nach ihren Punkteständen oder Buchungsoptionen mit Punkten, aber der Chatbot kann diese Informationen nicht abrufen.

**Ziel:** Der Chatbot kennt automatisch die Punktestände des Users und kann damit Berechnungen durchführen, Empfehlungen geben und auf Deal-Anfragen reagieren.

---

## 2. Goals

1. **Automatische Kontextbereitstellung:** Bei jedem Chat hat der Chatbot Zugriff auf die aktuellen Loyalty-Punktestände des Users
2. **Interaktive Abfrage:** Der Chatbot kann detaillierte Informationen zu einzelnen Loyalty-Programmen abrufen
3. **Proaktive Empfehlungen:** Der Chatbot kann basierend auf Punkteständen Buchungsvorschläge machen
4. **Verbindungsförderung:** User ohne AwardWallet-Verbindung werden proaktiv auf die Möglichkeit hingewiesen

---

## 3. User Stories

### US-1: Punktestand abfragen
> Als User mit verbundenem AwardWallet möchte ich meinen Chatbot nach meinen Punkteständen fragen können, damit ich schnell einen Überblick habe.

**Akzeptanzkriterien:**
- Chatbot nennt Gesamtpunkte und Aufschlüsselung nach Anbieter
- Antwort erfolgt ohne Verzögerung (Daten sind bereits im Kontext)
- Formatierung ist übersichtlich und lesbar

### US-2: Buchung mit Punkten
> Als User möchte ich den Chatbot fragen können, ob ich einen bestimmten Flug/Hotel mit meinen Punkten bezahlen kann.

**Akzeptanzkriterien:**
- Chatbot vergleicht benötigte Punkte mit verfügbarem Kontostand
- Chatbot gibt klare Ja/Nein-Antwort mit Begründung
- Bei ausreichenden Punkten: Empfehlung zur Einlösung

### US-3: Deal-Empfehlungen
> Als User möchte ich, dass der Chatbot mir proaktiv sagt, wenn ein Deal zu meinen Punkteständen passt.

**Akzeptanzkriterien:**
- Chatbot berücksichtigt Punktestände bei Deal-Anfragen
- Personalisierte Empfehlungen basierend auf verfügbaren Programmen
- Hinweis auf alternative Einlösungsmöglichkeiten

### US-4: Verbindungshinweis
> Als User ohne AwardWallet-Verbindung möchte ich vom Chatbot erfahren, dass ich diese Funktion nutzen kann.

**Akzeptanzkriterien:**
- Proaktiver Hinweis wenn User nach Punkten fragt
- Hinweis auf Vorteile der Verbindung
- Link/Anleitung zur Einrichtung in den Einstellungen

---

## 4. Functional Requirements

### FR-1: System-Kontext Integration
- **FR-1.1:** Bei Chat-Initialisierung müssen die Loyalty-Daten des Users aus der Datenbank geladen werden
- **FR-1.2:** Die Daten müssen im System-Prompt für den Chatbot verfügbar sein
- **FR-1.3:** Format im System-Prompt:
  ```
  User Loyalty Data:
  - Total Points: 185,000
  - Miles & More: 75,000 miles (Status: Senator)
  - Amex Membership Rewards: 50,000 points
  - Hilton Honors: 60,000 points
  - Last synced: 2026-01-20
  ```
- **FR-1.4:** Bei nicht verbundenem AwardWallet: "User has not connected AwardWallet. Suggest connecting when relevant."

### FR-2: Loyalty Balance Tool
- **FR-2.1:** Neues Tool `get_loyalty_balances` erstellen
- **FR-2.2:** Tool-Parameter:
  - `provider` (optional): Filter nach spezifischem Anbieter (z.B. "milesandmore", "amex")
  - `includeDetails` (optional): Erweiterte Infos wie Elite-Status, Ablaufdatum
- **FR-2.3:** Tool-Rückgabe:
  ```typescript
  {
    connected: boolean;
    lastSyncedAt: string | null;
    totalPoints: number;
    accounts: Array<{
      providerName: string;
      providerCode: string;
      balance: number;
      balanceUnit: string;
      eliteStatus?: string;
      expirationDate?: string;
    }>;
  }
  ```
- **FR-2.4:** Tool soll Datenbank abfragen, nicht AwardWallet API direkt (cached data)

### FR-3: Chatbot-Verhalten
- **FR-3.1:** Bei Fragen zu Punkten: Direkte Antwort aus System-Kontext
- **FR-3.2:** Bei Detail-Anfragen: Tool aufrufen für aktuelle Daten
- **FR-3.3:** Bei Buchungsanfragen: Punktestände in Entscheidung einbeziehen
- **FR-3.4:** Bei Deal-Anfragen: Personalisierte Empfehlungen basierend auf Kontoständen
- **FR-3.5:** Ohne AwardWallet-Verbindung: Proaktiv auf Einstellungen verweisen

### FR-4: Datenaktualität
- **FR-4.1:** System-Kontext verwendet cached Daten aus DB
- **FR-4.2:** `lastSyncedAt` Timestamp wird dem Chatbot mitgeteilt
- **FR-4.3:** Chatbot kann bei veralteten Daten (>24h) Sync empfehlen

---

## 5. Non-Goals (Out of Scope)

- **Kein Live-Sync:** Der Chatbot löst keinen AwardWallet-Sync aus; er nutzt nur cached Daten
- **Keine Buchungsdurchführung:** Der Chatbot empfiehlt nur, führt keine Award-Buchungen durch
- **Keine Punktetransfers:** Keine Funktion zum Transferieren von Punkten zwischen Programmen
- **Keine Punktebewertung:** Keine komplexe Cents-per-Point Berechnung (kann später ergänzt werden)
- **Kein Multi-User Support:** Nur der aktuell eingeloggte User kann seine Daten sehen

---

## 6. Design Considerations

### UI/UX
- Keine UI-Änderungen erforderlich (rein Backend/AI-Integration)
- Chatbot-Antworten sollten Punktestände übersichtlich formatieren (ggf. als Tabelle)
- Anbieter-Logos könnten in Chat-Antworten eingebunden werden (optional)

### Formatierung der Chatbot-Antworten
```
📊 **Deine Punkteübersicht:**

| Programm | Punkte | Status |
|----------|--------|--------|
| Miles & More | 75.000 | Senator |
| Amex MR | 50.000 | - |
| Hilton Honors | 60.000 | Gold |

**Gesamt:** 185.000 Punkte
*Zuletzt aktualisiert: vor 2 Stunden*
```

---

## 7. Technical Considerations

### Bestehende Infrastruktur
- `lib/db/queries/awardwallet.ts` - Bereits implementierte DB-Queries
  - `getUserLoyaltyData(userId)` - Liefert alle benötigten Daten
  - `getConnection(userId)` - Prüft Verbindungsstatus
- `lib/db/schema.ts` - Tabellen `awardwalletConnections` und `loyaltyAccounts` existieren
- AwardWallet-Daten werden bereits per Cron synchronisiert (`/api/cron/awardwallet-sync`)

### Zu implementieren
1. **System-Prompt Enhancement** (`/ai/system-prompt.ts` oder ähnlich)
   - Loyalty-Daten beim Chat-Start laden
   - In System-Prompt injizieren

2. **Neues Tool** (`/lib/tools/loyalty-balances.ts`)
   - Tool-Definition für AI SDK
   - Nutzt bestehende `getUserLoyaltyData()` Query

3. **Tool Registration** (`/lib/tools/index.ts`)
   - Tool in Tool-Registry aufnehmen

### Abhängigkeiten
- Bestehende AwardWallet-Integration muss funktionieren
- User muss authentifiziert sein
- Drizzle ORM Queries für Datenbankzugriff

### Performance
- DB-Query sollte <50ms dauern (indexed on userId)
- Daten werden nicht bei jeder Nachricht neu geladen, nur bei Chat-Start
- Tool-Aufrufe nutzen cached DB-Daten, nicht AwardWallet API

---

## 8. Success Metrics

| Metrik | Ziel | Messmethode |
|--------|------|-------------|
| Korrekte Punktestand-Antworten | 100% | Manuelle Tests |
| Antwortzeit bei Punktefragen | <2s | Performance Monitoring |
| User mit AwardWallet-Verbindung | +20% nach Launch | DB Analytics |
| Buchungsempfehlungen mit Punkten | Messbar | Chat-Logs Analyse |

### Definition of Done
- [ ] Chatbot nennt korrekte Punktestände aus DB
- [ ] Tool `get_loyalty_balances` funktioniert
- [ ] Nicht-verbundene User erhalten Hinweis
- [ ] Unit Tests für Tool und System-Prompt Logic
- [ ] Integration Tests für End-to-End Flow

---

## 9. Open Questions

1. **Punktebewertung:** Soll der Chatbot später auch Wert-Einschätzungen geben können? (z.B. "Deine 75.000 Meilen sind ca. 1.500€ wert")

2. **Sync-Trigger:** Soll der User über den Chat einen manuellen Sync anstoßen können?

3. **Benachrichtigungen:** Soll der Chatbot proaktiv informieren wenn Punkte ablaufen?

4. **Multi-Currency:** Wie sollen verschiedene Einheiten (Miles, Points, Meilen) in Gesamt-Übersichten behandelt werden?

5. **Datenschutz:** Soll der User kontrollieren können, ob der Chatbot seine Punktedaten "kennt"?

---

## Appendix: Existing Database Schema

```typescript
// awardwalletConnections table
{
  id: string;
  userId: string;           // Reference to user
  awUserId: string;         // AwardWallet user ID
  status: 'connected' | 'disconnected' | 'error';
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// loyaltyAccounts table
{
  id: string;
  connectionId: string;     // Reference to connection
  providerCode: string;     // e.g., "LH" for Miles & More
  providerName: string;     // e.g., "Miles & More"
  balance: number;
  balanceUnit: string;      // e.g., "miles", "points"
  eliteStatus: string | null;
  expirationDate: Date | null;
  accountNumber: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

*PRD erstellt am: 2026-01-21*
*Feature: AwardWallet Chatbot Integration*
