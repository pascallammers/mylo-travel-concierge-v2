# Phase 3: Observability & Enhancement - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Track failed searches for improvement insights and add flexible date search to find more flight options. Logging captures query data for manual pattern review. Flexible dates activate as fallback when exact search returns no results.

</domain>

<decisions>
## Implementation Decisions

### Logging-Strategie
- Log failed searches only (not successful ones)
- Data captured: Query-Text, extrahierte IATA-Codes, Datum, Timestamp, Session-ID/anonymer User-Identifier
- Retention: 30 Tage, dann automatisch löschen
- Admin-Seite in der App für Log-Ansicht (nutzt existierenden Admin-Bereich mit Rollenverwaltung)
- Filter: Datumsspanne + Freitext-Suche in Queries

### Flexible Datumssuche UX
- Aktivierung: Automatisch bei 0 Ergebnissen anbieten (nicht proaktiv im Formular)
- Datumsbereich: ±3 Tage (7-Tage-Fenster)
- Nur bei leeren Ergebnissen — kein Preis-basierter Hinweis
- UI-Präsentation des Angebots: Claude's Discretion (konsistent mit Phase 2 Alternative Airports)

### Failure-Pattern-Analyse
- Manuelle Review — keine automatische Gruppierung oder Pattern-Erkennung
- Keine Alerts — passive Logs, Admin schaut selbst rein
- Zugriff über existierenden Admin-Bereich (bestehende Rollenverwaltung nutzen)

### Ergebnisdarstellung bei flexiblen Daten
- Sortierung: Kombiniert — Datum sichtbar + Preis-Badge zeigt günstigere Tage
- Keine Hervorhebung des Original-Datums — alle Optionen gleichwertig
- Maximum: Top 10 Flüge gesamt über alle 7 Tage
- Kommunikation: Inline bei jedem Flug (Datum prominent) — kein separates Banner

### Claude's Discretion
- UI-Präsentation des "Mit flexiblen Daten suchen?" Angebots (Dialog vs. Inline)
- Admin-Seite Layout und Tabellen-Design
- Exakte Preis-Badge Gestaltung
- Datums-Format in Ergebnisliste

</decisions>

<specifics>
## Specific Ideas

- Existierender Admin-Bereich soll genutzt werden — keine neue Auth-Struktur
- Konsistenz mit Phase 2 bei der "Erneut suchen?" UX gewünscht

</specifics>

<deferred>
## Deferred Ideas

- Automatische Pattern-Gruppierung in Admin-UI — später wenn Logging-Daten vorliegen
- Email-Alerts bei häufigen Failures — future enhancement
- Proaktiver Preis-Hinweis "Günstigere Flüge an anderen Tagen" — eigene Phase

</deferred>

---

*Phase: 03-observability-enhancement*
*Context gathered: 2026-02-02*
