# Tasks: AwardWallet Chatbot Integration

## Relevant Files

- `lib/db/queries/awardwallet.ts` - Bestehende DB-Queries für Loyalty-Daten (`getUserLoyaltyData`, `getConnection`)
- `lib/tools/loyalty-balances.ts` - Neues Tool für Loyalty-Abfragen (zu erstellen)
- `lib/tools/loyalty-balances.test.ts` - Unit Tests für das neue Tool (zu erstellen)
- `lib/tools/index.ts` - Tool-Export Registry (Tool hinzufügen)
- `app/actions.ts` - Group Tools und Instructions (Tool registrieren, Loyalty-Kontext)
- `app/api/search/route.ts` - Chat API Route (Loyalty-Daten laden, System-Prompt erweitern)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `loyalty-balances.ts` and `loyalty-balances.test.ts` in the same directory).
- Use `pnpm test` to run tests.
- Bestehende Funktion `getUserLoyaltyData(userId)` in `lib/db/queries/awardwallet.ts` liefert bereits alle benötigten Daten.
- Loyalty-Daten werden bei Chat-Start geladen (cached DB-Daten, kein Live-API-Call).

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 1.0 Analyze existing codebase structure
  - [x] 1.1 Untersuche `lib/db/queries/awardwallet.ts` und verstehe das `UserLoyaltyData` Interface
  - [x] 1.2 Untersuche `app/actions.ts` und verstehe wie `groupTools` und `groupInstructions` funktionieren
  - [x] 1.3 Untersuche `app/api/search/route.ts` und verstehe wie der System-Prompt aufgebaut wird
  - [x] 1.4 Untersuche ein bestehendes Tool (z.B. `lib/tools/flight-search.ts`) als Referenz für Tool-Struktur

- [x] 2.0 Implement System-Prompt Enhancement with Loyalty Data
  - [x] 2.1 Erstelle Hilfsfunktion `formatLoyaltyDataForPrompt(data: UserLoyaltyData): string` in `app/actions.ts` oder separater Datei
  - [x] 2.2 Lade Loyalty-Daten in `app/api/search/route.ts` bei Chat-Start (parallel zu anderen DB-Calls)
  - [x] 2.3 Injiziere formatierten Loyalty-Kontext in den System-Prompt für authentifizierte User
  - [x] 2.4 Für nicht verbundene User: Füge Hinweis "User has not connected AwardWallet" hinzu
  - [x] 2.5 Teste manuell, dass der Chatbot die Loyalty-Daten im Kontext hat (Build erfolgreich)

- [ ] 3.0 Create get_loyalty_balances Tool
  - [ ] 3.1 Erstelle `lib/tools/loyalty-balances.ts` mit Tool-Definition nach AI SDK Pattern
  - [ ] 3.2 Implementiere Tool-Parameter: `provider` (optional), `includeDetails` (optional)
  - [ ] 3.3 Implementiere Tool-Handler der `getUserLoyaltyData()` aus DB aufruft
  - [ ] 3.4 Implementiere Rückgabe-Format gemäß PRD (connected, lastSyncedAt, totalPoints, accounts[])
  - [ ] 3.5 Füge Filter-Logik für `provider` Parameter hinzu
  - [ ] 3.6 Füge JSDoc-Dokumentation hinzu

- [ ] 4.0 Register Tool in Tool Registry
  - [ ] 4.1 Exportiere Tool in `lib/tools/index.ts`
  - [ ] 4.2 Importiere Tool in `app/api/search/route.ts`
  - [ ] 4.3 Füge `get_loyalty_balances` zu `groupTools.web` in `app/actions.ts` hinzu
  - [ ] 4.4 Registriere Tool in der `createToolRegistry` Funktion in `app/api/search/route.ts`
  - [ ] 4.5 Erweitere `groupInstructions.web` mit Anweisungen zur Tool-Nutzung

- [ ] 5.0 Implement Unit and Integration Tests
  - [ ] 5.1 Erstelle `lib/tools/loyalty-balances.test.ts` mit Unit Tests
  - [ ] 5.2 Teste Tool mit verbundenem AwardWallet User (Mock)
  - [ ] 5.3 Teste Tool mit nicht verbundenem User (Mock)
  - [ ] 5.4 Teste Filter-Funktionalität für `provider` Parameter
  - [ ] 5.5 Führe `pnpm lint && pnpm typecheck && pnpm test` aus und behebe Fehler

- [ ] 6.0 Manual Testing and Verification
  - [ ] 6.1 Starte Dev-Server und teste Chatbot mit verbundenem AwardWallet Account
  - [ ] 6.2 Teste Frage "Wie viele Punkte habe ich?" - erwarte direkte Antwort aus System-Kontext
  - [ ] 6.3 Teste Detail-Anfrage zu einzelnem Programm - erwarte Tool-Aufruf
  - [ ] 6.4 Teste mit nicht verbundenem User - erwarte proaktiven Hinweis auf AwardWallet
  - [ ] 6.5 Verifiziere korrekte Formatierung der Punktestände in Chat-Antworten
