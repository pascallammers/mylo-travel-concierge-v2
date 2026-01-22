# Tasks: Chat-Historie als Sidebar

## Relevant Files

- `hooks/use-chat-history.ts` - Neuer Custom Hook für Chat-Historie Logik (Suche, Kategorisierung, Mutations)
- `hooks/use-chat-history.test.ts` - Unit Tests für den Chat-Historie Hook
- `components/chat-sidebar/index.ts` - Barrel export für ChatSidebar Feature
- `components/chat-sidebar/chat-sidebar.tsx` - Haupt-Sidebar Komponente
- `components/chat-sidebar/chat-sidebar-header.tsx` - Header mit "Neuer Chat" Button
- `components/chat-sidebar/chat-sidebar-search.tsx` - Suchfeld mit Modi-Unterstützung
- `components/chat-sidebar/chat-sidebar-list.tsx` - Chat-Liste mit Kategorisierung und Infinite Scroll
- `components/chat-sidebar/chat-sidebar-item.tsx` - Einzelnes Chat-Item mit Aktionen
- `components/chat-history-dialog.tsx` - Bestehende Modal-Komponente (wird refactored)
- `components/ui/sidebar.tsx` - Bestehende shadcn/ui Sidebar (bereits vorhanden)
- `components/navbar.tsx` - Navbar-Anpassung für Mobile Hamburger-Icon
- `app/(chat)/layout.tsx` - Chat-Layout mit SidebarProvider Integration
- `app/layout.tsx` - Root Layout (evtl. Anpassungen für globale Sidebar)
- `lib/utils.ts` - Utility-Funktionen (categorizeChatsByDate, formatCompactTime extrahieren)

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use `pnpm test` to run tests.
- Die bestehende shadcn/ui Sidebar (`components/ui/sidebar.tsx`) hat bereits Cookie-Speicherung, Keyboard-Shortcut (Cmd+B) und Mobile Sheet Support eingebaut.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch: `git checkout -b feature/chat-history-sidebar`

- [x] 1.0 Extract reusable Chat History Hook
  - [x] 1.1 Erstelle `hooks/use-chat-history.ts` mit der Logik aus `chat-history-dialog.tsx`
  - [x] 1.2 Extrahiere `categorizeChatsByDate()` und `formatCompactTime()` nach `lib/chat-utils.ts`
  - [x] 1.3 Extrahiere Such-/Filterfunktionen (`fuzzySearch`, `advancedSearch`, `parseDateQuery`) nach `lib/chat-utils.ts`
  - [x] 1.4 Implementiere `useChatHistory` Hook mit: `useInfiniteQuery`, `deleteMutation`, `updateTitleMutation`, `searchQuery`, `searchMode`, `filteredChats`, `categorizedChats`
  - [x] 1.5 Exportiere alle Typen (`Chat`, `SearchMode`, etc.) aus dem Hook
  - [ ] 1.6 Schreibe Unit Tests für `use-chat-history.ts`
  - [x] 1.7 Schreibe Unit Tests für `lib/chat-utils.ts`

- [ ] 2.0 Create ChatSidebar Component Structure
  - [ ] 2.1 Erstelle Ordner `components/chat-sidebar/` mit `index.ts` Barrel Export
  - [ ] 2.2 Erstelle `chat-sidebar.tsx` als Container-Komponente mit `Sidebar`, `SidebarContent`, `SidebarRail`
  - [ ] 2.3 Erstelle `chat-sidebar-header.tsx` mit `SidebarHeader` und "Neuer Chat" Button (Link zu `/new`)
  - [ ] 2.4 Erstelle `chat-sidebar-search.tsx` mit Suchfeld und Modus-Switcher (alle bestehenden Modi: all, title, date, visibility)
  - [ ] 2.5 Erstelle `chat-sidebar-list.tsx` mit `SidebarGroup`, kategorisierter Liste und Infinite Scroll
  - [ ] 2.6 Erstelle `chat-sidebar-item.tsx` mit `SidebarMenuButton`, Titel, Zeitstempel, Visibility-Icon, Edit/Delete Aktionen
  - [ ] 2.7 Implementiere aktiven Chat-Zustand (visuelles Highlighting via `isActive` prop)
  - [ ] 2.8 Implementiere Inline-Editing für Chat-Titel
  - [ ] 2.9 Implementiere Inline-Löschen mit Bestätigung
  - [ ] 2.10 Stelle sicher, dass alle Komponenten den `useChatHistory` Hook verwenden

- [ ] 3.0 Integrate Sidebar into App Layout
  - [ ] 3.1 Erstelle oder aktualisiere `app/(chat)/layout.tsx` mit `SidebarProvider` Wrapper
  - [ ] 3.2 Füge `ChatSidebar` als erstes Kind im Layout hinzu
  - [ ] 3.3 Wrappe den Main Content mit `SidebarInset`
  - [ ] 3.4 Stelle sicher, dass der `defaultOpen` Zustand aus dem Cookie gelesen wird
  - [ ] 3.5 Teste, dass der Sidebar-Zustand bei Seitenwechsel erhalten bleibt

- [ ] 4.0 Implement Mobile Drawer Behavior
  - [ ] 4.1 Verifiziere, dass die shadcn/ui Sidebar automatisch als Sheet/Drawer auf Mobile rendert
  - [ ] 4.2 Implementiere automatisches Schließen der Sidebar bei Chat-Auswahl auf Mobile
  - [ ] 4.3 Füge `SidebarTrigger` (Hamburger-Icon) für Mobile in die Navbar ein
  - [ ] 4.4 Teste das Overlay-Verhalten auf verschiedenen Viewport-Größen
  - [ ] 4.5 Stelle sicher, dass Gesten (Swipe) zum Schließen funktionieren

- [ ] 5.0 Add Keyboard Shortcuts and State Persistence
  - [ ] 5.1 Verifiziere, dass Cmd/Ctrl+B die Sidebar toggled (bereits in shadcn/ui Sidebar eingebaut)
  - [ ] 5.2 Verifiziere, dass der Sidebar-Zustand im Cookie `sidebar_state` gespeichert wird
  - [ ] 5.3 Teste Cookie-Persistenz über Seiten-Reloads und Navigation hinweg
  - [ ] 5.4 Optional: Behalte Cmd/Ctrl+K für das bestehende Quick-Search Modal

- [ ] 6.0 Update Navbar and Remove/Adapt Modal
  - [ ] 6.1 Ersetze `ChatHistoryButton` durch `SidebarTrigger` für Mobile in der Navbar
  - [ ] 6.2 Entferne oder verstecke den Desktop-History-Button (Sidebar ersetzt diese Funktion)
  - [ ] 6.3 Optional: Behalte `ChatHistoryDialog` für Cmd/Ctrl+K als alternative Quick-Search
  - [ ] 6.4 Refactore `ChatHistoryDialog` zur Nutzung des `useChatHistory` Hooks (falls beibehalten)
  - [ ] 6.5 Aktualisiere alle Stellen, die `onHistoryClick` verwenden

- [ ] 7.0 Testing and Verification
  - [ ] 7.1 Führe `pnpm lint` aus und behebe alle Fehler
  - [ ] 7.2 Führe `pnpm typecheck` aus und behebe alle Fehler
  - [ ] 7.3 Führe `pnpm test` aus und behebe alle fehlgeschlagenen Tests
  - [ ] 7.4 Teste alle 20 funktionalen Anforderungen aus dem PRD manuell
  - [ ] 7.5 Teste Desktop-Verhalten: Sidebar offen/geschlossen, Toggle, Navigation
  - [ ] 7.6 Teste Mobile-Verhalten: Drawer öffnen/schließen, automatisches Schließen
  - [ ] 7.7 Teste Keyboard-Shortcuts: Cmd/Ctrl+B zum Togglen
  - [ ] 7.8 Teste Suche: Alle Modi, Prefixes (public:, private:, date:, etc.)
  - [ ] 7.9 Teste CRUD: Chat umbenennen, Chat löschen mit Bestätigung
  - [ ] 7.10 Performance-Test: Liste mit >50 Chats, Infinite Scroll
