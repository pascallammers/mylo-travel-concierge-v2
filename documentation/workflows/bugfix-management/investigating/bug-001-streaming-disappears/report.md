# Bug Report: Streaming-Response verschwindet bei erster Nachricht

> ### 🔴 Current Status: `INVESTIGATING`
> **Location:** `/investigating/`
> **Last Updated:** 2025-09-25

**Bug ID:** bug-001-streaming-disappears
**Reported:** 2025-09-25
**Severity:** High
**Priority:** P1
**Affected Features:** Chat-Interface, Streaming-Responses

## Description
Bei der ersten Nachricht in einem neuen Chat verschwindet der "Denke nach..." Placeholder unmittelbar nach dem Start des Streams. Die Assistant-Nachricht wird leer angezeigt, während im Hintergrund die Antwort generiert wird. Nach Abschluss der Generierung erscheint die Antwort plötzlich vollständig. Bei der zweiten und weiteren Nachrichten tritt das Problem nicht auf.

## Reproduction Steps
1. Öffne die Anwendung und starte einen neuen Chat
2. Stelle eine beliebige Frage
3. Beobachte: "Denke nach..." erscheint kurz und verschwindet dann
4. Expected: "Denke nach..." oder "Formuliere Antwort..." bleibt sichtbar bis Content da ist
5. Actual: Leere Assistant-Nachricht während der Generierung

## Environment
- Browser/OS: Alle Browser betroffen
- Version: 0.10.0
- User Type: Alle User

## Error Messages
Keine Fehlermeldungen, aber Console-Logs zeigen aktive SSE-Events:
```
[SSE] Connection opened
[SSE] event {type: 'init', ...}
[SSE] event {type: 'heartbeat', ...}
[SSE] event {type: 'final', ...}
```

## Screenshots/Videos
User hat Screenshots bereitgestellt, die das Problem zeigen

## Impact
- Users affected: Alle
- Features broken: User Experience beim ersten Chat stark beeinträchtigt
- Workaround available: Nein

## Related Issues
- Streaming-Response Handling in Index.tsx
- Status-Management während des Streamings