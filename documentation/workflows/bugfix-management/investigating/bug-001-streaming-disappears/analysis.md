# Root Cause Analysis: bug-001-streaming-disappears

> ### 🔍 Current Status: `INVESTIGATING`
> **Location:** `/investigating/bug-001-streaming-disappears/`
> **Started:** 2025-09-25

**Analyst:** Codex

## Investigation Summary
Beim ersten Nutzerprompt wird nach dem Absenden kurz der Placeholder "Denke nach…" gerendert, verschwindet jedoch sofort wieder. Die Logs zeigen zwar fortlaufende Streaming-Ereignisse, aber in der UI bleibt bis zum ersten Token alles leer. Ab der zweiten Nutzerfrage tritt das Problem nicht mehr auf.

## Root Cause
`handleSend()` fügt einen Assistant-Platzhalter (`status: 'thinking'`) ans Ende der lokalen `messages`. Sobald das SSE `init`-Event eintrifft, ruft der Stream-Handler jedoch `loadMessages(chatId)` auf. Dieser Supabase-Fetch ersetzt die lokale Nachrichtenliste vollständig durch den DB-Stand. Zu diesem Zeitpunkt existiert in der Datenbank noch keine Assistenten-Nachricht, sodass der frisch gesetzte Placeholder verloren geht. Erst wenn später Tokens eintreffen, wird wieder Content angezeigt – weshalb der Nutzer zwischenzeitlich keinerlei Feedback bekommt.

## Affected Code
- File: `src/pages/Index.tsx:806-937` – Optimistische Placeholder-Erstellung in `handleSend`
- File: `src/pages/Index.tsx:1160-1185` – SSE `init`-Event ruft `loadMessages`
- File: `src/pages/Index.tsx:413-439` – `loadMessages` überschreibt `messages`

## Stack Trace Analysis
```
1. handleSend(): Placeholder mit status "thinking" wird gesetzt.
2. SSE "init": setAssistantStatus('searching') und loadMessages(chatId).
3. loadMessages(): ersetzt messages[] durch DB-Inhalt → Placeholder verschwindet.
4. Erstes Token kommt später an → appendToken() erzeugt wieder Inhalt.
```

## Dependencies
- Supabase Realtime-Workflow für Chats
- SSE Streaming-Handler und Statusverwaltung
- UI-Rendering der Chatnachrichten

## Fix Strategy
Während eines laufenden Streams darf `loadMessages()` die optimistische Assistentenantwort nicht verlieren. Wir halten den Platzhalter beim Refresh zurück bzw. synchronisieren die Inhalte, sodass Status und Skeleton sichtbar bleiben, bis das finale Ergebnis gespeichert ist.

## Risk Assessment
- Regression risk: Medium – Änderungen an der Nachrichten-Synchronisation können weitere Statusflüsse beeinflussen.
- Testing needed: Manuelle Verifikation für erste und weitere Nachrichten, inklusive Flug-Suche (Status `searching_flights`).

## Cross-References
→ [Bugfix Workflow Guide](../../README.md)
→ [Index Chat Page](../../../../src/pages/Index.tsx)
→ [Debugging Notes](../../../debugging/)
