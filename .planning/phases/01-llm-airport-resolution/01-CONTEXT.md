# Phase 1: LLM Airport Resolution - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Natürliche Spracheingaben in korrekte IATA-Flughafen-Codes auflösen mittels xAI/Grok LLM. Mehrdeutige Städtenamen (San Jose, Liberia) werden korrekt aufgelöst. Alternative Flughäfen bei 0 Ergebnissen sind Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Mehrdeutige Eingaben
- Bei Mehrdeutigkeit ohne Kontext: User aus max. 3 Optionen wählen lassen
- Optionen intelligent sortieren basierend auf Kontext (z.B. Abflugort Frankfurt → internationale Ziele wahrscheinlicher)
- Bei eindeutigem Kontext (z.B. "Costa Rica Liberia") direkt auflösen, keine Nachfrage

### Antwortverhalten
- Alle relevanten Flughäfen pro Stadt zurückgeben (nicht nur Hauptflughafen)
- Nur internationale Flughäfen, keine regionalen Kleinflughäfen
- Maximum 3 Flughäfen pro Stadt
- Antwort enthält IATA-Code + vollen Flughafen-Namen (z.B. "LHR - London Heathrow")

### Fehlerfälle
- Bei LLM-Ausfall: Fallback auf altes airport-codes.ts
- Ungültige IATA-Codes still validieren und filtern
- Wenn keine validen Codes übrig: Nachfragen mit "Meintest du...?" Vorschlägen
- Vorschläge für "Meintest du" via erneute LLM-Anfrage generieren

### User-Feedback
- Immer anzeigen welche Flughäfen extrahiert wurden: "Suche Flüge: Frankfurt (FRA) → San Jose (SJO)"
- User kann erkannte Flughäfen per Freitext-Eingabe korrigieren
- Korrekturen im Cache merken für bessere zukünftige Vorschläge

### Claude's Discretion
- Genaue Prompt-Formulierung für xAI/Grok
- Structured Output Schema Design
- Cache-Implementierung (Memory vs. Convex)
- Timeout-Werte für LLM-Calls

</decisions>

<specifics>
## Specific Ideas

- "Frankfurt nach costa rica liberia" muss LIR (Daniel Oduber, Costa Rica) liefern, nicht LIB (Liberia Land)
- "san jose costa rica" muss SJO liefern, nicht SJC (Kalifornien)
- Response Time unter 2 Sekunden für Airport Resolution

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-llm-airport-resolution*
*Context gathered: 2026-02-02*
