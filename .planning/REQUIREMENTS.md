# Requirements: Robuste Flugsuche

## REQ-001: LLM-basierte Airport-Extraktion
**Priority:** HIGH | **Status:** Active

Ersetze die statische `airport-codes.ts` Mapping-Datei durch LLM-basierte Extraktion.

**Acceptance Criteria:**
- [ ] xAI/Grok extrahiert IATA-Codes aus natürlicher Sprache
- [ ] Kontext-Verständnis: "costa rica liberia" → LIR (nicht LIB)
- [ ] Strukturierte Ausgabe via Vercel AI SDK
- [ ] Fallback auf Duffel Places API wenn LLM unsicher

**Constraints:**
- Nutze bestehenden xAI/Grok Provider
- Keine zusätzlichen LLM-Anbieter
- Antwortzeit < 2s für Airport-Auflösung

---

## REQ-002: Alternative Flughäfen bei 0 Ergebnissen
**Priority:** MEDIUM | **Status:** Active

Wenn Suche keine Treffer liefert, schlage automatisch nahegelegene Flughäfen vor.

**Acceptance Criteria:**
- [ ] Nutze Duffel Places API für Nearby-Airports
- [ ] Radius: 150km default
- [ ] Zeige max 3 Alternativen
- [ ] Klare UX: "Keine Flüge gefunden. Alternativen in der Nähe:"

---

## REQ-003: Flexible Datumssuche
**Priority:** LOW | **Status:** Active

Bei 0 Ergebnissen optional +/- 3 Tage anbieten.

**Acceptance Criteria:**
- [ ] Nutze bestehende Seats.aero date-range Funktion
- [ ] Für Duffel: parallele Requests mit Rate-Limiting
- [ ] User-Opt-in: "Auch andere Daten prüfen?"

---

## REQ-004: Fehler-Monitoring
**Priority:** MEDIUM | **Status:** Active

Tracke fehlgeschlagene Suchen für proaktive Verbesserung.

**Acceptance Criteria:**
- [ ] Logge: Query, extrahierte Codes, Ergebnis-Count, Timestamp
- [ ] Speichere in DB-Tabelle (Convex)
- [ ] Einfaches Dashboard oder Vercel Logs Query

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
| REQ-001 | Phase 1 | Pending |
| REQ-002 | Phase 2 | Pending |
| REQ-003 | Phase 3 | Pending |
| REQ-004 | Phase 3 | Pending |
