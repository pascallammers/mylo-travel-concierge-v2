# Requirements: AwardWallet Integration

## Gathered Requirements

### 1. User Onboarding & Account Handling

**Decision**: Info-Hinweis mit Link zur AwardWallet-Registrierung (Option a)
- Wenn User keinen AwardWallet Account hat, wird ein freundlicher Hinweis angezeigt
- Link zur AwardWallet-Registrierung bereitstellen
- Kein alternativer Flow mit direkter Credential-Eingabe (Web Parsing API)

### 2. UI Placement - Connect Button

**Decision**: Einstellungen + Startseite
- Primär: In den Einstellungen unter eigenem Bereich/Tab
- Sekundär: Button auf der Startseite für schnellen Zugang
- Nicht im Onboarding-Flow oder als AI-Prompt

### 3. Header-Anzeige der Punkte

**Decision**: Top Programme als Icons mit Werten (Option b)
- 2-3 Programme mit höchsten Punkteständen anzeigen
- Programm-Icons/Logos mit Punktewerten
- Kompakte Darstellung im Header

### 4. Detailansicht in Settings

**Decision**: Gleichwertig, sortiert nach Punktestand
- Alle Programme gleichwertig darstellen
- Sortierung: Höchste Punktanzahl zuerst
- Keine Priorisierung nach Nutzungshäufigkeit

### 5. Daten-Refresh Strategie

**Decision**: Automatisch alle 6 Stunden
- Hintergrund-Job aktualisiert Daten alle 6 Stunden
- Zusätzlich: Manueller Refresh auf User-Wunsch möglich
- Keine Live-Abfrage bei jedem Chat-Start

### 6. Daten-Caching

**Decision**: DB-Cache mit Live-Update bei Refresh
- Aktuelle Werte werden in der DB gespeichert
- Bei Neuabfrage (manuell oder 6h-Intervall):
  - Live-Abfrage von AwardWallet API
  - Überschreiben der DB-Werte mit neuen Daten
- UI zeigt immer gecachte DB-Werte (schnell)

### 7. AI Integration Tiefe

**Decision**: Advanced - Proaktive Empfehlungen (Option c)
- AI kennt alle Punktestände des Users
- Proaktive Vorschläge: "Du hast genug Miles bei Lufthansa für Business Class nach Bangkok"
- Vergleich Cash vs. Miles bei Flugsuchen
- Optimale Einlösungsstrategien vorschlagen

### 8. Punkteverfall-Warnungen

**Decision**: Ja, implementieren
- MYLO warnt proaktiv wenn Meilen/Punkte bald verfallen
- Expiration-Daten aus AwardWallet API nutzen
- Timing: Bei Chat-Start prüfen und ggf. warnen

---

## Feature Summary

| Feature | Priorität | Komplexität |
|---------|-----------|-------------|
| OAuth2 Connection Flow | Must-Have | Medium |
| DB Schema für Loyalty Data | Must-Have | Low |
| Settings UI (Connect/Disconnect) | Must-Have | Medium |
| Startseite Connect Button | Should-Have | Low |
| Header Punkteanzeige | Must-Have | Medium |
| 6h Auto-Refresh Job | Must-Have | Medium |
| AI Context Integration | Must-Have | High |
| Proaktive Empfehlungen | Should-Have | High |
| Punkteverfall-Warnungen | Nice-to-Have | Medium |

---

## API Entscheidung

**Primär**: Account Access API (OAuth2)
- Kostenlos
- User muss AwardWallet Account haben
- Sicherer (keine Credentials in MYLO)

**Nicht verwendet**: Web Parsing API
- Kostenpflichtig
- Würde Credentials erfordern
- Nicht notwendig wenn User AwardWallet Account hat

---

## Open Items

- [ ] AwardWallet Business Account für API-Zugang beantragen
- [ ] Redirect URI bei AwardWallet registrieren
- [ ] Design für Header-Komponente mit Punkten
- [ ] Design für Settings-Seite AwardWallet-Bereich
