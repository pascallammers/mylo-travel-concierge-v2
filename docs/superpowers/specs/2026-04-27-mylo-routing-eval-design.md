# MYLO Routing Eval Suite — Design

> Erstellt: 2026-04-27
> Branch: feature/flightdeals-apify
> Status: Draft, ready for implementation plan

---

## Goal

Catch routing-regressions in the MYLO web system prompt before they reach production. The prompt at `lib/chat/mylo-system-prompt.ts` makes routing decisions across ~9 tools (`search_flights`, `knowledge_base`, `web_search`, `get_loyalty_balances`, `weather`, `datetime`, `retrieve`, `nearby_places_search`, `translate`). When the prompt or tool schemas change, we want CI to fail if Grok starts routing real user queries to the wrong tool.

## Non-Goals

- Output-style validation (no Pre-Output-Gate compliance check, no citation-format check, no DACH-tone check). Static prompt-content tests in `lib/chat/mylo-system-prompt.test.ts` already cover the prompt text. This eval covers the LLM's behavior given that prompt.
- Tool-execution correctness. We mock all tool implementations — eval validates routing only.
- Sequence-aware routing. We assert the first tool call only; KB → web_search fallback paths get split into separate fixtures (one for KB-hit, one for KB-miss).

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Eval target | Routing correctness (which tool gets called) | Highest-value regression to catch; output style is already covered by static prompt tests |
| Execution mode | Live xAI Grok per CI run | Routing decisions only manifest at inference time; recording would just diff snapshots, not catch real model drift |
| Test cases | 12 total: 5 real DB chats + 7 hand-curated edge cases | Real cases ground the eval in actual user patterns; edge cases cover known failure modes |
| Assertion style | Strict: `expectedTool === actualTool` (or both `null`) | Simple, deterministic; KB-fallback paths split into discrete fixtures |
| Test runner | Separate `pnpm eval` script (not `pnpm test`) | Cost boundary clear; eval only runs when relevant code changes |
| Production model match | `grok-4-1-fast-non-reasoning` | Same model as production. Switching the eval to a different model would test something other than what runs in prod |
| Future: model upgrade | Grok 4.20 evaluated via `EVAL_MODEL=grok-4.20-0309-non-reasoning pnpm eval` once 4.1 baseline passes | Eval doubles as the gate for the upcoming 4.1 → 4.20 production upgrade |

## Architecture

```
lib/chat/__evals__/
├── README.md                       # How to run locally, how to add fixtures
├── run.ts                          # Main runner
├── grok-client.ts                  # @ai-sdk/xai wrapper with temperature=0, retry on 429
├── tool-extractor.ts               # Parse first tool call from AI-SDK response
├── mock-tools.ts                   # Production tool schemas with noop execute()
├── reporter.ts                     # Pretty terminal output (PASS/FAIL table + failure detail)
├── extract-real-chats.ts           # One-off Neon DB extraction (NEVER runs in CI)
└── fixtures/
    ├── types.ts                    # EvalFixture type
    ├── real-chats.ts               # 5 anonymized cases, populated via extract-real-chats.ts
    └── edge-cases.ts               # 7 hand-curated cases
```

### Data Flow per Eval Run

1. `run.ts` loads `[...realChats, ...edgeCases]` → `EvalFixture[]`
2. For each fixture:
   1. `buildMyloWebSystemPrompt({ now: fx.now })` builds the system prompt
   2. `buildMockToolRegistry()` returns production tool definitions with noop `execute()`
   3. `generateText({ model: xai(EVAL_MODEL), system, prompt: fx.userQuery, tools, temperature: 0, stopWhen: stepCountIs(1) })`
   4. `extractFirstToolCall(result)` → `actualTool: string | null`
   5. `passed = actualTool === fx.expectedTool`
3. Reporter prints results table + failure detail
4. Exit `0` if all pass, `1` otherwise

## EvalFixture Type

```typescript
// lib/chat/__evals__/fixtures/types.ts
export type EvalFixture = {
  id: string;                    // unique slug, e.g. "real-001-flight-bangkok"
  source: 'real' | 'edge';
  description: string;            // human-readable: what this case validates
  userQuery: string;              // exact user input (anonymized for real cases)
  expectedTool: string | null;    // null = no tool expected (direct answer from system context)
  reason: string;                 // why this tool is expected (doc for future maintainers)
  now?: Date;                     // fixed Date for deterministic past-date tests
};
```

`expectedTool: null` is a first-class case. Example: "Wie viele Punkte habe ich insgesamt?" — the system prompt explicitly instructs MYLO to answer from the loyalty context already injected, not call `get_loyalty_balances`. Calling no tool IS the correct routing decision.

## Real Cases Extraction Workflow

`extract-real-chats.ts` is a **manual, one-off script**. Never runs in CI.

```bash
pnpm eval:extract-real
```

Steps:
1. Connect to Neon production via `DATABASE_URL`
2. Run SQL (skeleton, refine in implementation):
   ```sql
   SELECT c.id, m.parts, tc.tool_name, tc.created_at
   FROM chat c
   JOIN message m ON m.chat_id = c.id AND m.role = 'user'
   JOIN tool_calls tc ON tc.chat_id = c.id
     AND tc.created_at BETWEEN m.created_at AND m.created_at + interval '2 minutes'
   WHERE tc.status = 'succeeded'
     AND tc.tool_name IN (
       'search_flights', 'knowledge_base', 'web_search',
       'get_loyalty_balances', 'weather', 'datetime',
       'retrieve', 'nearby_places_search', 'translate'
     )
     AND m.created_at > now() - interval '14 days'
   ORDER BY tc.created_at DESC
   LIMIT 30;
   ```
3. Print 30 candidates as a table: `idx | userQuery (truncated) | toolName | timestamp`
4. Pascal selects 5 IDs (e.g. `1,4,7,12,19`) for diverse coverage
5. Script anonymizes selected cases:
   - Email regex → `user@example.com`
   - Phone E.164 → `+49 xxx xxx xxxx`
   - Loyalty numbers (≥8 digits) → `XXXXXXXX`
   - User first names (lookup `user.name` from chat.userId) → `[Name]`
   - Cities, countries, dates: kept (this is the routing context)
6. Writes `fixtures/real-chats.ts` with 5 `EvalFixture` entries, source: `'real'`
7. Pascal manually reviews + commits

## Edge Cases (Initial Set)

| ID | userQuery | expectedTool | Routing Hypothesis |
|---|---|---|---|
| `edge-001-past-date` | "Flüge von Frankfurt nach Phuket am 15.03.2024 in Business" | `search_flights` | Routing must pick `search_flights` even for past dates — tool layer rejects past dates, not the router |
| `edge-002-kb-general-travel` | "Wann ist beste Reisezeit für Bali?" | `knowledge_base` | KB-First mandate for general informational queries |
| `edge-003-award-explicit-de` | "Wie viele Meilen brauche ich für Frankfurt-Tokyo Business?" | `search_flights` | DACH-German + award/miles keyword MUST route to `search_flights`, not `web_search` |
| `edge-004-loyalty-specific` | "Wie viele Lufthansa-Meilen habe ich?" | `get_loyalty_balances` | Specific provider triggers tool, not system context |
| `edge-005-loyalty-aggregate` | "Wie viele Punkte habe ich insgesamt?" | `null` | System prompt explicitly: answer from Loyalty Context, no tool |
| `edge-006-weather` | "Wie ist das Wetter in Bangkok?" | `weather` | Direct weather tool, not KB detour |
| `edge-007-mixed-language` | "Show me hotels near Phuket Old Town" | `nearby_places_search` | English + location → nearby_places_search, not web_search |

These are starting fixtures. Implementation can refine wording and add cases as routing-failures surface.

## Mock Tool Registry

`lib/chat/__evals__/mock-tools.ts` imports the **real** production tool definitions from `lib/tools/`, then replaces `execute()` with a noop:

```typescript
import { flightSearchTool, knowledgeBaseTool, webSearchTool /* ... */ } from '@/lib/tools';

const noopExecute = async () => ({ ok: true, mock: true });

export function buildMockToolRegistry() {
  return {
    search_flights:        { ...flightSearchTool,    execute: noopExecute },
    knowledge_base:        { ...knowledgeBaseTool,   execute: noopExecute },
    web_search:            { ...webSearchTool,       execute: noopExecute },
    get_loyalty_balances:  { ...loyaltyTool,         execute: noopExecute },
    weather:               { ...weatherTool,         execute: noopExecute },
    datetime:              { ...datetimeTool,        execute: noopExecute },
    retrieve:              { ...retrieveTool,        execute: noopExecute },
    nearby_places_search:  { ...nearbyTool,          execute: noopExecute },
    translate:             { ...translateTool,       execute: noopExecute },
  };
}
```

Tool **schemas** (names, descriptions, parameter types) match production exactly. Routing decision happens under the same conditions the production model sees, but no real downstream API (Duffel, Tavily, AwardWallet) gets called.

The exact tool list in `web` group lives in `app/actions.ts`. The implementation plan must verify which tools are actually exposed for the `web` group and only mock those.

## Reporter Output

```
MYLO Routing Eval — model=grok-4-1-fast-non-reasoning

✓ real-001-flight-bangkok           expected=search_flights         actual=search_flights
✓ real-002-bali-info                expected=knowledge_base          actual=knowledge_base
✗ real-003-award-tokyo              expected=search_flights         actual=web_search          ← FAIL
✓ real-004-lufthansa-miles          expected=get_loyalty_balances   actual=get_loyalty_balances
✓ real-005-weather-phuket           expected=weather                 actual=weather
✓ edge-001-past-date                expected=search_flights         actual=search_flights
✓ edge-002-kb-general-travel        expected=knowledge_base          actual=knowledge_base
✓ edge-003-award-explicit-de        expected=search_flights         actual=search_flights
✓ edge-004-loyalty-specific         expected=get_loyalty_balances   actual=get_loyalty_balances
✓ edge-005-loyalty-aggregate        expected=null                    actual=null
✓ edge-006-weather                  expected=weather                 actual=weather
✓ edge-007-mixed-language           expected=nearby_places_search   actual=nearby_places_search

11/12 passed (91.7%)  •  duration 28.3s

Failures:
  real-003-award-tokyo
    User: "Wie viele Meilen brauche ich für Frankfurt-Tokyo Business?"
    Expected: search_flights
    Actual:   web_search
    Reason:   DACH-German award query MUST route to search_flights per system prompt
```

Exit-Code 0 on all-pass, 1 on any failure. CI fails the PR.

## Failure Handling

- **Rate-limit (HTTP 429):** retry with exponential backoff, max 3 attempts, then fail
- **Network error:** retry once, then fail
- **Timeout:** 30s per call, then fail with clear message
- **Tool-schema mismatch:** if AI-SDK rejects schema, fail with detailed error showing the offending field

All errors caught at the fixture level. One bad fixture doesn't crash the whole run — other 11 still execute.

## CI Integration

`.github/workflows/eval.yml`:

```yaml
name: MYLO Routing Eval
on:
  pull_request:
    paths:
      - 'lib/chat/mylo-system-prompt.ts'
      - 'lib/tools/**'
      - 'lib/chat/__evals__/**'
      - 'app/actions.ts'
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm eval
        env:
          XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
          EVAL_MODEL: grok-4-1-fast-non-reasoning
```

**Path-Filter:** Eval only runs when system prompt, tools, eval code, or actions.ts changes. UI-only PRs skip the eval — no API cost, no false positives from unrelated changes.

**Required GitHub Secret:** `XAI_API_KEY` (Pascal sets in repo settings before first CI run).

## Grok 4.20 Comparison Workflow

After 4.1 baseline is green and stable for ~1 week:

```bash
# Locally:
EVAL_MODEL=grok-4.20-0309-non-reasoning pnpm eval

# If all 12 pass → Pascal decides on production switch.
# Production switch lives in lib/xai/ provider config + lib/tools/* model usages.
# That's a separate lane, NOT part of this eval-suite spec.
```

This eval-suite is the **gate** for the upgrade decision. Without it, switching production to 4.20 is a blind change.

## Package.json Scripts

```json
{
  "scripts": {
    "eval": "tsx lib/chat/__evals__/run.ts",
    "eval:extract-real": "tsx lib/chat/__evals__/extract-real-chats.ts"
  }
}
```

## Out of Scope (Anti-Scope)

- Other group prompts (`extreme`, `voice`, etc.) — only `web` group is covered. Other groups get evals as separate lanes if needed.
- Multi-turn conversation evals — we test single-turn routing only.
- Streaming behavior — we use `generateText`, not `streamText`.
- Latency or cost SLAs — eval reports duration but doesn't fail on perf.
- Output content validation (formatting, citations, language matching) — covered by static prompt tests in `mylo-system-prompt.test.ts`.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM nondeterminism causes flaky tests | `temperature=0`, retry on rate-limit, single-step generation. If still flaky, mark fixture as `flaky: true` and require 2-of-3 runs to pass (only if needed — start without). |
| `XAI_API_KEY` missing in CI | First CI-run will fail with a clear "missing key" error. Pascal adds the secret, re-runs. Document in README. |
| Real-chat anonymization misses PII | Pascal manually reviews `fixtures/real-chats.ts` before committing. Add unit test that scans real-chat fixtures for `@`, phone-like patterns, long digit runs. |
| Tool schema drift between mock and production | Mock imports schemas directly from `lib/tools/`, no copy-paste. If a tool removes/renames, TypeScript fails the eval build. |
| Eval becomes maintenance burden | If a fixture flakes, fix the prompt or remove the fixture — never silently raise the pass threshold. |

## Implementation Plan Hand-Off

The next step is `/superpowers:writing-plans` to produce a sequenced TDD implementation plan with these phases (rough sketch — writing-plans will refine):

1. **Foundation:** types, mock-tools, grok-client, tool-extractor (pure units, no LLM call)
2. **Edge cases first:** edge-cases.ts fixtures + run.ts skeleton + reporter — full eval runs locally with `XAI_API_KEY` against 7 hand-curated cases
3. **Real-cases extraction:** extract-real-chats.ts script + anonymization + manual selection workflow
4. **Real-cases fixtures:** Pascal runs the extraction, commits 5 real cases
5. **CI workflow:** GitHub Action + path filter + secret setup
6. **Documentation:** README with run instructions, troubleshooting, model-comparison workflow
7. **(Follow-up, separate lane):** Grok 4.20 comparison run + production model upgrade decision

Each phase commits independently. TDD strict: tests first, then implementation. Codex review per commit before push.
