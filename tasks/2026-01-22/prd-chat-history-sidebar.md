# PRD: Chat-Historie als Sidebar

## 1. Introduction/Overview

Die Chat-Historie soll von einem Modal (CommandDialog) zu einer permanenten Sidebar im linken Bereich der Anwendung umgestellt werden, ähnlich wie bei ChatGPT oder anderen modernen KI-Chatbots.

**Problem:** Das aktuelle Modal erfordert einen zusätzlichen Klick zum Öffnen und verdeckt den Hauptinhalt beim Durchsuchen der Chat-Historie. Nutzer können nicht gleichzeitig chatten und ihre Historie durchsuchen.

**Lösung:** Eine ein-/ausklappbare Sidebar links, die permanenten Zugriff auf alle vergangenen Unterhaltungen bietet, ohne den Chat-Bereich zu verdecken.

## 2. Goals

1. Verbesserte Navigation: Nutzer können schneller zwischen Chats wechseln
2. Bessere Übersicht: Chat-Historie ist jederzeit sichtbar (wenn gewünscht)
3. Konsistente UX: Design-Pattern bekannt von ChatGPT, Claude, etc.
4. Vollständige Feature-Parität: Alle bestehenden Funktionen bleiben erhalten

## 3. User Stories

1. **Als Nutzer** möchte ich meine Chat-Historie in einer Sidebar links sehen, damit ich schnell zwischen Unterhaltungen wechseln kann, ohne ein Modal öffnen zu müssen.

2. **Als Nutzer** möchte ich die Sidebar ein- und ausblenden können, damit ich bei Bedarf mehr Platz für den Chat-Bereich habe.

3. **Als Mobile-Nutzer** möchte ich die Sidebar als Overlay (Drawer) öffnen können, damit sie auf kleinen Bildschirmen nicht permanent Platz wegnimmt.

4. **Als Nutzer** möchte ich einen neuen Chat direkt aus der Sidebar starten können, damit ich nicht zur Navbar navigieren muss.

5. **Als Nutzer** möchte ich meine Chats durchsuchen, umbenennen und löschen können, ohne die Sidebar zu verlassen.

## 4. Functional Requirements

### 4.1 Sidebar-Layout (Desktop)
1. Die Sidebar muss links im Layout positioniert sein
2. Die Sidebar muss eine Breite von ca. 256px (16rem) haben
3. Die Sidebar muss vollständig ein-/ausklappbar sein via Toggle-Button
4. Der Sidebar-Zustand (offen/geschlossen) muss in einem Cookie gespeichert werden
5. Die Tastenkombination Cmd/Ctrl + B muss die Sidebar togglen

### 4.2 Mobile-Verhalten
6. Auf Mobile-Geräten muss die Sidebar als Overlay-Drawer erscheinen
7. Ein Hamburger-Icon in der Navbar muss die Sidebar auf Mobile öffnen
8. Die Sidebar muss sich automatisch schließen, wenn ein Chat ausgewählt wird

### 4.3 Sidebar-Inhalt
9. Oben muss ein "Neuer Chat" Button prominent platziert sein
10. Ein Suchfeld muss alle bestehenden Suchmodi unterstützen (Titel, Datum, Sichtbarkeit)
11. Die Chat-Liste muss nach Datum kategorisiert sein (Heute, Gestern, Diese Woche, etc.)
12. Infinite Scroll muss weitere Chats nachladen
13. Der aktuell aktive Chat muss visuell hervorgehoben sein

### 4.4 Chat-Item Funktionen
14. Jedes Chat-Item muss den Titel anzeigen (mit Truncation bei Überlänge)
15. Jedes Chat-Item muss inline umbenannt werden können (Pencil-Icon)
16. Jedes Chat-Item muss inline gelöscht werden können (Trash-Icon mit Bestätigung)
17. Jedes Chat-Item muss einen Visibility-Indikator zeigen (Globe für public, Lock für private)
18. Jedes Chat-Item muss eine relative Zeitangabe zeigen (z.B. "vor 2h")

### 4.5 State & Navigation
19. Bei Klick auf einen Chat muss zu `/search/{chatId}` navigiert werden
20. Der Sidebar-Zustand muss über Seitenwechsel hinweg erhalten bleiben

## 5. Non-Goals (Out of Scope)

- Drag & Drop zum Umsortieren von Chats
- Ordner oder Kategorien zum Organisieren von Chats
- Multi-Select für Batch-Operationen (mehrere Chats gleichzeitig löschen)
- Chat-Vorschau/Preview beim Hover
- Resizable Sidebar (manuelle Breitenänderung durch Nutzer)
- Pinning von Chats

## 6. Design Considerations

**Bestehende Komponenten nutzen:**
- `components/ui/sidebar.tsx` - shadcn/ui Sidebar bereits im Projekt vorhanden
- Farbschema und Styling konsistent mit bestehendem Design

**Komponenten-Struktur:**
```
SidebarProvider (Wrapper)
├── ChatSidebar
│   ├── SidebarHeader
│   │   └── "Neuer Chat" Button
│   ├── SidebarContent
│   │   ├── Suchfeld
│   │   └── Chat-Liste (kategorisiert)
│   └── SidebarRail (Toggle-Bereich)
└── SidebarInset (Main Content)
    └── Chat Interface (bestehend)
```

**UI-Pattern:**
- ChatGPT-ähnliches Layout als Referenz
- Smooth Transitions beim Ein-/Ausklappen
- Hover-States für Chat-Items mit Action-Buttons

## 7. Technical Considerations

**Refactoring erforderlich:**
- Die Logik aus `ChatHistoryDialog` (Suche, Kategorisierung, Mutations) sollte in einen wiederverwendbaren Custom Hook (`useChatHistory`) extrahiert werden
- Das bestehende Modal kann für den Keyboard-Shortcut (Cmd+K) als Alternative erhalten bleiben

**Layout-Änderung:**
- Das App-Layout muss angepasst werden, um den `SidebarProvider` zu integrieren
- Die Navbar-Komponente muss angepasst werden (ChatHistoryButton wird zu SidebarTrigger auf Mobile)

**Abhängigkeiten:**
- `@/components/ui/sidebar.tsx` - bereits vorhanden
- `@tanstack/react-query` - bereits für Chat-Daten verwendet
- `date-fns` - bereits für Datumsformatierung verwendet

**Performance:**
- Bei sehr vielen Chats (>100) sollte Virtualisierung erwogen werden
- Lazy Loading der Chat-Liste beim Öffnen der Sidebar

## 8. Success Metrics

1. **Funktional:** Alle 20 funktionalen Anforderungen sind implementiert und getestet
2. **Performance:** Chat-Liste lädt in unter 100ms
3. **Usability:** Nutzer können innerhalb von 2 Klicks zu jedem Chat navigieren
4. **Regression:** Keine bestehende Funktionalität ist beeinträchtigt
5. **Mobile:** Overlay-Drawer funktioniert flüssig auf iOS und Android

## 9. Open Questions

1. Soll das Mylo-Logo im Sidebar-Header angezeigt werden?
2. Soll ein Sidebar-Footer mit User-Info oder Quick-Actions hinzugefügt werden?
3. Soll das bestehende Cmd+K Modal als Alternative zur Sidebar erhalten bleiben?
