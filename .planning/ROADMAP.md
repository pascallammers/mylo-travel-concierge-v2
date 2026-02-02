# Roadmap: Robuste Flugsuche

## Overview

Transform Mylo's flight search from brittle static airport mapping to intelligent LLM-based resolution. The journey: first make airport extraction smart (Phase 1), then handle empty results gracefully (Phase 2), and finally add observability for continuous improvement (Phase 3). Each phase delivers working value to customers.

## Phases

- [x] **Phase 1: LLM Airport Resolution** - Replace static airport-codes.ts with xAI/Grok extraction
- [x] **Phase 2: Alternative Airports** - Suggest nearby airports when search returns no results
- [x] **Phase 3: Observability & Enhancement** - Track failed searches and add flexible date option

## Phase Details

### Phase 1: LLM Airport Resolution
**Goal**: Customers can search using natural language and ambiguous city names resolve correctly
**Depends on**: Nothing (first phase)
**Requirements**: REQ-001
**Success Criteria** (what must be TRUE):
  1. User searches "Frankfurt nach costa rica liberia" and gets flights to LIR (not LIB)
  2. User searches "san jose costa rica" and gets SJO (not SJC California)
  3. Ambiguous queries without context ask user to clarify
  4. Response time for airport resolution is under 2 seconds
  5. Repeated queries hit cache (no redundant LLM calls)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — LLM airport resolver with xAI/Grok structured output
- [x] 01-02-PLAN.md — Caching layer, Duffel validation, and flight-search integration

### Phase 2: Alternative Airports
**Goal**: Customers never hit a dead end when flights exist at nearby airports
**Depends on**: Phase 1
**Requirements**: REQ-002
**Success Criteria** (what must be TRUE):
  1. Empty search results show "Keine Fluege gefunden. Alternativen in der Naehe:" with max 3 nearby airports
  2. Nearby airport suggestions include distance from original airport
  3. User can click to re-search with alternative airport
  4. Nearby airports within 150km radius are found
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Duffel Places API integration with getNearbyAirports and drive time formatting
- [x] 02-02-PLAN.md — Flight search integration and alternative display in no-results handling

### Phase 3: Observability & Enhancement
**Goal**: Failed searches are tracked for improvement, and flexible dates help find more options
**Depends on**: Phase 2
**Requirements**: REQ-003, REQ-004
**Success Criteria** (what must be TRUE):
  1. Failed searches are logged with query, extracted codes, timestamp
  2. Logs can be queried to find common failure patterns
  3. User can opt-in to "+/- 3 Tage" flexible date search
  4. Flexible date search returns results across 7-day window
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Failed search logging with admin UI and 30-day TTL
- [x] 03-02-PLAN.md — Flexible date search fallback with ±3 day range

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. LLM Airport Resolution | 2/2 | Complete | 2026-02-02 |
| 2. Alternative Airports | 2/2 | Complete | 2026-02-02 |
| 3. Observability & Enhancement | 2/2 | Complete | 2026-02-02 |

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| REQ-001 | Phase 1 | LLM-basierte Airport-Extraktion |
| REQ-002 | Phase 2 | Alternative Flughaefen bei 0 Ergebnissen |
| REQ-003 | Phase 3 | Flexible Datumssuche |
| REQ-004 | Phase 3 | Fehler-Monitoring |

Coverage: 4/4 requirements mapped
