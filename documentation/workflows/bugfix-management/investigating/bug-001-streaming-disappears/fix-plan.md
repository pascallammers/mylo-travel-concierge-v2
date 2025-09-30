# Fix Implementation Plan: bug-001-streaming-disappears

## Approach
Verhindere, dass `loadMessages()` während eines laufenden Streams den optimistischen Assistant-Platzhalter löscht. Nutze den bestehenden Ladezustand (`loading`), um Supabase-Refreshes zu überspringen, bis der Stream abgeschlossen ist, und synchronisiere danach erneut mit der Datenbank.

## Changes Required
1. [x] Bug-Dokumentation aktualisieren (`analysis.md`)
2. [x] `src/pages/Index.tsx`: `activeChatId`-Effect so anpassen, dass er bei `loading === true` keinen Refresh auslöst
3. [x] `src/pages/Index.tsx`: Referenz (`loadingRef`) ergänzen und `finalizeStream` auf verzögerte Supabase-Synchronisation umstellen
4. [ ] Manuelle Tests: Erste Nachricht in brandneuem Chat
5. [ ] Manuelle Tests: Weitere Nachrichten im bestehenden Chat + Flug-Suche (`searching_flights`)
6. [x] Dokumentation & Version aktualisieren (Progress/Changelog + `package.json` + `npm run build`)

## Verification Steps
1. [ ] Bug reproduzieren (Placeholder verschwindet nach erster Frage)
2. [ ] Fix implementieren
3. [ ] Chat erneut testen → Placeholder bleibt sichtbar bis Antwort fertig ist
4. [ ] Folgeanfragen testen → Status-Indikatoren bleiben stabil
5. [ ] `npm run build` erfolgreich ausführen

## Code References
- Placeholder-Erstellung: `src/pages/Index.tsx:820-842`
- SSE `init`-Handling: `src/pages/Index.tsx:1160-1185`
- Nachrichten-Refresh: `src/pages/Index.tsx:413-439`

## Rollback Plan
Commit zurücksetzen (`git revert <commit>`) oder branch droppen, falls der Fix unerwartete Nebenwirkungen zeigt.
