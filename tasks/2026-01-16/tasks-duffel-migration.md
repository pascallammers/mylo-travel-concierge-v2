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
- Duffel Dashboard: https://app.duffel.com
- Die Migration sollte schrittweise erfolgen - Amadeus Code zunächst als Fallback behalten

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Stelle sicher, dass du auf dem aktuellen `main` Branch bist (`git checkout main && git pull`)
  - [ ] 0.2 Erstelle und wechsle zu einem neuen Feature Branch (`git checkout -b feature/duffel-migration`)

- [ ] 1.0 Setup Duffel Account und API Credentials
  - [ ] 1.1 Erstelle einen Duffel Account unter https://app.duffel.com/join
  - [ ] 1.2 Generiere einen Test API Token im Duffel Dashboard (Settings → Access Tokens)
  - [ ] 1.3 Notiere den Token sicher - er wird nur einmal angezeigt
  - [ ] 1.4 Teste den Token mit einem einfachen curl Request:
    ```bash
    curl -X GET "https://api.duffel.com/air/airports?iata_code=LHR" \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Duffel-Version: v2"
    ```

- [ ] 2.0 Erstelle Duffel API Client
  - [ ] 2.1 Analysiere die bestehende Amadeus Client Struktur in `lib/api/amadeus-client.ts`
  - [ ] 2.2 Erstelle neue Datei `lib/api/duffel-client.ts` mit TypeScript Interfaces:
    - `DuffelSearchParams` - Suchparameter (origin, destination, dates, cabin, passengers)
    - `DuffelFlight` - Formatiertes Flugergebnis
  - [ ] 2.3 Implementiere die `searchDuffel()` Funktion:
    - POST Request an `https://api.duffel.com/air/offer_requests?return_offers=true`
    - Header: Authorization, Content-Type, Duffel-Version: v2, Accept-Encoding: gzip
    - Body: slices (Flugstrecken), passengers, cabin_class
  - [ ] 2.4 Implementiere die `formatDuffelOffer()` Hilfsfunktion zur Umwandlung der API Response
  - [ ] 2.5 Füge Error Handling hinzu (Rate Limits, Auth Errors, Network Errors)
  - [ ] 2.6 Exportiere alle öffentlichen Interfaces und Funktionen

- [ ] 3.0 Update Flight Search Tool
  - [ ] 3.1 Öffne `lib/tools/flight-search.ts` und analysiere die aktuelle Amadeus Integration
  - [ ] 3.2 Importiere den neuen Duffel Client statt Amadeus Client
  - [ ] 3.3 Ersetze den `searchAmadeus()` Aufruf durch `searchDuffel()`:
    - Mappe cabin class: ECONOMY → economy, BUSINESS → business, etc.
    - Passe die Parameter-Struktur an Duffel an
  - [ ] 3.4 Aktualisiere die `formatFlightResults()` Funktion für Duffel Response Format:
    - Airline Logos sind in Duffel enthalten (nutze `owner.logo_symbol_url`)
    - CO2 Emissionen sind verfügbar (`total_emissions_kg`)
  - [ ] 3.5 Aktualisiere Result-Variablennamen von `amadeus` zu `duffel` oder neutral
  - [ ] 3.6 Behalte Seats.aero Integration unverändert

- [ ] 4.0 Update Environment Configuration
  - [ ] 4.1 Füge `DUFFEL_API_TOKEN` zu `env/server.ts` Schema hinzu:
    ```typescript
    DUFFEL_API_TOKEN: z.string().min(1),
    ```
  - [ ] 4.2 Aktualisiere `.env.example` mit dem neuen Environment Variable:
    ```
    # Duffel API (Flight Search)
    DUFFEL_API_TOKEN=duffel_test_xxxxx
    ```
  - [ ] 4.3 Füge den echten Test Token zu deiner lokalen `.env` Datei hinzu
  - [ ] 4.4 Aktualisiere `DEPLOYMENT.md` falls vorhanden mit Duffel Setup Instructions

- [ ] 5.0 Testing und Validierung
  - [ ] 5.1 Erstelle Unit Tests in `lib/api/duffel-client.test.ts`:
    - Test für erfolgreiche Suche (mock response)
    - Test für Error Handling (401, 429, 500)
    - Test für Parameter Mapping
  - [ ] 5.2 Führe Type Check aus: `pnpm typecheck`
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

- [ ] 6.0 Cleanup und Dokumentation
  - [ ] 6.1 Entferne oder kommentiere Amadeus-spezifischen Code aus (optional - kann als Fallback bleiben):
    - `lib/api/amadeus-client.ts`
    - `lib/api/amadeus-token.ts`
  - [ ] 6.2 Entferne Amadeus Environment Variables aus `.env.example` (wenn nicht mehr benötigt)
  - [ ] 6.3 Aktualisiere `documentation/features/flight-search.md` mit Duffel Information
  - [ ] 6.4 Erstelle einen Commit mit aussagekräftiger Message:
    ```
    feat(flight-search): migrate from Amadeus to Duffel API
    
    - Replace Amadeus API with Duffel for cash flight search
    - Simplify authentication (Bearer token vs OAuth2)
    - Add airline logos and CO2 emissions data
    - Improve error handling and response formatting
    ```
  - [ ] 6.5 Pushe den Branch und erstelle einen Pull Request
