# Robuste Flugsuche

## What This Is

Verbesserung der Mylo Travel Concierge Flugsuche, damit Kunden zuverlässiger Ergebnisse erhalten. Das System soll intelligenter Airport-Codes auflösen, bei fehlenden Ergebnissen automatisch Alternativen vorschlagen, und Probleme frühzeitig durch Monitoring erkennen.

## Core Value

**Kunden bekommen immer hilfreiche Fluginformationen** — selbst wenn die exakte Suche keine Treffer liefert, bieten wir relevante Alternativen an.

## Requirements

### Validated

Existierende Flugsuche-Funktionalität:

- ✓ Flugsuche via Duffel API (Cash-Flüge) — existing
- ✓ Award-Suche via Seats.aero — existing
- ✓ Statisches Airport-Code-Mapping — existing
- ✓ Round-Trip und One-Way Suche — existing
- ✓ Kabinen-Klassen-Auswahl — existing
- ✓ Google Flights / Skyscanner Fallback-Links — existing

### Active

- [ ] LLM-basierte Airport-Code-Extraktion aus natürlicher Sprache
- [ ] Fallback-Chain: LLM → statisches Mapping → API-Lookup
- [ ] Alternative Flughäfen bei leeren Ergebnissen (geografisch nah)
- [ ] Flexible Datumssuche (+/- 1-3 Tage) wenn exaktes Datum keine Treffer
- [ ] Alternative Kabinen-Vorschläge wenn gewählte Klasse nicht verfügbar
- [ ] Fehlerhafte Suchen loggen und tracken
- [ ] Dashboard/Alert für häufige Fehlschläge

### Out of Scope

- Buchungsfunktion (existiert bereits, wird nicht geändert) — außerhalb dieses Projekts
- Neue Flug-APIs integrieren — Duffel + Seats.aero bleiben die Quellen
- UI-Redesign — nur Backend-Verbesserungen

## Context

**Auslöser:** Kundin suchte "Frankfurt nach costa rica liberia" — keine Ergebnisse, obwohl Duffel direkt Flüge zeigt. Problem: "liberia" war nicht im Airport-Mapping, wurde zu "LIB" statt "LIR" aufgelöst.

**Quick Fix bereits implementiert:**
- Central America Airports (inkl. LIR) hinzugefügt
- max_connections von 1 auf 2 erhöht
- Commit: `2f6b982`

**Architektur-Kontext:**
- Flugsuche läuft über `lib/tools/flight-search.ts` (AI Tool)
- Airport-Auflösung in `lib/utils/airport-codes.ts`
- Duffel-Client in `lib/api/duffel-client.ts`
- XAI (Grok) ist aktuell der primäre LLM-Provider

## Constraints

- **Tech Stack**: Next.js 15, TypeScript, Vercel AI SDK, XAI/Grok als primärer LLM
- **API-Limits**: Duffel hat Rate-Limits, parallele Alternativ-Suchen müssen throttled werden
- **Kosten**: LLM-Calls für Airport-Extraktion sollten minimal gehalten werden (Caching)
- **UX**: Antwortzeit sollte nicht signifikant steigen (<2s zusätzlich für Alternativen)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM-First für Airport-Lookup | Nutzer schreiben natürliche Sprache, LLM versteht Kontext besser als Pattern-Matching | — Pending |
| Geografische Nähe für Alternative Airports | Logischer Fallback, Kunden akzeptieren nahegelegene Flughäfen | — Pending |
| Monitoring via Vercel Logs + eigene Tabelle | Keine zusätzliche Infrastruktur nötig | — Pending |

---
*Last updated: 2026-02-02 after initialization*
