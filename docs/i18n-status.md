# i18n Internationalisierung - Status

## Setup (erledigt)

- [x] **Library:** `next-intl` v4.8.3 installiert
- [x] **Konfiguration:** `i18n/routing.ts`, `i18n/request.ts`, `i18n/navigation.ts`
- [x] **next.config.ts:** `createNextIntlPlugin` integriert
- [x] **Middleware:** next-intl Locale-Routing + Better-Auth kombiniert in `middleware.ts`
- [x] **Routing:** URL-Prefix (`/de/...`, `/en/...`), Browser-Sprache wird automatisch erkannt, Default: Englisch
- [x] **Uebersetzungsdateien:** `messages/de.json` und `messages/en.json`
- [x] **App-Struktur:** Alle Endnutzer-Routen unter `app/[locale]/...` verschoben, Admin bleibt unter `app/admin/`

## Umgestellte Dateien (erledigt)

### Komponenten
- [x] `components/auth-card.tsx` - Login-Formular
- [x] `components/navbar.tsx` - Navigation mit Language Switcher
- [x] `components/message.tsx` - Chat-Nachricht ("Keine Antwort generiert")
- [x] `components/settings-dialog.tsx` - Profil/Passwort/Usage Sections
- [x] `components/InstallPrompt.tsx` - PWA Install-Prompt
- [x] `components/language-switcher.tsx` - Sprach-Umschalter (Globe-Icon)
- [x] `components/chat-history-dialog.tsx` - Chat-Verlauf Dialog (Suche, Loeschen, Filter-Hints)
- [x] `components/chat-sidebar/chat-sidebar.tsx` - Sidebar-Container
- [x] `components/chat-sidebar/chat-sidebar-list.tsx` - Kategorisierte Chat-Liste
- [x] `components/chat-sidebar/chat-sidebar-header.tsx` - "Neuer Chat" Button
- [x] `components/chat-sidebar/chat-sidebar-item.tsx` - Einzelner Chat-Eintrag (Edit/Delete)
- [x] `components/chat-sidebar/chat-sidebar-search.tsx` - Suchfeld mit Modus-Wechsel
- [x] `components/awardwallet/loyalty-programs-list.tsx` - Treueprogramm-Liste
- [x] `components/awardwallet/loyalty-program-card.tsx` - Treueprogramm-Karte
- [x] `components/user-profile.tsx` - Benutzer-Profil/Dropdown-Menue

### Pages
- [x] `app/[locale]/(auth)/reset-password/page.tsx` - Passwort zuruecksetzen
- [x] `app/[locale]/(auth)/reset-password/confirm/page.tsx` - Neues Passwort setzen
- [x] `app/[locale]/subscription-expired/page.tsx` - Abo abgelaufen
- [x] `app/[locale]/checkout/page.tsx` - Checkout-Seite
- [x] `app/[locale]/layout.tsx` - Locale Layout mit NextIntlClientProvider

## Uebersetzungs-Namespaces in `messages/*.json`

| Namespace | Beschreibung | Status |
|-----------|-------------|--------|
| `common` | Allgemeine Begriffe (Speichern, Abbrechen, etc.) | erledigt |
| `metadata` | Seitentitel und Beschreibung | erledigt |
| `navbar` | Navigation | erledigt |
| `auth` | Login/Registrierung | erledigt |
| `resetPassword` | Passwort zuruecksetzen | erledigt |
| `resetPasswordConfirm` | Neues Passwort setzen | erledigt |
| `subscriptionExpired` | Abo abgelaufen | erledigt |
| `settings` | Profil/Passwort/Usage | erledigt |
| `chatHistory` | Chat-Verlauf Dialog + Sidebar | erledigt |
| `chat` | Chat-Nachrichten | erledigt |
| `installPrompt` | PWA Install-Prompt | erledigt |
| `checkout` | Checkout-Seite | erledigt |
| `loyalty` | AwardWallet/Treueprogramme | erledigt |
| `timeAgo` | Relative Zeitangaben (vor 5m, vor 2h) | erledigt |
| `searchMode` | Suchmodus-Labels (Alle, Titel, Datum) | erledigt |
| `categories` | Zeitkategorien (Heute, Gestern, etc.) | erledigt |
| `sidebar` | Sidebar-spezifische Strings | erledigt |
| `userProfile` | Benutzer-Profil/Menue | erledigt |

## Backend/Lib - Alle umgestellt (kein React-Hook, stattdessen locale-Parameter)
- [x] `lib/config/amex-transfer-ratios.ts` - Zweisprachige `LocalizedString`-Datenstruktur ({de, en}) fuer transferDuration, currencyUnit, notes. Helper `getLocalizedValue()` hinzugefuegt.
- [x] `lib/chat-utils.ts` - `formatCompactTime` nimmt jetzt `TimeAgoTranslator` als Parameter (nutzt `timeAgo`-Namespace), `getSearchModeLabel` nimmt `SearchModeTranslator` (nutzt `searchMode`-Namespace). Aufrufer (Sidebar-Item, Chat-History-Dialog) aktualisiert.
- [x] `lib/utils/tool-error-response.ts` - Optionaler `locale`-Parameter bei allen Formatierungs-Funktionen. Error-Headers und Default-Suggestions in de/en. Fallback: deutsch.
- [x] `lib/email.ts` - Welcome-E-Mail und Passwort-Reset E-Mail zweisprachig. `locale`-Parameter bei `sendWelcomeEmail` und `sendPasswordResetEmail`. Admin-Alert (`sendFailedPaymentAdminAlert`) bleibt deutsch. Aufrufer aktualisiert: Webhooks/Admin nutzen `'de'`, User-facing Reset-Password sendet aktuelle Locale mit.
- [x] `lib/auth.ts` - `getAccessDeniedMessage()` zweisprachig mit `accessDeniedMessages`-Map. Locale wird aus dem Referer-Header erkannt (`/de/sign-in` vs `/en/sign-in`). Fallback: englisch.
- [x] `lib/tools/flight-search.ts` - Alle ~25 deutschen Strings in `flightI18n`-Map extrahiert (Fehler, Tabellen-Header, Labels, Hinweise). `formatFlightResults()` nimmt `locale`-Parameter. Default: deutsch.
- [x] `lib/tools/loyalty-balances.ts` - Fehlermeldungen in `loyaltyI18n`-Map extrahiert (nicht verbunden, nicht authentifiziert, keine Konten). Default: deutsch.
- [x] `lib/utils/loyalty-prompt-formatter.ts` - `formatLoyaltyDataForPrompt()` und `formatAmexTransferOptions()` nehmen optionalen `locale`-Parameter. Prompt-Texte, Labels und Amex-Warnungen in `promptI18n`-Map. Default: englisch (System-Prompt-Kontext).

### Admin (bewusst ausgelassen - bleibt deutsch)
- `app/admin/**` - Alle Admin-Seiten bleiben deutsch

## Technische Hinweise

- `useTranslations('namespace')` fuer Client Components
- `getTranslations('namespace')` fuer Server Components
- `Link` aus `@/i18n/navigation` statt `next/link` verwenden fuer locale-aware Links
- Uebersetzungsschluessel in `messages/de.json` und `messages/en.json` pflegen
- Build laeuft sauber durch (`pnpm build` erfolgreich)
