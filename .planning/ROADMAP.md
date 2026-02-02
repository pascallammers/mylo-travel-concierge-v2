# Roadmap: Robuste Flugsuche

## Overview

Transform Mylo's flight search from brittle static airport mapping to intelligent LLM-based resolution. The journey: first make airport extraction smart (Phase 1), then handle empty results gracefully (Phase 2), and finally add observability for continuous improvement (Phase 3). Each phase delivers working value to customers.

## Phases

- [ ] **Phase 1: LLM Airport Resolution** - Replace static airport-codes.ts with xAI/Grok extraction
- [ ] **Phase 2: Alternative Airports** - Suggest nearby airports when search returns no results
- [ ] **Phase 3: Observability & Enhancement** - Track failed searches and add flexible date option

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
**Plans**: TBD

Plans:
- [ ] 01-01: LLM airport resolver with structured output
- [ ] 01-02: Caching layer and integration

### Phase 2: Alternative Airports
**Goal**: Customers never hit a dead end when flights exist at nearby airports
**Depends on**: Phase 1
**Requirements**: REQ-002
**Success Criteria** (what must be TRUE):
  1. Empty search results show "Keine Fluege gefunden. Alternativen in der Naehe:" with max 3 nearby airports
  2. Nearby airport suggestions include distance from original airport
  3. User can click to re-search with alternative airport
  4. Nearby airports within 150km radius are found
**Plans**: TBD

Plans:
- [ ] 02-01: Duffel Places API integration for nearby airports
- [ ] 02-02: UX integration and alternative display

### Phase 3: Observability & Enhancement
**Goal**: Failed searches are tracked for improvement, and flexible dates help find more options
**Depends on**: Phase 2
**Requirements**: REQ-003, REQ-004
**Success Criteria** (what must be TRUE):
  1. Failed searches are logged to Convex with query, extracted codes, timestamp
  2. Logs can be queried to find common failure patterns
  3. User can opt-in to "+/- 3 Tage" flexible date search
  4. Flexible date search returns results across 7-day window
**Plans**: TBD

Plans:
- [ ] 03-01: Search monitoring and Convex logging
- [ ] 03-02: Flexible date search implementation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. LLM Airport Resolution | 0/2 | Not started | - |
| 2. Alternative Airports | 0/2 | Not started | - |
| 3. Observability & Enhancement | 0/2 | Not started | - |

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| REQ-001 | Phase 1 | LLM-basierte Airport-Extraktion |
| REQ-002 | Phase 2 | Alternative Flughaefen bei 0 Ergebnissen |
| REQ-003 | Phase 3 | Flexible Datumssuche |
| REQ-004 | Phase 3 | Fehler-Monitoring |

Coverage: 4/4 requirements mapped
