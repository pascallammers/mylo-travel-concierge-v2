# MYLO Routing Eval Suite

LLM-based routing eval that runs the production MYLO web system prompt against a fixed set of user queries and asserts that xAI Grok routes each query to the expected first tool.

## When this runs

Pre-merge in GitHub Actions (`.github/workflows/eval.yml`) on PRs that touch:
- `lib/chat/mylo-system-prompt.ts`
- `lib/tools/**`
- `lib/chat/__evals__/**`
- `app/actions.ts`

PRs that don't touch these paths skip the eval — no API cost.

## Run locally

You need `XAI_API_KEY` in `.env.local` (alongside the other env vars `env/server.ts` validates).

```bash
pnpm eval
```

Optionally pin a different model (e.g. for the Grok 4.1 → 4.20 upgrade comparison):

```bash
EVAL_MODEL=grok-4.20-0309-non-reasoning pnpm eval
```

## Run the eval helper tests

The helpers (`mock-tools`, `tool-extractor`, `reporter`, `anonymize`, `pii-scan`) have unit tests. They live in `lib/chat/__evals__/**/*.test.ts` and are run via:

```bash
pnpm test:evals
```

The standard `pnpm test` glob has pre-existing failures from other test files (env validation, `server-only` imports). Use `pnpm test:evals` instead — it sets `--env-file=.env.local --conditions=react-server --test-force-exit` so the eval helpers run cleanly.

Why the flags matter:
- `--env-file=.env.local` — the helpers transitively import modules that reach `env/server.ts`, which validates required env vars at import time. Without this, the test process exits before any test runs.
- `--conditions=react-server` — some imports resolve to React Server Component variants. Without this condition, the resolver picks the client variant and the import chain fails.
- `--test-force-exit` — forces Node's test runner to exit after all tests finish, even if a transitive import left an open handle (e.g. a Postgres pool). Without it the runner hangs.

## Fixtures

12 total in `fixtures/`:

- **`edge-cases.ts`** — 7 hand-curated cases covering known routing decisions:
  - past-date flight queries
  - KB-First mandate for general informational queries
  - DACH-German award/miles routing
  - provider-specific vs aggregate loyalty queries
  - direct weather lookup
  - language-mixed (English + German location)
- **`real-chats.ts`** — 5 anonymized real chats from Neon production, regenerated via `pnpm eval:extract-real`

Each fixture has the shape:

```typescript
type EvalFixture = {
  id: string;                  // unique slug
  source: 'real' | 'edge';
  description: string;         // human-readable
  userQuery: string;           // exact user input
  expectedTool: string | null; // null = no tool expected
  reason: string;              // why this routing is correct
  now?: Date;                  // fixed Date for past-date tests
};
```

`expectedTool: null` is a valid case: certain queries (e.g. "Wie viele Punkte habe ich insgesamt?") are answered from the system context without any tool call. Calling `get_loyalty_balances` for an aggregate query is a routing failure.

## Refreshing real chats

```bash
pnpm eval:extract-real
```

The script:
1. Connects to production Neon via `DATABASE_URL` (loaded from `.env.local`)
2. Pulls last 14 days of successful tool calls (web group) joined with the triggering user message
3. Prints up to 30 candidates as a table
4. Prompts you to pick 5 indices
5. Anonymizes (emails, international + German national-format phones, 8+ digit IDs, user first names with word-boundary + case-insensitive matching)
6. Runs `scanForPii` as a safety check (exit code 3 if any pattern remains)
7. Writes `fixtures/real-chats.ts`

**Always review the generated file by hand before committing.** The `pii-scan.test.ts` guard catches the most common patterns but is not a substitute for a human read.

### What anonymization catches

The `anonymize.ts` helper handles 4 PII categories:

1. **Emails** (Unicode-aware, including umlauts: `müller@beispiel.de`) → `user@example.com`
2. **International phones** (`+49 171 1234567`) → `+49 xxx xxx xxxx`
3. **German national-format phones** (`0171 1234567`) → `0xxx xxxxxxx`
4. **8+ digit numbers** (loyalty IDs) → `XXXXXXXX`

Plus a fifth replacement that runs alongside the categories above:
- **User first name** (matched with word boundaries, case-insensitive) → `[Name]`

### Known limits — manual review still required

NOT caught automatically:
- IBAN / credit card formatted with 4-digit chunks (`DE89 3704 0044 0532 0130 00`) — chunks are <8 digits each, so the digit-run regex doesn't match
- Loyalty IDs that mix letters and digits (`EK123456`) — the regex requires pure digits
- German passport numbers (9 alphanumeric chars)
- Cities, country names, dates (intentionally preserved — that's routing context)

These won't fail the PII scan but a human reading the fixture should redact them if they slip through.

## Adding a new edge case

1. Add an entry to `fixtures/edge-cases.ts`
2. Run `pnpm eval` locally — verify it routes as expected
3. Commit

## Failure triage

Eval fails → CI fails the PR. Read the failure block:

```
Failures:
  edge-003-award-explicit-de
    User: "Wie viele Meilen brauche ich für Frankfurt-Tokyo Business?"
    Expected: search_flights
    Actual:   web_search
    Reason:   ...
```

Three failure modes:

- **Real prompt regression** — your PR weakened the prompt's routing. Fix the prompt in `lib/chat/mylo-system-prompt.ts`.
- **Bad fixture** — the `expectedTool` was wrong. Update the fixture's `expectedTool` and `reason` in `fixtures/edge-cases.ts` or `fixtures/real-chats.ts`.
- **Tool name typo** — verify against `app/actions.ts:273-291` and `mock-tools.ts:WEB_GROUP_TOOL_NAMES`.

## Setup checklist (one-time)

- [ ] Add `XAI_API_KEY` to GitHub repo secrets (Settings → Secrets and variables → Actions → New repository secret)
- [ ] Run `pnpm eval:extract-real` locally to populate real fixtures (Task 10 in the implementation plan)
- [ ] First PR that touches the prompt confirms CI catches a deliberate regression (sanity check)

## CI environment variables

The CI workflow writes `.env.local` from GitHub secrets before running `pnpm eval`. The current required-secret list:

| Secret | Purpose | CI value |
|---|---|---|
| `XAI_API_KEY` | xAI API auth — eval calls Grok | **Real key from secret** |
| `ANTHROPIC_API_KEY` | Validated by `env/server.ts` | Fake placeholder |
| `DATABASE_URL` | Validated by `env/server.ts` | Fake placeholder (`postgres://...`) |
| `THRIVECART_API_KEY` | Validated by `env/server.ts` | Fake placeholder |
| `THRIVECART_SECRET_WORD` | Validated by `env/server.ts` | Fake placeholder |
| `UPSTASH_REDIS_REST_URL` | Validated by `env/server.ts` | Fake placeholder URL |
| `UPSTASH_REDIS_REST_TOKEN` | Validated by `env/server.ts` | Fake placeholder |

If `env/server.ts` adds a new required env var, update `.github/workflows/eval.yml` (the `Write .env.local for tsx --env-file` step) to include a placeholder, otherwise CI fails at import time.

## Why this matters

The MYLO web system prompt is ~370 lines of routing instructions. Static string-match tests in `lib/chat/mylo-system-prompt.test.ts` cover the prompt CONTENT. This eval covers the LLM BEHAVIOR given that prompt — the routing actually working in practice. Both layers are needed; one is not a substitute for the other.

## Architecture

```
lib/chat/__evals__/
├── README.md (you are here)
├── run.ts                     Main runner
├── grok-client.ts             AI SDK 5.x wrapper (temperature=0, AbortController timeout, retry on 429)
├── tool-extractor.ts          Pure: parse first tool call from AI-SDK result
├── tool-extractor.test.ts
├── mock-tools.ts              Production tool schemas + noop execute()
├── mock-tools.test.ts
├── reporter.ts                Pretty terminal output (PASS/FAIL table + failure detail)
├── reporter.test.ts
├── extract-real-chats.ts      One-off Neon extraction (NEVER in CI)
├── anonymize.ts               Pure anonymization helpers
├── anonymize.test.ts
└── fixtures/
    ├── types.ts               EvalFixture type
    ├── real-chats.ts          5 real cases (populated by pascal via Task 10)
    ├── edge-cases.ts          7 hand-curated cases
    └── pii-scan.test.ts       Guards against PII leakage in real-chats.ts
```

Each helper is independently testable. The runner (`run.ts`) is integration-tested by Phase 5 of the implementation plan (Pascal's local sanity run).
