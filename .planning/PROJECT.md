# Robuste Flugsuche

## What This Is

Mylo Travel Concierge Flugsuche mit intelligenter LLM-basierter Airport-Auflösung, automatischen Alternativen bei leeren Ergebnissen, und proaktivem Fehler-Monitoring. Das System versteht natürliche Sprache, schlägt nahegelegene Flughäfen vor, und bietet flexible Datumsoptionen.

## Core Value

**Kunden bekommen immer hilfreiche Fluginformationen** — selbst wenn die exakte Suche keine Treffer liefert, bieten wir relevante Alternativen an.

## Requirements

### Validated

v1.0 Robuste Flugsuche (shipped 2026-02-02):
- ✓ LLM-basierte Airport-Code-Extraktion aus natürlicher Sprache — v1.0
- ✓ Kontext-Verständnis für mehrdeutige Städte (Liberia, San Jose) — v1.0
- ✓ Performance Cache für LLM-Extractions (24h TTL) — v1.0
- ✓ User Correction Cache (7-Tage TTL) — v1.0
- ✓ Alternative Flughäfen bei leeren Ergebnissen (max 3, Drive-Time) — v1.0
- ✓ Flexible Datumssuche (±3 Tage) als Fallback — v1.0
- ✓ Failed Search Logging mit Admin Dashboard — v1.0
- ✓ Vollständige Fallback-Chain: Exact → Flexible → Alternatives → Error — v1.0

Existierende Funktionalität (vor v1.0):
- ✓ Flugsuche via Duffel API (Cash-Flüge) — existing
- ✓ Award-Suche via Seats.aero — existing
- ✓ Round-Trip und One-Way Suche — existing
- ✓ Kabinen-Klassen-Auswahl — existing
- ✓ Google Flights / Skyscanner Fallback-Links — existing

### Active

(Für nächsten Milestone definieren via `/gsd:new-milestone`)

### Out of Scope

- Buchungsfunktion — existiert bereits, wird nicht geändert
- Neue Flug-APIs — Duffel + Seats.aero bleiben die Quellen
- UI-Redesign — nur Backend/Tool-Verbesserungen
- Multi-Language Support — Deutsch reicht für aktuelle Zielgruppe

## Context

**Shipped:** v1.0 Robuste Flugsuche (2026-02-02)

**Codebase:** 85.786 LOC TypeScript
**Tech Stack:** Next.js 15, TypeScript, Vercel AI SDK, xAI/Grok, PostgreSQL/Drizzle, Duffel API, Seats.aero API

**Architektur-Highlights:**
- `lib/utils/llm-airport-resolver.ts` — LLM extraction mit Zod structured output
- `lib/utils/airport-codes.ts` — Drei-stufige Resolution (Direct → Static → LLM)
- `lib/api/duffel-client.ts` — getNearbyAirports, searchDuffelFlexibleDates
- `lib/tools/flight-search.ts` — Vollständige Fallback-Chain
- `lib/db/queries/failed-search.ts` — Logging und Admin queries

## Constraints

- **Tech Stack**: Next.js 15, TypeScript, Vercel AI SDK, xAI/Grok als primärer LLM
- **API-Limits**: Duffel Rate-Limits (max 3 concurrent für flexible dates)
- **Kosten**: LLM-Calls minimiert durch 24h Cache
- **UX**: Antwortzeit <2s für Airport-Auflösung (Timeout enforced)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM-First für Airport-Lookup | Nutzer schreiben natürliche Sprache, LLM versteht Kontext | ✓ Funktioniert (liberia+costa rica=LIR) |
| Drei-tier Resolution | Performance: Direct codes und static mapping vor LLM | ✓ Minimiert API-Calls |
| Drive-Time statt Distanz | Benutzer können Fahrtzeit besser einschätzen | ✓ Bessere UX |
| Major Hub Heuristic | Intelligent raten welcher Airport Alternativen braucht | ✓ Meist korrekt |
| Non-blocking Logging | Fehler-Logging darf Tool nicht blockieren | ✓ Stabil |
| Batched Duffel Requests | Rate-Limits respektieren | ✓ Max 3 concurrent |
| 30-day TTL mit Cron | Einfacher als DB-level TTL | ✓ Funktioniert |

---
*Last updated: 2026-02-02 after v1.0 milestone*
