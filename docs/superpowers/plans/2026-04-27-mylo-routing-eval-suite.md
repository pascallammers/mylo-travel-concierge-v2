# MYLO Routing Eval Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LLM-based eval suite that validates MYLO web group tool routing against 12 fixtures (5 anonymized real DB chats + 7 hand-curated edge cases), running live xAI Grok-4.1-fast per CI run on PRs that touch prompt/tools.

**Architecture:** New folder `lib/chat/__evals__/`. Custom test runner using AI SDK `generateText` with `stopWhen: stepCountIs(1)` so we capture only the first tool call. Production tool schemas imported with `execute()` replaced by no-ops. Strict assertion: `actualTool === expectedTool` (or both `null`). Pre-merge GitHub Action with path-filter; otherwise eval is silent. Separate `pnpm eval` script — eval files (`*.eval.ts`) are excluded from `pnpm test`.

**Tech Stack:** Node 20 + tsx + node:test (only for unit-testing the eval helpers — the eval runner itself is plain ts), AI SDK 5.x with `@ai-sdk/xai`, Drizzle ORM (Neon HTTP) for the one-off extraction script, GitHub Actions for CI.

**Reference Spec:** `docs/superpowers/specs/2026-04-27-mylo-routing-eval-design.md`

---

## File Structure

```
lib/chat/__evals__/
├── README.md
├── run.ts                     # Main eval runner (no tests — integration covered by Phase 5 sanity run)
├── grok-client.ts             # @ai-sdk/xai wrapper with temperature=0, retry on 429
├── tool-extractor.ts          # Pure: parse first tool call from AI-SDK result
├── tool-extractor.test.ts     # Unit tests
├── mock-tools.ts              # Production tool schemas + noop execute()
├── mock-tools.test.ts         # Unit tests
├── reporter.ts                # Pretty terminal output
├── reporter.test.ts           # Unit tests
├── extract-real-chats.ts      # One-off Neon extraction (NEVER in CI)
├── anonymize.ts               # Pure anonymization helpers
├── anonymize.test.ts          # Unit tests
└── fixtures/
    ├── types.ts               # EvalFixture type
    ├── real-chats.ts          # 5 real cases (Pascal populates via Phase 7)
    ├── edge-cases.ts          # 7 hand-curated cases
    └── pii-scan.test.ts       # Guards against PII leakage in real-chats.ts

.github/workflows/eval.yml     # CI workflow

package.json                   # Add scripts: eval, eval:extract-real
```

The `pnpm test` glob is `lib/**/*.test.ts`. Tests in `__evals__/` (e.g. `tool-extractor.test.ts`) DO get picked up by `pnpm test` — that's intentional: unit tests for pure helpers should run in normal CI. The eval run itself (`run.ts`) is invoked separately via `pnpm eval`.

---

## Phase 1: Types + Mock Tools Registry

### Task 1: EvalFixture type

**Files:**
- Create: `lib/chat/__evals__/fixtures/types.ts`

- [ ] **Step 1: Write the type file**

```typescript
// lib/chat/__evals__/fixtures/types.ts
export type EvalFixture = {
  id: string;
  source: 'real' | 'edge';
  description: string;
  userQuery: string;
  expectedTool: string | null;
  reason: string;
  now?: Date;
};
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit lib/chat/__evals__/fixtures/types.ts`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add lib/chat/__evals__/fixtures/types.ts
git commit -m "feat(evals): add EvalFixture type"
```

---

### Task 2: Mock tools registry

**Files:**
- Create: `lib/chat/__evals__/mock-tools.ts`
- Create: `lib/chat/__evals__/mock-tools.test.ts`

The production `web` group exposes 16 tool names (verified at `app/actions.ts:273-291`):

```
web_search, greeting, code_interpreter, get_weather_data, retrieve,
text_translate, nearby_places_search, track_flight, search_flights,
movie_or_tv_search, trending_movies, find_place_on_map, trending_tv,
datetime, knowledge_base, get_loyalty_balances
```

Three tools are **factories** that take args (`webSearchTool(dataStream, searchProvider)`, `greetingTool(timezone)`, `extremeSearchTool(dataStream)`); the rest are direct exports. `extreme_search` is NOT in the web group, so we don't mock it. For `webSearchTool` and `greetingTool` we call the factories with safe defaults.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/chat/__evals__/mock-tools.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildMockToolRegistry, WEB_GROUP_TOOL_NAMES } from './mock-tools';

describe('buildMockToolRegistry', () => {
  it('exposes exactly the 16 web group tool names', () => {
    const registry = buildMockToolRegistry();
    const keys = Object.keys(registry).sort();
    const expected = [...WEB_GROUP_TOOL_NAMES].sort();
    assert.deepStrictEqual(keys, expected);
  });

  it('every entry has an execute that returns a noop result', async () => {
    const registry = buildMockToolRegistry();
    for (const [name, t] of Object.entries(registry)) {
      const result = await t.execute({}, { toolCallId: 'x', messages: [] });
      assert.deepStrictEqual(result, { ok: true, mock: true }, `tool ${name} did not return noop`);
    }
  });

  it('preserves the inputSchema from the production tool', () => {
    const registry = buildMockToolRegistry();
    // search_flights production schema requires `query` (verify via parse)
    assert.ok(
      'inputSchema' in registry.search_flights,
      'search_flights mock missing inputSchema',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/chat/__evals__/mock-tools.test.ts`
Expected: FAIL with "Cannot find module './mock-tools'".

- [ ] **Step 3: Write the implementation**

```typescript
// lib/chat/__evals__/mock-tools.ts
import {
  flightSearchTool,
  flightTrackerTool,
  knowledgeBaseTool,
  webSearchTool,
  retrieveTool,
  textTranslateTool,
  nearbyPlacesSearchTool,
  findPlaceOnMapTool,
  movieTvSearchTool,
  trendingMoviesTool,
  trendingTvTool,
  weatherTool,
  datetimeTool,
  greetingTool,
  codeInterpreterTool,
  getLoyaltyBalancesTool,
} from '@/lib/tools';

export const WEB_GROUP_TOOL_NAMES = [
  'web_search',
  'greeting',
  'code_interpreter',
  'get_weather_data',
  'retrieve',
  'text_translate',
  'nearby_places_search',
  'track_flight',
  'search_flights',
  'movie_or_tv_search',
  'trending_movies',
  'find_place_on_map',
  'trending_tv',
  'datetime',
  'knowledge_base',
  'get_loyalty_balances',
] as const;

export type WebGroupToolName = (typeof WEB_GROUP_TOOL_NAMES)[number];

const noopExecute = async () => ({ ok: true, mock: true });

function withNoop<T extends { execute?: unknown }>(t: T): T {
  return { ...t, execute: noopExecute } as T;
}

export function buildMockToolRegistry() {
  return {
    web_search: withNoop(webSearchTool(undefined, 'exa')),
    greeting: withNoop(greetingTool('UTC')),
    code_interpreter: withNoop(codeInterpreterTool),
    get_weather_data: withNoop(weatherTool),
    retrieve: withNoop(retrieveTool),
    text_translate: withNoop(textTranslateTool),
    nearby_places_search: withNoop(nearbyPlacesSearchTool),
    track_flight: withNoop(flightTrackerTool),
    search_flights: withNoop(flightSearchTool),
    movie_or_tv_search: withNoop(movieTvSearchTool),
    trending_movies: withNoop(trendingMoviesTool),
    find_place_on_map: withNoop(findPlaceOnMapTool),
    trending_tv: withNoop(trendingTvTool),
    datetime: withNoop(datetimeTool),
    knowledge_base: withNoop(knowledgeBaseTool),
    get_loyalty_balances: withNoop(getLoyaltyBalancesTool),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/chat/__evals__/mock-tools.test.ts`
Expected: 3 tests pass.

If any tool import path is wrong (e.g. an export was renamed), the failure will be at import time. Cross-check with `grep -n "^export const \w*Tool" lib/tools/*.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/chat/__evals__/mock-tools.ts lib/chat/__evals__/mock-tools.test.ts
git commit -m "feat(evals): mock tool registry mirroring web group production schemas"
```

---

## Phase 2: Tool Extractor + Grok Client

### Task 3: Tool extractor

**Files:**
- Create: `lib/chat/__evals__/tool-extractor.ts`
- Create: `lib/chat/__evals__/tool-extractor.test.ts`

AI SDK `generateText` returns `{ toolCalls: Array<{ toolName: string; ... }> }` (and `text` for direct answers). We extract the first tool name, or `null` if no tool was called.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/chat/__evals__/tool-extractor.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { extractFirstToolCall } from './tool-extractor';

describe('extractFirstToolCall', () => {
  it('returns the first tool name when one tool was called', () => {
    const result = { toolCalls: [{ toolName: 'search_flights' }] };
    assert.strictEqual(extractFirstToolCall(result), 'search_flights');
  });

  it('returns null when toolCalls is empty', () => {
    assert.strictEqual(extractFirstToolCall({ toolCalls: [] }), null);
  });

  it('returns null when toolCalls is undefined', () => {
    assert.strictEqual(extractFirstToolCall({}), null);
  });

  it('returns the FIRST tool when multiple are called', () => {
    const result = {
      toolCalls: [{ toolName: 'knowledge_base' }, { toolName: 'web_search' }],
    };
    assert.strictEqual(extractFirstToolCall(result), 'knowledge_base');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/chat/__evals__/tool-extractor.test.ts`
Expected: FAIL — `Cannot find module './tool-extractor'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/chat/__evals__/tool-extractor.ts
type GenerateTextLike = {
  toolCalls?: Array<{ toolName: string }>;
};

export function extractFirstToolCall(result: GenerateTextLike): string | null {
  const first = result.toolCalls?.[0];
  return first ? first.toolName : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/chat/__evals__/tool-extractor.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chat/__evals__/tool-extractor.ts lib/chat/__evals__/tool-extractor.test.ts
git commit -m "feat(evals): extractFirstToolCall helper"
```

---

### Task 4: Grok client wrapper

**Files:**
- Create: `lib/chat/__evals__/grok-client.ts`

This is a thin wrapper. We don't unit-test it — the only logic worth testing (retry-on-429) requires mocking the SDK and the SDK surface is small. Phase 5's sanity run validates it end-to-end.

- [ ] **Step 1: Write the implementation**

```typescript
// lib/chat/__evals__/grok-client.ts
import { generateText, stepCountIs, type LanguageModel } from 'ai';
import { xai } from '@ai-sdk/xai';

export type RouteEvalResult = {
  toolCalls: Array<{ toolName: string }>;
  durationMs: number;
};

const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export function getEvalModel(): LanguageModel {
  return xai(process.env.EVAL_MODEL ?? DEFAULT_MODEL);
}

export async function runRoutingCall(args: {
  model: LanguageModel;
  system: string;
  userQuery: string;
  tools: Record<string, unknown>;
}): Promise<RouteEvalResult> {
  const start = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await Promise.race([
        generateText({
          model: args.model,
          system: args.system,
          prompt: args.userQuery,
          // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool type narrowing is intentionally loose here
          tools: args.tools as any,
          temperature: 0,
          stopWhen: stepCountIs(1),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('eval call timeout')), TIMEOUT_MS),
        ),
      ]);
      return {
        toolCalls: result.toolCalls?.map((tc) => ({ toolName: tc.toolName })) ?? [],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const backoffMs = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('runRoutingCall: exhausted retries (unreachable)');
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit lib/chat/__evals__/grok-client.ts`
Expected: no output. If it complains about `LanguageModel` import, replace with `LanguageModelV2` (AI SDK 5.x rename) — verify with `grep -n "LanguageModel" node_modules/ai/dist/index.d.ts | head -5`.

- [ ] **Step 3: Commit**

```bash
git add lib/chat/__evals__/grok-client.ts
git commit -m "feat(evals): grok client wrapper with retry+timeout"
```

---

## Phase 3: Reporter

### Task 5: Reporter

**Files:**
- Create: `lib/chat/__evals__/reporter.ts`
- Create: `lib/chat/__evals__/reporter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/chat/__evals__/reporter.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { EvalFixture } from './fixtures/types';
import { formatReport, type EvalRunResult } from './reporter';

const fx = (id: string, expectedTool: string | null): EvalFixture => ({
  id,
  source: 'edge',
  description: id,
  userQuery: 'q',
  expectedTool,
  reason: 'r',
});

describe('formatReport', () => {
  it('marks all-pass with a checkmark and summary', () => {
    const results: EvalRunResult[] = [
      { fixture: fx('a', 'search_flights'), actualTool: 'search_flights', passed: true, durationMs: 100 },
      { fixture: fx('b', null), actualTool: null, passed: true, durationMs: 200 },
    ];
    const out = formatReport(results, 'grok-4-1-fast-non-reasoning');
    assert.match(out, /2\/2 passed/);
    assert.match(out, /✓ a/);
    assert.match(out, /✓ b/);
    assert.doesNotMatch(out, /Failures:/);
  });

  it('lists failures with user query and reason', () => {
    const results: EvalRunResult[] = [
      {
        fixture: { ...fx('c', 'search_flights'), userQuery: 'Flüge nach Tokyo', reason: 'must route' },
        actualTool: 'web_search',
        passed: false,
        durationMs: 100,
      },
    ];
    const out = formatReport(results, 'grok-4-1-fast-non-reasoning');
    assert.match(out, /0\/1 passed/);
    assert.match(out, /✗ c/);
    assert.match(out, /Failures:/);
    assert.match(out, /Flüge nach Tokyo/);
    assert.match(out, /must route/);
  });

  it('includes the model name in the header', () => {
    const out = formatReport([], 'grok-4.20-0309-non-reasoning');
    assert.match(out, /grok-4\.20-0309-non-reasoning/);
  });

  it('renders error-string when an error was caught', () => {
    const results: EvalRunResult[] = [
      {
        fixture: fx('d', 'search_flights'),
        actualTool: null,
        passed: false,
        durationMs: 0,
        error: 'eval call timeout',
      },
    ];
    const out = formatReport(results, 'm');
    assert.match(out, /eval call timeout/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/chat/__evals__/reporter.test.ts`
Expected: FAIL — `Cannot find module './reporter'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/chat/__evals__/reporter.ts
import type { EvalFixture } from './fixtures/types';

export type EvalRunResult = {
  fixture: EvalFixture;
  actualTool: string | null;
  passed: boolean;
  durationMs: number;
  error?: string;
};

export function formatReport(results: EvalRunResult[], modelName: string): string {
  const lines: string[] = [];
  lines.push(`MYLO Routing Eval — model=${modelName}`);
  lines.push('');

  for (const r of results) {
    const mark = r.passed ? '✓' : '✗';
    const expected = r.fixture.expectedTool ?? 'null';
    const actual = r.actualTool ?? 'null';
    lines.push(
      `${mark} ${r.fixture.id.padEnd(36)} expected=${expected.padEnd(24)} actual=${actual}` +
        (r.passed ? '' : '          ← FAIL'),
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const pct = total === 0 ? '0.0' : ((passed / total) * 100).toFixed(1);
  lines.push('');
  lines.push(`${passed}/${total} passed (${pct}%)  •  duration ${(totalMs / 1000).toFixed(1)}s`);

  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push('');
    lines.push('Failures:');
    for (const f of failures) {
      lines.push(`  ${f.fixture.id}`);
      lines.push(`    User: "${f.fixture.userQuery}"`);
      lines.push(`    Expected: ${f.fixture.expectedTool ?? 'null'}`);
      lines.push(`    Actual:   ${f.actualTool ?? 'null'}`);
      lines.push(`    Reason:   ${f.fixture.reason}`);
      if (f.error) lines.push(`    Error:    ${f.error}`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/chat/__evals__/reporter.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chat/__evals__/reporter.ts lib/chat/__evals__/reporter.test.ts
git commit -m "feat(evals): formatReport renderer with PASS/FAIL table"
```

---

## Phase 4: Edge Case Fixtures + Runner Assembly

### Task 6: Edge case fixtures (data only, no tests — data IS the test)

**Files:**
- Create: `lib/chat/__evals__/fixtures/edge-cases.ts`

- [ ] **Step 1: Write the fixtures**

```typescript
// lib/chat/__evals__/fixtures/edge-cases.ts
import type { EvalFixture } from './types';

const FIXED_NOW = new Date('2026-04-27T10:00:00.000Z');

export const edgeCases: EvalFixture[] = [
  {
    id: 'edge-001-past-date',
    source: 'edge',
    description: 'Past-date flight query — routing must still pick search_flights',
    userQuery: 'Flüge von Frankfurt nach Phuket am 15.03.2024 in Business',
    expectedTool: 'search_flights',
    reason:
      'Past-date validation lives at the tool layer, not the router. The system prompt explicitly routes any flight keyword to search_flights regardless of date validity.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-002-kb-general-travel',
    source: 'edge',
    description: 'General informational travel query → KB-First mandate',
    userQuery: 'Wann ist beste Reisezeit für Bali?',
    expectedTool: 'knowledge_base',
    reason:
      'KB-First applies to ANY informational/factual query without explicit booking intent. Bali timing is a general travel question.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-003-award-explicit-de',
    source: 'edge',
    description: 'DACH-German award/miles query MUST route to search_flights',
    userQuery: 'Wie viele Meilen brauche ich für Frankfurt-Tokyo Business?',
    expectedTool: 'search_flights',
    reason:
      'System prompt lists "Meilen", "Award", and route patterns as flight triggers. This must NOT fall back to web_search.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-004-loyalty-specific',
    source: 'edge',
    description: 'Provider-specific loyalty query → tool, not system context',
    userQuery: 'Wie viele Lufthansa-Meilen habe ich?',
    expectedTool: 'get_loyalty_balances',
    reason:
      'System prompt: specific provider details require the tool, system context only covers aggregates.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-005-loyalty-aggregate',
    source: 'edge',
    description: 'Aggregate loyalty query → answer from system context, NO tool',
    userQuery: 'Wie viele Punkte habe ich insgesamt?',
    expectedTool: null,
    reason:
      'System prompt explicitly says: aggregate questions are answered from the loyalty summary already injected into the system context. Calling get_loyalty_balances would be a routing failure.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-006-weather',
    source: 'edge',
    description: 'Direct weather query → weather tool, not KB or web',
    userQuery: 'Wie ist das Wetter in Bangkok?',
    expectedTool: 'get_weather_data',
    reason:
      'Weather has its own tool. KB-First does NOT apply when a domain-specific tool exists.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-007-mixed-language',
    source: 'edge',
    description: 'English location-near query → nearby_places_search, not web_search',
    userQuery: 'Show me hotels near Phuket Old Town',
    expectedTool: 'nearby_places_search',
    reason:
      'System prompt: "near <location>" triggers nearby_places_search. Language-mixing must not break routing.',
    now: FIXED_NOW,
  },
];
```

Note: tool name in production is `get_weather_data`, not `weather` (verified at `app/actions.ts:277`). The spec's draft used `weather` — corrected here.

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit lib/chat/__evals__/fixtures/edge-cases.ts`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/chat/__evals__/fixtures/edge-cases.ts
git commit -m "feat(evals): 7 hand-curated edge case fixtures"
```

---

### Task 7: Runner assembly

**Files:**
- Create: `lib/chat/__evals__/run.ts`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Write run.ts**

```typescript
// lib/chat/__evals__/run.ts
import { buildMyloWebSystemPrompt } from '@/lib/chat/mylo-system-prompt';
import { edgeCases } from './fixtures/edge-cases';
import { realChats } from './fixtures/real-chats';
import { buildMockToolRegistry } from './mock-tools';
import { extractFirstToolCall } from './tool-extractor';
import { getEvalModel, runRoutingCall } from './grok-client';
import { formatReport, type EvalRunResult } from './reporter';
import type { EvalFixture } from './fixtures/types';

async function main(): Promise<void> {
  if (!process.env.XAI_API_KEY) {
    console.error('ERROR: XAI_API_KEY env var is required.');
    console.error('Get a key from https://console.x.ai and run: XAI_API_KEY=xai-... pnpm eval');
    process.exit(2);
  }

  const fixtures: EvalFixture[] = [...realChats, ...edgeCases];
  const tools = buildMockToolRegistry();
  const model = getEvalModel();
  const modelName = process.env.EVAL_MODEL ?? 'grok-4-1-fast-non-reasoning';

  const results: EvalRunResult[] = [];

  for (const fx of fixtures) {
    const system = buildMyloWebSystemPrompt({ now: fx.now });
    try {
      const r = await runRoutingCall({
        model,
        system,
        userQuery: fx.userQuery,
        tools,
      });
      const actualTool = extractFirstToolCall(r);
      results.push({
        fixture: fx,
        actualTool,
        passed: actualTool === fx.expectedTool,
        durationMs: r.durationMs,
      });
    } catch (err) {
      results.push({
        fixture: fx,
        actualTool: null,
        passed: false,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(formatReport(results, modelName));
  process.exit(results.every((r) => r.passed) ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Create empty real-chats.ts placeholder**

`run.ts` imports `./fixtures/real-chats`. We need the file to exist even before Phase 7 populates it.

```typescript
// lib/chat/__evals__/fixtures/real-chats.ts
import type { EvalFixture } from './types';

// Populated via `pnpm eval:extract-real` (see lib/chat/__evals__/extract-real-chats.ts).
// Until then, edge-cases provide the routing coverage.
export const realChats: EvalFixture[] = [];
```

- [ ] **Step 3: Add scripts to package.json**

Modify `package.json` scripts block. Insert these two lines, keeping all existing entries intact:

```json
"eval": "tsx lib/chat/__evals__/run.ts",
"eval:extract-real": "tsx lib/chat/__evals__/extract-real-chats.ts"
```

After the change, the scripts block should look like:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint",
  "fix": "prettier --write .",
  "knip": "knip",
  "test": "tsx --test \"lib/**/*.test.ts\"",
  "test:unit": "tsx --test \"lib/api/*.test.ts\" \"lib/db/**/*.test.ts\"",
  "test:integration": "tsx --test \"lib/tools/*.integration.test.ts\"",
  "test:watch": "tsx --test --watch \"lib/**/*.test.ts\"",
  "eval": "tsx lib/chat/__evals__/run.ts",
  "eval:extract-real": "tsx lib/chat/__evals__/extract-real-chats.ts"
},
```

- [ ] **Step 4: Verify type-checks**

Run: `npx tsc --noEmit lib/chat/__evals__/run.ts`
Expected: no output.

- [ ] **Step 5: Verify the script resolves but stops cleanly without API key**

Run: `unset XAI_API_KEY && pnpm eval`
Expected: stderr `ERROR: XAI_API_KEY env var is required.`, exit code 2.

- [ ] **Step 6: Commit**

```bash
git add lib/chat/__evals__/run.ts lib/chat/__evals__/fixtures/real-chats.ts package.json
git commit -m "feat(evals): runner entrypoint + pnpm eval/eval:extract-real scripts"
```

---

## Phase 5: Local Sanity Run

### Task 8: First live eval run with edge cases

**Goal:** Confirm the runner works end-to-end before adding real chats and CI.

- [ ] **Step 1: Set the API key locally**

Pascal sets `XAI_API_KEY` from the xAI console (https://console.x.ai). Either export in the current shell or write to `.env.local` (gitignored — confirm):

```bash
export XAI_API_KEY=xai-...
```

- [ ] **Step 2: Run the eval**

```bash
pnpm eval
```

Expected: 7 fixtures execute (real-chats is still empty), report printed. Most or all should pass on Grok-4.1-fast.

- [ ] **Step 3: Triage failures**

If any edge case fails:
- **Real prompt issue:** the system prompt fails to route this query. Open a separate ticket — DO NOT lower the bar to make the eval pass. The eval is doing its job.
- **Bad fixture:** the expected tool was wrong. Update `edge-cases.ts` with corrected `expectedTool` and `reason`. Commit as `fix(evals): correct expected tool for edge-XXX`.
- **Tool-name typo:** verify against `app/actions.ts:273-291` and `lib/chat/__evals__/mock-tools.ts:WEB_GROUP_TOOL_NAMES`. Fix and re-run.

- [ ] **Step 4: Re-run until all 7 edge cases pass (or are intentionally documented as known prompt issues)**

If a fixture is a true prompt-bug that won't be fixed in this PR, comment it out in `edge-cases.ts` with a `// TODO: tracked in <issue>` — but don't ship the eval with hidden failures. Better: revert the fixture if it's premature.

- [ ] **Step 5: Commit only if fixtures changed**

```bash
git add lib/chat/__evals__/fixtures/edge-cases.ts
git commit -m "fix(evals): corrected fixture for edge-XXX after live run"
```

If nothing changed, skip the commit.

---

## Phase 6: Real-Cases Extraction Script

### Task 9a: Anonymization helpers (TDD-able)

**Files:**
- Create: `lib/chat/__evals__/anonymize.ts`
- Create: `lib/chat/__evals__/anonymize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/chat/__evals__/anonymize.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { anonymizeUserQuery, scanForPii } from './anonymize';

describe('anonymizeUserQuery', () => {
  it('replaces emails with placeholder', () => {
    const out = anonymizeUserQuery('Buch mir was an pascal@example.com');
    assert.strictEqual(out, 'Buch mir was an user@example.com');
  });

  it('replaces E.164 phone numbers', () => {
    const out = anonymizeUserQuery('Ruf mich an unter +49 171 1234567');
    assert.match(out, /\+49 xxx xxx xxxx/);
  });

  it('replaces 8+ digit numbers (loyalty IDs)', () => {
    const out = anonymizeUserQuery('Mein Vielflieger ist 992812345');
    assert.match(out, /XXXXXXXX/);
    assert.doesNotMatch(out, /992812345/);
  });

  it('keeps short numeric content like dates and prices', () => {
    const out = anonymizeUserQuery('Flug am 15.03.2026 für 450 EUR');
    assert.strictEqual(out, 'Flug am 15.03.2026 für 450 EUR');
  });

  it('replaces a known user first name when provided', () => {
    const out = anonymizeUserQuery('Hallo, hier ist Pascal', { userName: 'Pascal' });
    assert.match(out, /\[Name\]/);
    assert.doesNotMatch(out, /Pascal/);
  });
});

describe('scanForPii', () => {
  it('flags emails', () => {
    assert.deepStrictEqual(
      scanForPii('contact me at user@example.com'),
      ['email-pattern'],
    );
  });

  it('flags long digit runs', () => {
    assert.deepStrictEqual(scanForPii('id 123456789'), ['long-digit-run']);
  });

  it('returns empty for clean text', () => {
    assert.deepStrictEqual(scanForPii('Flüge nach Bangkok'), []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/chat/__evals__/anonymize.test.ts`
Expected: FAIL — `Cannot find module './anonymize'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/chat/__evals__/anonymize.ts
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}/g;
const LONG_DIGIT_RE = /\b\d{8,}\b/g;

export function anonymizeUserQuery(
  input: string,
  opts: { userName?: string } = {},
): string {
  let out = input;
  out = out.replace(EMAIL_RE, 'user@example.com');
  out = out.replace(PHONE_RE, '+49 xxx xxx xxxx');
  out = out.replace(LONG_DIGIT_RE, 'XXXXXXXX');
  if (opts.userName) {
    const escaped = opts.userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '[Name]');
  }
  return out;
}

export function scanForPii(text: string): string[] {
  const issues: string[] = [];
  if (EMAIL_RE.test(text)) issues.push('email-pattern');
  if (PHONE_RE.test(text)) issues.push('phone-pattern');
  if (LONG_DIGIT_RE.test(text)) issues.push('long-digit-run');
  // Reset regex lastIndex (global flag) so consecutive calls don't lie
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  LONG_DIGIT_RE.lastIndex = 0;
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/chat/__evals__/anonymize.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chat/__evals__/anonymize.ts lib/chat/__evals__/anonymize.test.ts
git commit -m "feat(evals): anonymize and PII scan helpers"
```

---

### Task 9b: Extraction script

**Files:**
- Create: `lib/chat/__evals__/extract-real-chats.ts`

This is a **one-off interactive script**. We don't unit-test it — its value is the manual selection step Pascal performs at runtime.

- [ ] **Step 1: Write the script**

```typescript
// lib/chat/__evals__/extract-real-chats.ts
import { dbUncached } from '@/lib/db';
import { chat, message, toolCalls, user } from '@/lib/db/schema';
import { and, eq, gte, inArray, sql, desc } from 'drizzle-orm';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { anonymizeUserQuery, scanForPii } from './anonymize';
import { WEB_GROUP_TOOL_NAMES } from './mock-tools';

const LOOKBACK_DAYS = 14;
const CANDIDATE_LIMIT = 30;
const TARGET_COUNT = 5;

type Candidate = {
  idx: number;
  chatId: string;
  userId: string;
  userName: string | null;
  userQuery: string;
  toolName: string;
  createdAt: Date;
};

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  for (const p of parts) {
    if (
      p &&
      typeof p === 'object' &&
      'type' in p &&
      (p as { type: string }).type === 'text' &&
      'text' in p
    ) {
      return String((p as { text: unknown }).text ?? '');
    }
  }
  return '';
}

async function fetchCandidates(): Promise<Candidate[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const rows = await dbUncached
    .select({
      chatId: chat.id,
      userId: chat.userId,
      userName: user.name,
      parts: message.parts,
      messageCreatedAt: message.createdAt,
      toolName: toolCalls.toolName,
      toolCreatedAt: toolCalls.createdAt,
    })
    .from(toolCalls)
    .innerJoin(chat, eq(chat.id, toolCalls.chatId))
    .innerJoin(
      message,
      and(
        eq(message.chatId, chat.id),
        eq(message.role, 'user'),
        sql`${toolCalls.createdAt} between ${message.createdAt} and ${message.createdAt} + interval '2 minutes'`,
      ),
    )
    .innerJoin(user, eq(user.id, chat.userId))
    .where(
      and(
        eq(toolCalls.status, 'succeeded'),
        inArray(toolCalls.toolName, [...WEB_GROUP_TOOL_NAMES]),
        gte(message.createdAt, since),
      ),
    )
    .orderBy(desc(toolCalls.createdAt))
    .limit(CANDIDATE_LIMIT);

  return rows.map((r, idx) => ({
    idx: idx + 1,
    chatId: r.chatId,
    userId: r.userId,
    userName: r.userName,
    userQuery: extractTextFromParts(r.parts),
    toolName: r.toolName,
    createdAt: r.toolCreatedAt,
  }));
}

function printCandidates(cands: Candidate[]): void {
  console.log('idx | tool                  | userQuery (truncated)');
  console.log('----+----------------------+------------------------------------------------');
  for (const c of cands) {
    const q = c.userQuery.replace(/\s+/g, ' ').slice(0, 60).padEnd(60);
    console.log(`${String(c.idx).padStart(3)} | ${c.toolName.padEnd(20)} | ${q}`);
  }
}

async function promptSelection(): Promise<number[]> {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = await rl.question(
    `\nSelect ${TARGET_COUNT} indices (comma-separated, e.g. 1,4,7,12,19): `,
  );
  rl.close();
  const ids = ans
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (ids.length !== TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} indices, got ${ids.length}`);
  }
  return ids;
}

function fixtureFromCandidate(c: Candidate, n: number): string {
  const anon = anonymizeUserQuery(c.userQuery, { userName: c.userName ?? undefined });
  const id = `real-${String(n).padStart(3, '0')}`;
  return `  {
    id: '${id}',
    source: 'real',
    description: 'Extracted from production chat ${c.chatId.slice(0, 8)} on ${c.createdAt.toISOString().slice(0, 10)}',
    userQuery: ${JSON.stringify(anon)},
    expectedTool: '${c.toolName}',
    reason: 'Production: this user query routed to ${c.toolName} successfully. Eval captures that behavior as the regression baseline.',
  },`;
}

async function main(): Promise<void> {
  console.log(`Fetching candidates from production Neon (last ${LOOKBACK_DAYS} days)...`);
  const cands = await fetchCandidates();
  if (cands.length < TARGET_COUNT) {
    throw new Error(`Only ${cands.length} candidates found, need ${TARGET_COUNT}`);
  }
  printCandidates(cands);
  const selectedIdx = await promptSelection();
  const selected = cands.filter((c) => selectedIdx.includes(c.idx));

  // Build fixture file
  const entries = selected.map((c, i) => fixtureFromCandidate(c, i + 1)).join('\n');
  const file =
    `// lib/chat/__evals__/fixtures/real-chats.ts\n` +
    `// Generated by extract-real-chats.ts on ${new Date().toISOString()}\n` +
    `// Anonymized — please review before committing.\n` +
    `import type { EvalFixture } from './types';\n\n` +
    `export const realChats: EvalFixture[] = [\n${entries}\n];\n`;

  // PII safety check
  for (const c of selected) {
    const anon = anonymizeUserQuery(c.userQuery, { userName: c.userName ?? undefined });
    const issues = scanForPii(anon);
    if (issues.length > 0) {
      console.error(`PII WARNING for chat ${c.chatId}: ${issues.join(', ')}`);
      console.error(`  Anonymized text: ${anon}`);
      console.error('Aborting. Review and improve anonymize.ts before re-running.');
      process.exit(3);
    }
  }

  await writeFile('lib/chat/__evals__/fixtures/real-chats.ts', file, 'utf8');
  console.log(`\nWrote ${selected.length} fixtures to lib/chat/__evals__/fixtures/real-chats.ts`);
  console.log('REVIEW THE FILE before committing.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit lib/chat/__evals__/extract-real-chats.ts`
Expected: no output. If `user` schema export name differs from `lib/db/schema.ts:export const user = pgTable('user', ...)`, fix the import.

- [ ] **Step 3: Commit**

```bash
git add lib/chat/__evals__/extract-real-chats.ts
git commit -m "feat(evals): one-off real-chats extraction script (manual selection workflow)"
```

---

## Phase 7: Real Cases Fixture

### Task 10: Pascal extracts and commits 5 real cases

This task is **operator-driven** — Claude does not run it autonomously. Pascal performs these steps with eyes-on-screen.

- [ ] **Step 1: Run extraction**

```bash
pnpm eval:extract-real
```

Pascal:
- Reviews the printed candidate table
- Picks 5 indices that maximize routing diversity (e.g., 1× search_flights, 1× knowledge_base, 1× get_weather_data, 1× get_loyalty_balances, 1× nearby_places_search). The exact mix depends on what's in the candidate set.
- Enters `1,4,7,12,19` (or similar) when prompted
- Script writes `lib/chat/__evals__/fixtures/real-chats.ts`

- [ ] **Step 2: Manually review the generated file**

Pascal opens `lib/chat/__evals__/fixtures/real-chats.ts` and visually scans for any PII the regex didn't catch (rare names, location-specific giveaways, etc.). Edit by hand if needed.

- [ ] **Step 3: Run eval against real cases**

```bash
XAI_API_KEY=xai-... pnpm eval
```

Expected: 12/12 pass. If real cases fail, that's not necessarily a bug — it might mean Grok-4.1 made a routing decision that happens to differ from production. Fix the fixture's `expectedTool` to match production's actual call (which is the ground truth) only if production was correct. If production routed wrong, write a separate ticket.

- [ ] **Step 4: Commit fixtures**

```bash
git add lib/chat/__evals__/fixtures/real-chats.ts
git commit -m "feat(evals): 5 anonymized real chats from Neon production"
```

---

### Task 11: PII scan unit-test on real-chats.ts

**Files:**
- Create: `lib/chat/__evals__/fixtures/pii-scan.test.ts`

This protects against accidental PII regression if `extract-real-chats.ts` is re-run later.

- [ ] **Step 1: Write the test**

```typescript
// lib/chat/__evals__/fixtures/pii-scan.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { scanForPii } from '../anonymize';
import { realChats } from './real-chats';

describe('real-chats PII guard', () => {
  for (const fx of realChats) {
    it(`fixture ${fx.id} contains no PII patterns`, () => {
      const issues = scanForPii(fx.userQuery);
      assert.deepStrictEqual(
        issues,
        [],
        `${fx.id} userQuery contains PII: ${issues.join(', ')} → "${fx.userQuery}"`,
      );
    });
  }

  it('has the expected count of fixtures', () => {
    assert.ok(
      realChats.length === 0 || realChats.length === 5,
      'real-chats.ts should be empty (pre-extraction) or have exactly 5 fixtures',
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx tsx --test lib/chat/__evals__/fixtures/pii-scan.test.ts`
Expected: All checks pass.

- [ ] **Step 3: Commit**

```bash
git add lib/chat/__evals__/fixtures/pii-scan.test.ts
git commit -m "test(evals): PII scan guard for real-chats fixtures"
```

---

## Phase 8: CI Workflow + README

### Task 12: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/eval.yml`

- [ ] **Step 1: Verify the workflows folder**

Run: `ls .github/workflows/ 2>/dev/null || echo "missing"`
If missing: `mkdir -p .github/workflows`.

- [ ] **Step 2: Write the workflow**

```yaml
# .github/workflows/eval.yml
name: MYLO Routing Eval
on:
  pull_request:
    paths:
      - 'lib/chat/mylo-system-prompt.ts'
      - 'lib/tools/**'
      - 'lib/chat/__evals__/**'
      - 'app/actions.ts'
      - '.github/workflows/eval.yml'

jobs:
  eval:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run MYLO routing eval
        run: pnpm eval
        env:
          XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
          EVAL_MODEL: grok-4-1-fast-non-reasoning
```

- [ ] **Step 3: Pascal adds the secret to GitHub**

In GitHub UI: Repo → Settings → Secrets and variables → Actions → New repository secret.
Name: `XAI_API_KEY`. Value: the xAI API key.

(This step is operator-only; Claude can't perform it. Document in README.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/eval.yml
git commit -m "ci(evals): MYLO routing eval workflow with path-filter"
```

---

### Task 13: README

**Files:**
- Create: `lib/chat/__evals__/README.md`

- [ ] **Step 1: Write the README**

````markdown
# MYLO Routing Eval Suite

LLM-based routing eval that runs the production MYLO web system prompt against a fixed set of user queries and asserts that xAI Grok routes each query to the expected first tool.

## When this runs

Pre-merge in GitHub Actions on PRs that touch:
- `lib/chat/mylo-system-prompt.ts`
- `lib/tools/**`
- `lib/chat/__evals__/**`
- `app/actions.ts`

PRs that don't touch these paths skip the eval — no API cost.

## Run locally

```bash
export XAI_API_KEY=xai-...
pnpm eval
```

Optionally pin a different model (e.g. for the Grok 4.1 → 4.20 upgrade comparison):

```bash
EVAL_MODEL=grok-4.20-0309-non-reasoning pnpm eval
```

## Fixtures

12 total in `fixtures/`:
- `edge-cases.ts` — 7 hand-curated cases covering known routing decisions (past dates, KB-First, award queries, loyalty aggregate, weather, mixed language)
- `real-chats.ts` — 5 anonymized real chats from Neon production, regenerated via `pnpm eval:extract-real`

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

`expectedTool: null` is a valid case: certain queries (e.g. "Wie viele Punkte habe ich insgesamt?") are answered from the system context without any tool call.

## Refreshing real chats

```bash
export DATABASE_URL=postgres://... # production Neon
pnpm eval:extract-real
```

The script:
1. Pulls last 14 days of successful tool calls from production
2. Prints up to 30 candidates
3. Asks you to pick 5 indices
4. Anonymizes (emails, phone numbers, long digit runs, user first names)
5. Writes `fixtures/real-chats.ts`

**Always review the generated file by hand before committing.** The `pii-scan.test.ts` guards the most common patterns but is not a substitute for a human read.

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
- **Real prompt regression** — your PR weakened the prompt's routing. Fix the prompt.
- **Bad fixture** — the `expectedTool` was wrong. Update the fixture.
- **Tool name typo** — verify against `app/actions.ts:273-291` and `mock-tools.ts:WEB_GROUP_TOOL_NAMES`.

## Setup checklist (one-time)

- [ ] Add `XAI_API_KEY` to GitHub repo secrets
- [ ] Run `pnpm eval:extract-real` to populate real fixtures
- [ ] First PR that touches the prompt confirms CI catches a deliberate regression (sanity check)

## Why this matters

The MYLO web system prompt is ~370 lines of routing instructions. Static string-match tests in `lib/chat/mylo-system-prompt.test.ts` cover the prompt content. This eval covers the LLM behavior given that prompt — the routing actually working in practice. Both layers are needed; one is not a substitute for the other.
````

- [ ] **Step 2: Commit**

```bash
git add lib/chat/__evals__/README.md
git commit -m "docs(evals): README with usage, refresh workflow, and triage guide"
```

---

## Final Verification

- [ ] **Step 1: Full sanity run**

```bash
pnpm test                    # All unit tests including evals helpers — should pass
XAI_API_KEY=xai-... pnpm eval  # All 12 fixtures (after Phase 7) — should pass
```

- [ ] **Step 2: Review the diff**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Expected commits (in order):
1. `feat(evals): add EvalFixture type`
2. `feat(evals): mock tool registry mirroring web group production schemas`
3. `feat(evals): extractFirstToolCall helper`
4. `feat(evals): grok client wrapper with retry+timeout`
5. `feat(evals): formatReport renderer with PASS/FAIL table`
6. `feat(evals): 7 hand-curated edge case fixtures`
7. `feat(evals): runner entrypoint + pnpm eval/eval:extract-real scripts`
8. (Optional) `fix(evals): corrected fixture for edge-XXX after live run`
9. `feat(evals): anonymize and PII scan helpers`
10. `feat(evals): one-off real-chats extraction script`
11. `feat(evals): 5 anonymized real chats from Neon production`
12. `test(evals): PII scan guard for real-chats fixtures`
13. `ci(evals): MYLO routing eval workflow with path-filter`
14. `docs(evals): README with usage, refresh workflow, and triage guide`

- [ ] **Step 3: Codex pre-push review (matches Pascal's working pattern)**

```bash
codex review --branch
```

Address any P1 findings. Re-commit if changes were needed.

- [ ] **Step 4: Push**

```bash
git push origin feature/flightdeals-apify
```

The first push to a PR that touches eval-paths will trigger the CI eval. Confirm it runs and passes.

---

## Follow-Up Lanes (NOT in this plan)

These are intentionally separate work items, tracked elsewhere:

1. **Grok 4.1 → 4.20 production upgrade.** After this eval is green and stable, run `EVAL_MODEL=grok-4.20-0309-non-reasoning pnpm eval` locally. If 12/12 pass, open a separate PR that switches `lib/xai/`, `lib/tools/extreme-search.ts`, and `app/actions.ts` from 4.1-fast to 4.20-non-reasoning. Production switch is NOT part of this eval-suite plan.
2. **Eval coverage for other groups.** `extreme`, `voice`, `flights`, `chat` groups have their own prompts. Each gets a parallel eval if/when needed.
3. **Multi-turn conversation evals.** This plan covers single-turn routing only. If multi-turn becomes a regression risk, a separate eval framework will be needed.

---

## Self-Review Notes

After writing the plan, I checked it against the spec:

- ✅ All 7 spec sections (architecture, EvalFixture type, real-cases extraction, edge cases, mock tools, reporter, failure handling, CI integration) have corresponding tasks.
- ✅ Tool list cross-checked against `app/actions.ts:273-291` — corrected `weather` → `get_weather_data` in the spec's edge-006 example.
- ✅ TypeScript imports use the actual production tool export names (`flightSearchTool`, `webSearchTool` factory, `greetingTool` factory, etc.) — verified via grep.
- ✅ `realChats: EvalFixture[] = []` placeholder added in Task 7 so the runner type-checks before Phase 7 populates the file.
- ✅ Pascal-driven steps are clearly marked (Phase 5 sanity run, Phase 7 extraction, GitHub secret config) with no expectation that an automated executor performs them.
- ✅ Each task ends with a commit. Frequent commits aligned with Pascal's working pattern.
