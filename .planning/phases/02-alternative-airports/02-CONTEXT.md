# Phase 2: Alternative Airports - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wenn eine Flugsuche keine Ergebnisse liefert, werden alternative Flughäfen in der Nähe vorgeschlagen. Der Nutzer kann mit einem Klick die Suche mit einem alternativen Flughafen wiederholen. Automatische Multi-Airport-Suche und Rail&Fly gehören in andere Phasen.

</domain>

<decisions>
## Implementation Decisions

### Vorschlagsdarstellung
- Inline im Ergebnisbereich (dort wo sonst Flüge wären)
- Pro Flughafen anzeigen: Stadt, Name, Code, Entfernung
  - Beispiel: "Hahn — Frankfurt-Hahn Airport (HHN) — ~1.5h Fahrt"
- Freundliche Nachricht mit Kontext über den Alternativen
  - "Leider keine direkten Flüge ab [Airport]. Diese Flughäfen sind in der Nähe:"
- Maximal 3 alternative Flughäfen anzeigen

### Distanz & Auswahl
- Entfernung als ungefähre Fahrzeit anzeigen (z.B. "~1.5h Fahrt")
- Priorisierung nur nach Entfernung (die 3 nächsten)
- Dynamischer Suchradius je nach Region (in dünn besiedelten Gebieten weiter suchen)
- Nur Flughäfen, keine Bahnhöfe

### Interaktion
- Klick auf Alternative zeigt Bestätigungsdialog
  - "Mit [Alternative] statt [Original] suchen?"
- Nur ein Airport pro Suche (kein Multi-Select)
- Alternative ersetzt nur den Airport der "leer" war (Abflug oder Ziel)
- Ursprüngliche Suche bleibt im Formular sichtbar

### Leere Alternativen
- Wenn auch Alternativen keine Flüge: Meldung mit Handlungsempfehlung
  - "Keine Flüge gefunden. Versuche andere Daten."
- Alle 3 nächsten Alternativen anzeigen ohne Vorab-Prüfung auf Treffer
- Wenn keine Alternativen im Radius: Gleiche Meldung wie "keine Flüge"
- Kein Kontakt-Link, nur Tipps zu anderen Daten

### Claude's Discretion
- Exakter Wortlaut der Meldungen
- UI-Komponenten und Styling (passend zu bestehenden Patterns)
- Algorithmus für dynamischen Suchradius
- Berechnung der Fahrzeit aus Distanz

</decisions>

<specifics>
## Specific Ideas

- Fahrzeit ist für Nutzer praktischer als Kilometer-Angabe
- Bestätigungsdialog verhindert versehentliche Suchen
- Formular behält Original-Suche damit Nutzer Kontext nicht verliert

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-alternative-airports*
*Context gathered: 2026-02-02*
