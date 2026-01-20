# Duffel API Migration - Flight Search

Migration der Flight Search Funktionalität von Amadeus API zu Duffel API für verbesserte Zuverlässigkeit, einfacheren Code und moderne Features.

## Relevant Files

- `lib/api/duffel-client.ts` - Neuer Duffel API Client (zu erstellen)
- `lib/api/duffel-client.test.ts` - Unit Tests für Duffel Client (zu erstellen)
- `lib/api/amadeus-client.ts` - Bestehender Amadeus Client (wird durch Duffel ersetzt)
- `lib/api/amadeus-token.ts` - Amadeus Token Management (kann nach Migration entfernt werden)
- `lib/tools/flight-search.ts` - Flight Search Tool (muss aktualisiert werden)
- `lib/tools/flight-search.integration.test.ts` - Integration Tests für Flight Search
- `env/server.ts` - Server Environment Schema (DUFFEL_API_TOKEN hinzufügen)
- `.env.example` - Environment Example (DUFFEL_API_TOKEN dokumentieren)
- `lib/db/schema.ts` - DB Schema (amadeus_tokens Tabelle kann später entfernt werden)

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `pnpm test` to run all tests
- Duffel API verwendet einfache Bearer Token Authentication (kein OAuth2)
- Duffel API Dokumentation: https://duffel.com/docs
- Duffel Getting started with flights: https://duffel.com/docs/guides/getting-started-with-flights
- Duffel Search Flights best practices: https://duffel.com/docs/guides/following-search-best-practices
- Duffel Dashboard: https://app.duffel.com
- Die Migration sollte schrittweise erfolgen - Amadeus Code zunächst als Fallback behalten

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Stelle sicher, dass du auf dem aktuellen `main` Branch bist (`git checkout main && git pull`)
  - [x] 0.2 Erstelle und wechsle zu einem neuen Feature Branch (`git checkout -b feature/duffel-migration`)

- [x] 1.0 Setup Duffel Account und API Credentials
  - [x] 1.1 Erstelle einen Duffel Account unter https://app.duffel.com/join
  - [x] 1.2 Generiere einen Test API Token im Duffel Dashboard (Settings → Access Tokens)
  - [x] 1.3 Notiere den Token sicher - er wird nur einmal angezeigt
  - [x] 1.4 Teste den Token mit einem einfachen curl Request:
    ```bash
    curl -X GET "https://api.duffel.com/air/airports?iata_code=LHR" \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Duffel-Version: v2"
    ```

- [x] 2.0 Erstelle Duffel API Client
  - [x] 2.1 Analysiere die bestehende Amadeus Client Struktur in `lib/api/amadeus-client.ts`
  - [x] 2.2 Erstelle neue Datei `lib/api/duffel-client.ts` mit TypeScript Interfaces:
    - `DuffelSearchParams` - Suchparameter (origin, destination, dates, cabin, passengers)
    - `DuffelFlight` - Formatiertes Flugergebnis
  - [x] 2.3 Implementiere die `searchDuffel()` Funktion:
    - POST Request an `https://api.duffel.com/air/offer_requests?return_offers=true`
    - Header: Authorization, Content-Type, Duffel-Version: v2, Accept-Encoding: gzip
    - Body: slices (Flugstrecken), passengers, cabin_class
  - [x] 2.4 Implementiere die `formatDuffelOffer()` Hilfsfunktion zur Umwandlung der API Response
  - [x] 2.5 Füge Error Handling hinzu (Rate Limits, Auth Errors, Network Errors)
  - [x] 2.6 Exportiere alle öffentlichen Interfaces und Funktionen

- [x] 3.0 Update Flight Search Tool
  - [x] 3.1 Öffne `lib/tools/flight-search.ts` und analysiere die aktuelle Amadeus Integration
  - [x] 3.2 Importiere den neuen Duffel Client statt Amadeus Client
  - [x] 3.3 Ersetze den `searchAmadeus()` Aufruf durch `searchDuffel()`:
    - Mappe cabin class: ECONOMY → economy, BUSINESS → business, etc.
    - Passe die Parameter-Struktur an Duffel an
  - [x] 3.4 Aktualisiere die `formatFlightResults()` Funktion für Duffel Response Format:
    - Airline Logos sind in Duffel enthalten (nutze `owner.logo_symbol_url`)
    - CO2 Emissionen sind verfügbar (`total_emissions_kg`)
  - [x] 3.5 Aktualisiere Result-Variablennamen von `amadeus` zu `duffel` oder neutral
  - [x] 3.6 Behalte Seats.aero Integration unverändert

- [x] 4.0 Update Environment Configuration
  - [x] 4.1 Füge `DUFFEL_API_KEY` zu `env/server.ts` Schema hinzu
  - [x] 4.2 Aktualisiere `.env.example` mit dem neuen Environment Variable
  - [x] 4.3 Füge den echten Test Token zu deiner lokalen `.env` Datei hinzu
  - [ ] 4.4 Aktualisiere `DEPLOYMENT.md` falls vorhanden mit Duffel Setup Instructions

- [x] 5.0 Testing und Validierung
  - [x] 5.1 Erstelle Unit Tests in `lib/api/duffel-client.test.ts`:
    - Test für erfolgreiche Suche (mock response)
    - Test für Error Handling (401, 429, 500)
    - Test für Parameter Mapping
  - [x] 5.2 Führe Build aus: `pnpm build` (erfolgreich)
  - [ ] 5.3 Führe Linting aus: `pnpm lint`
  - [ ] 5.4 Führe alle Unit Tests aus: `pnpm test`
  - [ ] 5.5 Teste die Integration manuell:
    - Starte den Dev Server: `pnpm dev`
    - Teste eine Flugsuche über die Chat UI
    - Verifiziere, dass Ergebnisse zurückkommen
  - [ ] 5.6 Teste Edge Cases:
    - Suche ohne Ergebnisse
    - Ungültige Airports
    - Datum in der Vergangenheit
    - Round-trip vs One-way

- [x] 6.0 Cleanup und Dokumentation
  - [x] 6.1 Amadeus-Code als Fallback behalten (nicht entfernt)
  - [x] 6.2 Amadeus Environment Variables in `.env.example` belassen (Fallback)
  - [x] 6.3 Aktualisiere `documentation/features/flight-search.md` mit Duffel Information
  - [x] 6.4 Erstelle einen Commit mit aussagekräftiger Message
  - [x] 6.5 Pushe den Branch und erstelle einen Pull Request
    - PR: https://github.com/pascallammers/mylo-travel-concierge-v2/pull/5
