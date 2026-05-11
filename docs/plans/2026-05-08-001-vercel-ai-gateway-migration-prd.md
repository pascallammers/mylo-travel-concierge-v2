# PRD: Migration auf Vercel AI Gateway

**Status:** Draft
**Author:** Pascal Lammers
**Created:** 2026-05-08
**Related:** TODOS.md (Tool-Calls Tracking-Bug — gefixt im selben Session-Kontext)
**Branch:** `feature/analytics-optimierung`

## Problem Statement

Wenn xAI Capacity-Probleme hat (zu beobachten an Werktagen zwischen 10:00 und 18:00 UTC), bricht der MYLO-Chat für den User mit einem unverständlichen Fehler ab:

> Type validation failed: Value: {"code":"The service is currently unavailable", ...}.
> Error message: [{"expected":"array","path":["choices"], ...}]

Aus User-Sicht: Der Reasoning-Indikator dreht sich, dann eine rote Box mit kryptischem Stack-Trace-artigem Text, "Try Again" Button. Kein graceful Fallback. Bei Flight-Searches besonders ärgerlich, weil die Tools (Seats.aero, Duffel, Skiplagged) bereits erfolgreich Daten zurückgeliefert haben — der finale LLM-Synthese-Call schmiert auf der zweiten Step ab und nichts wird angezeigt.

Root-Cause technisch: xAI gibt bei Überlast eine JSON-Error-Response mit HTTP 200 + `Content-Type: text/event-stream` zurück. Der upstream Fix in `@ai-sdk/xai` (PR vercel/ai#11671) catcht nur den `application/json`-Content-Type-Pfad. Die `text/event-stream`-Variante fällt durch zur Stream-Schema-Validierung und wirft `AI_TypeValidationError` — non-retryable, `maxRetries: 10` greift nicht.

Zusätzlich: Wir haben keinerlei Observability über Token-Verbrauch pro Modell, keine Failover-Strategie für andere Provider, und keine Möglichkeit, ohne Code-Deploy auf einen anderen Provider zu switchen wenn xAI längerfristig down ist.

## Solution

Migration der Vanilla-LLM-Calls (Chat, Title-Gen, Airport-Resolver, Translate, XQL, Raycast) auf den **Vercel AI Gateway**. Der Gateway:

- Routet automatisch auf alternative Provider (Anthropic Claude, OpenAI GPT) wenn der Primary-Provider failt — User sieht statt Error den Fallback-Output
- Normalisiert die `text/event-stream`-Error-Response von xAI bevor sie zum SDK kommt — der Bug verschwindet
- Bringt Implicit Caching (kein manuelles `x-grok-conv-id` Header-Plumbing mehr nötig)
- Bietet ein Spend-Dashboard pro Modell und Tag
- Unterstützt BYOK: dein bestehender xAI-API-Key bleibt der primäre Billing-Channel, nur bei Fallback wird Vercel-Credit verbraucht

xAI-spezifische Features (Live Search via `searchParameters`) in `x-search` und `extreme-search` bleiben auf dem direkten `@ai-sdk/xai` Provider — diese Features sind über das Gateway nicht stabil durchgereicht (offenes Issue vercel/ai#12827).

Aus User-Sicht nach der Migration: bei xAI-Überlast schaltet der Stream automatisch auf Claude um, der Chat antwortet weiter, kein Reload nötig. Latency-Overhead durch den Gateway-Hop liegt bei 10–50 ms, vernachlässigbar gegenüber den ~20 s Generierungszeit.

## User Stories

1. Als MYLO-User möchte ich, dass mein Flight-Search-Request beantwortet wird, auch wenn xAI gerade überlastet ist, damit ich nicht auf "Try Again" klicken muss.
2. Als MYLO-User möchte ich keinen kryptischen `Type validation failed` Stack-Trace in meinem Chat sehen, damit ich Vertrauen in die Reliability des Produkts behalte.
3. Als MYLO-User möchte ich, dass meine bereits durchgeführten Tool-Calls (Seats.aero, Duffel, Skiplagged) nicht verloren gehen, wenn der Synthese-Step failed, damit ich nicht für eine fehlgeschlagene LLM-Antwort warten muss.
4. Als MYLO-User möchte ich, dass die X-Search-Funktion (Live-Search auf X-Posts) weiterhin funktioniert, damit Reise-Insights aus Social Media erhalten bleiben.
5. Als Operator möchte ich pro Tag sehen, wie viele Tokens für welches Modell verbraucht wurden, damit ich Kosten kontrollieren und Anomalien früh erkennen kann.
6. Als Operator möchte ich pro Tag sehen, wie oft auf einen Fallback-Provider gewechselt wurde, damit ich xAI-Capacity-Trends erkenne und ggf. das Primary-Modell rotiere.
7. Als Operator möchte ich ohne Code-Deploy zwischen Providern wechseln können, damit ich auf längerfristige Provider-Outages reagieren kann.
8. Als Pascal (Founder) möchte ich, dass mein bestehender xAI-API-Key der primäre Abrechnungspfad bleibt, damit meine xAI-Credits zuerst verbraucht werden und ich keinen doppelten Billing-Channel öffne.
9. Als Pascal möchte ich, dass die Migration die Token-Kosten nicht erhöht, damit der Wechsel finanziell neutral bleibt (Vercel verlangt 0 % Markup auf Tokens).
10. Als Pascal möchte ich, dass die `xaiCacheHeaders`-Logik ersatzlos entfernt wird, damit kein toter Code im Repo bleibt.
11. Als Pascal möchte ich, dass die Cached-Input-Token-Optimierung weiter funktioniert (Implicit Caching im Gateway), damit ich keine Cost-Regression bei häufig wiederholten Anfragen bekomme.
12. Als Entwickler möchte ich an einer einzigen Stelle die Fallback-Modell-Liste konfigurieren, damit ich bei einem Provider-Outage nicht in fünf verschiedenen Files das Failover anpassen muss.
13. Als Entwickler möchte ich, dass die Failover-Policy isoliert testbar ist, damit ich neue Fallback-Modelle ohne Smoke-Test gegen die Live-API einbauen kann.
14. Als Entwickler möchte ich klar dokumentiert haben, welche Tools auf Gateway laufen und welche auf direktem `@ai-sdk/xai`, damit ich beim Hinzufügen neuer Tools die richtige Strategie wähle.
15. Als Entwickler möchte ich, dass der Airport-Resolver (`grok-3-mini`) den günstigeren Modell-Slug behält, damit die geplanten ~75 % Kostenersparnis pro Resolution-Call erhalten bleibt.
16. Als Entwickler möchte ich, dass der Title-Generator und der Raycast-Endpoint weiterhin mit dem aktuellen Modell laufen, damit es zu keinem Regression in der Title-Qualität kommt.
17. Als Entwickler möchte ich, dass alle bestehenden Konsumenten von `languageModel` ohne Signatur-Änderung weiterlaufen, damit der Diff klein bleibt und Reviews fokussiert sind.
18. Als Entwickler möchte ich, dass im Production-Deployment auf Vercel keine API-Keys manuell gemanaged werden müssen, da OIDC-Auth automatisch greift.
19. Als Entwickler möchte ich für lokales `pnpm dev` den `AI_GATEWAY_API_KEY` aus `.env.local` lesen können, damit das Onboarding für neue Mitwirkende einfach bleibt.
20. Als Entwickler möchte ich `providerMetadata.gateway.modelAttempts` in den Logs sehen, damit ich nach einem Failover nachvollziehen kann, welcher Provider tatsächlich geantwortet hat.
21. Als Entwickler möchte ich, dass `experimental_context` für Tools weiterhin funktioniert (chatId/userId), damit der gerade in der gleichen Session gefixte Tool-Persistence-Bug nicht regressed.
22. Als QA möchte ich einen einfachen Smoke-Test-Pfad haben (z. B. xAI-Key kurz invalidieren), damit ich Failover-Verhalten manuell verifizieren kann.

## Implementation Decisions

**Module 1 — Gateway Provider (`ai/providers.ts`):**
Ersetzt `createXai({ apiKey })` durch `createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })`. Exportiert `languageModel` weiterhin als Konsumenten-stabile Konstante (Type ändert sich von `LanguageModel` zu Gateway-resolved Model — alle Konsumenten nutzen `model: languageModel` was beide Formen akzeptiert). `getAirportResolverModel()` returnt das `grok-3-mini` Model via Gateway. `scira.languageModel(_model)` Legacy-Helper bleibt unverändert in der Signatur.

**Module 2 — Failover Policy (`ai/failover.ts` neu):**
Eine reine Funktion `getStreamPolicy(profile?: 'chat' | 'title' | 'translate' | 'resolver'): { models: string[] }`. Sie kapselt die Fallback-Reihenfolge an einer einzigen Stelle. Default-Profile `chat` gibt `['anthropic/claude-opus-4.6']` als Fallback zurück, andere Profile starten mit leerer Liste (Title-Generation und Resolver brauchen keinen Fallback, weil bei Failure nur ein Default-Title bzw. eine Re-Try der Airport-Heuristik passiert). Konsumenten konsumieren das via `providerOptions: { gateway: getStreamPolicy('chat') }`.

**Module 3 — Konsumenten-Anpassung (Cross-Cutting):**
Folgende Files werden angefasst, alle behalten ihre Signaturen:
- `app/api/search/route.ts`: streamText nutzt `providerOptions.gateway` aus `getStreamPolicy('chat')`. `xaiCacheHeaders(id)` Aufruf entfernt.
- `app/actions.ts`: `generateText` für Title-Gen und Enhance — Profile `title` (kein Fallback). `scira.languageModel('scira-name')` und `scira.languageModel('scira-enhance')` mappen auf Gateway-Modell-String.
- `app/api/xql/route.ts`: Profile `chat` mit Fallback.
- `app/api/raycast/route.ts`: Profile `chat` mit Fallback.
- `lib/tools/text-translate.ts`: Profile `translate` (kurzer Output, kein Fallback nötig).
- `lib/utils/llm-airport-resolver.ts`: Nutzt `getAirportResolverModel()` weiterhin, bekommt durch Gateway-Migration automatisch die Failover-Vorteile.

**Module 4 — xAI-Direct Island (unverändert):**
`lib/tools/x-search.ts` und `lib/tools/extreme-search.ts` behalten den direkten `xai('grok-4.3')` Import wegen `searchParameters` Live-Search-Feature. Ein Boundary-Comment im Top-of-File dokumentiert: "Diese Datei nutzt `@ai-sdk/xai` direkt, weil das Live-Search-Feature über Vercel AI Gateway nicht stabil durchgereicht wird (siehe vercel/ai#12827). Bei Migration aller anderen Tools auf Gateway: bewusst hier nicht migriert."

**Module 5 — Cleanup:**
- `xaiCacheHeaders()` Funktion + `CONV_ID_PATTERN` Konstante aus `ai/providers.ts` ersatzlos entfernt
- Alle `headers: xaiCacheHeaders(id)` Call-Sites entfernt
- Comment-Block "Pricing context (verified 2026-05) ..." obsolet, wird aktualisiert mit Gateway-Pricing-Hinweis
- `xaiClient` interne Konstante in `ai/providers.ts` entfällt
- `console.log('[AI Provider] Using xAI Grok 4.3')` Boot-Log wird zu `'[AI Provider] Using Vercel AI Gateway → xai/grok-4.3 (primary)'`

**Authentication:**
Production: OIDC automatisch via Vercel-Deployment. Lokal: `AI_GATEWAY_API_KEY` aus `.env.local` (bereits konfiguriert). BYOK für xAI ist im Vercel Dashboard hinterlegt — keine Code-Änderung nötig, der Gateway nutzt automatisch den BYOK-Key bei Routing zu xAI.

**Schema/Contract Changes:**
Keine. Die `chat`/`message`/`tool_calls` Datenbank-Schemas bleiben unverändert. Token-Counts in der `messages.inputTokens`/`outputTokens`/`cachedInputTokens` Spalten kommen weiterhin aus `event.usage`, das vom Gateway korrekt durchgereicht wird (verifiziert via `providerMetadata.gateway.modelAttempts[0].providerAttempts[0]`).

**Logging Erweiterung:**
In `onFinish` der streamText Calls wird zusätzlich `event.providerMetadata?.gateway?.modelAttempts` ge-loggt, damit nach einem Failover sichtbar wird, welcher Provider tatsächlich geantwortet hat. Format-Ziel: einzeilig, kompakt, kein Logging-Refactor.

**Pricing/Cost-Erwartung:**
- Token-Kosten: identisch zu xAI direkt ($1.25/M Input, $2.50/M Output für grok-4.3). Vercel berechnet 0 % Markup.
- Implicit Caching: Gateway handhabt Prompt-Caching automatisch — vergleichbare oder bessere Cache-Hit-Rate als die manuell gepflegte `x-grok-conv-id` Lösung.
- Fallback-Calls auf Claude Opus: bei xAI-Capacity-Issues wird ggf. Claude verwendet (~$5/M Input, $15/M Output). Bei realistisch <2 % Failover-Rate vernachlässigbarer Mehraufwand.
- Free Tier ($5/Monat) entfällt für den User, da bereits Pro-Plan ($25/Monat) — die Gateway-Credits werden gegen das Pro-Subscription-Guthaben abgerechnet, nicht zusätzlich.

## Testing Decisions

Ein guter Test in diesem Kontext prüft **externes Verhalten**: gegebene Eingaben → erwarteter Konfigurations-Output. Er tested NICHT, ob `streamText` intern korrekt aufgerufen wird (das ist Implementation-Detail des SDK). Er bricht nicht, wenn die Implementation refactored wird, solange das beobachtbare Verhalten gleich bleibt.

**In Scope:**

- **Failover Policy Module Tests** (`ai/failover.test.ts` neu, mit Bun Test wie der bestehende Style in `lib/admin/token-costs.test.ts` und `lib/thrivecart/kpi.test.ts`):
  1. `getStreamPolicy('chat')` returnt `{ models: ['anthropic/claude-opus-4.6'] }`
  2. `getStreamPolicy('title')` returnt `{ models: [] }` (kein Fallback gewünscht)
  3. `getStreamPolicy('translate')` returnt `{ models: [] }`
  4. `getStreamPolicy('resolver')` returnt `{ models: [] }`
  5. `getStreamPolicy()` ohne Argument returnt das `chat`-Profile (Default)
  6. Mehrfach-Aufrufe sind referenz-stabil (keine neue Array-Allokation pro Call) — Smoke-Check für Memo-Verhalten

Prior Art: Die Tests in `lib/admin/token-costs.test.ts` (frisch in dieser Session geschrieben) und `lib/thrivecart/kpi.test.ts` zeigen den Style: Bun-Test-Runner, keine externen Dependencies, klar benannte `describe`/`test` Blöcke, in-line Assertions ohne Setup-Teardown-Pyramide.

**Out of Scope (siehe nächste Section):**
Integration-Test gegen die Live-Gateway-API wird nicht geschrieben. Manuelle Verifikation via lokalem `pnpm dev` und Triggern eines Flight-Search ist die Akzeptanz-Methode.

## Out of Scope

- **Live-Integration-Test gegen Vercel AI Gateway**: Würde echte API-Calls und API-Keys in CI brauchen. Verifikation erfolgt manuell (Dev-Run, Smoke-Test, Production-Monitoring der ersten 24 h).
- **Migration der xAI-Live-Search-Tools** (`x-search.ts`, `extreme-search.ts`): Bleiben auf direktem `@ai-sdk/xai` solange vercel/ai#12827 offen ist. Re-Evaluation in 3 Monaten oder wenn das Issue gemerged ist.
- **Eval-Standalone Code** (`lib/chat/__evals__/grok-client.ts`): Reines Eval-Skript, kein User-Code-Pfad. Kann später migriert werden, kein Business-Impact.
- **Fallback-Strategien jenseits Modell-Switch**: Themen wie Caching von Tool-Results bei Synthese-Failure, partial Output-Recovery, oder Stream-Resumption werden hier nicht adressiert.
- **Spend-Alerting / Auto-Top-Up Konfiguration**: User konfiguriert das im Vercel Dashboard manuell.
- **HIPAA / ZDR Compliance Toggles**: Nicht relevant für MYLO Travel Concierge.
- **Migration weg von Grok als Primary-Modell**: Bleibt grok-4.3 — der PRD löst das Reliability-Problem, nicht ein Modell-Wahl-Problem.
- **Testing der Fallback-Provider-Output-Qualität**: Annahme dass Claude Opus bei einem Flight-Search-Synthese-Step ein zumindest vergleichbares Ergebnis liefert. Falls nicht, ist der Fallback immer noch besser als ein roter Error.
- **Tool-Call-Persistence-Fix** (chatId='unknown'): bereits in derselben Session gefixt via `experimental_context`, kein Teil dieses PRDs.

## Further Notes

**Entscheidungs-Basis:**
- Vercel AI Gateway erlaubt 0 % Markup, BYOK ist supported, `xai/grok-4.3` ist seit 30. April 2026 im Gateway-Katalog
- Der upstream xAI-SDK-Bug (vercel/ai#10533) wurde 9. Jan 2026 gefixt, aber nur für `application/json` — die `text/event-stream`-Variante bleibt offen
- Eine eigene Fetch-Interceptor-Lösung wurde während des Investigations getestet und verworfen, weil das `await reader.read()` auf den ersten Byte den SSE-Stream blockiert (siehe Investigation-Verlauf in derselben Session)

**Risks:**
- Gateway-Outage: wäre ein Single-Point-of-Failure. Mitigation: Fallback-Modell-Liste impliziert auch Fallback-Provider; Vercel selbst hat redundante Routing-Layer
- Latency-Erhöhung bei kalten Routen: erstmaliger Provider-Cold-Start möglich. Bei MYLOs Stream-Pattern (~20 s Total-Time) vernachlässigbar
- BYOK-Fallback frisst Vercel-Credit: bei längeren xAI-Outages könnte der Fallback-Volume hoch sein. Mitigation: Auto-Top-Up im Dashboard konfigurieren
- `providerOptions.xai` in `text-translate` und ähnlichen Tools: aktuell nutzt nur x-search/extreme-search xAI-spezifische Options. Beim Migrieren weiterer Tools später drauf achten

**Verifikations-Plan nach Merge:**
1. Lokaler Smoke-Test: Flight-Search Frankfurt → JFK, prüfen dass `Called Tool: search_flights`, `kiwi_flight_search`, `skiplagged_flight_search` geloggt werden und der Output gerendert wird
2. Logs prüfen auf `providerMetadata.gateway.modelAttempts` Eintrag
3. Production: 24 h Monitoring der `messages.model` und `messages.inputTokens` Spalten — keine Regression bei Token-Counts
4. Vercel AI Gateway Dashboard öffnen, Spend-Curve checken — sollte ähnlich zu vorigem xAI-Direct-Spend liegen
5. Bei nächstem xAI-Capacity-Window (typisch 10:00-18:00 UTC werktags): Verifikation dass Failover stattfindet und User-Output weiterläuft

**Migration-Reihenfolge (für die Implementation):**
1. `ai/providers.ts` umbauen + `ai/failover.ts` neu anlegen + Tests schreiben
2. `app/api/search/route.ts` umstellen (höchstes User-Impact, direkter Smoke-Test möglich)
3. Restliche Konsumenten (`actions.ts`, `xql/route.ts`, `raycast/route.ts`, `text-translate.ts`)
4. `xaiCacheHeaders` Cleanup
5. Boundary-Comment in `x-search.ts` und `extreme-search.ts` einfügen
6. TypeScript-Check + manuelles Smoke-Test
7. Commit mit klarer Message wie: `feat(ai-gateway): migrate vanilla LLM calls to Vercel AI Gateway with failover`
