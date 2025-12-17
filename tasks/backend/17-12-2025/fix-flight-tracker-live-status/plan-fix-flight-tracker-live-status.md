## Plan: Fix Flight Tracker Live-Status

### Scope
Backend Tool (`track_flight`) + UI Badge-Logik + Unit Tests.

### Schritte
- [x] Tool: Amadeus Response typ-sicher parsen (Zod) und Timings nach Qualifier auswerten.
- [x] Tool: Status dynamisch ableiten (`scheduled|active|landed`).
- [x] Tool: Delay (Minuten) aus STD vs ETD/ATD sowie STA vs ETA/ATA berechnen.
- [x] Tool: Terminal/Gate aus Response übernehmen (best-effort).
- [x] UI: Badge auch bei `scheduled` + Delay als "Delayed" anzeigen.
- [x] Env: `AMADEUS_ENV` als optionales server env (default: `test`) hinzufügen.
- [x] Tests: `lib/tools/flight-tracker.test.ts` mit fetch-Mock und kontrollierter Zeit (Date.now).
- [x] Verification: Tests laufen lassen und Output dokumentieren.

### Risiken
- Amadeus liefert Terminal/Gate nicht für alle Flüge/Carrier; daher best-effort Mapping.
- Timings/Qualifier können je nach Carrier variieren; Fallback auf erstes Timing bleibt aktiv.
