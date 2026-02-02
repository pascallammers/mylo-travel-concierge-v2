# Requirements: Robuste Flugsuche

## REQ-001: LLM-basierte Airport-Extraktion
**Priority:** HIGH | **Status:** Complete

Ersetze die statische `airport-codes.ts` Mapping-Datei durch LLM-basierte Extraktion.

**Acceptance Criteria:**
- [x] xAI/Grok extrahiert IATA-Codes aus natürlicher Sprache
- [x] Kontext-Verständnis: "costa rica liberia" → LIR (nicht LIB)
- [x] Strukturierte Ausgabe via Vercel AI SDK
- [x] Fallback auf Duffel Places API wenn LLM unsicher

**Constraints:**
- Nutze bestehenden xAI/Grok Provider
- Keine zusätzlichen LLM-Anbieter
- Antwortzeit < 2s für Airport-Auflösung

---

## REQ-002: Alternative Flughäfen bei 0 Ergebnissen
**Priority:** MEDIUM | **Status:** Complete

Wenn Suche keine Treffer liefert, schlage automatisch nahegelegene Flughäfen vor.

**Acceptance Criteria:**
- [x] Nutze Duffel Places API für Nearby-Airports
- [x] Radius: 150km default (dynamisch je nach Region)
- [x] Zeige max 3 Alternativen
- [x] Klare UX: "Keine Flüge gefunden. Alternativen in der Nähe:"

---

## REQ-003: Flexible Datumssuche
**Priority:** LOW | **Status:** Complete

Bei 0 Ergebnissen optional +/- 3 Tage anbieten.

**Acceptance Criteria:**
- [x] Nutze bestehende Seats.aero date-range Funktion
- [x] Für Duffel: parallele Requests mit Rate-Limiting
- [x] User-Opt-in: "Auch andere Daten prüfen?"

---

## REQ-004: Fehler-Monitoring
**Priority:** MEDIUM | **Status:** Complete

Tracke fehlgeschlagene Suchen für proaktive Verbesserung.

**Acceptance Criteria:**
- [x] Logge: Query, extrahierte Codes, Ergebnis-Count, Timestamp
- [x] Speichere in DB-Tabelle (PostgreSQL via Drizzle)
- [x] Einfaches Dashboard unter /admin/failed-searches

---

## Out of Scope

- Buchungsfunktion (existiert bereits)
- Neue Flug-APIs (Duffel + Seats.aero bleiben)
- UI-Redesign
- Multi-Language Support (Deutsch reicht)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-001 | Phase 1 | Complete |
| REQ-002 | Phase 2 | Complete |
| REQ-003 | Phase 3 | Complete |
| REQ-004 | Phase 3 | Complete |
