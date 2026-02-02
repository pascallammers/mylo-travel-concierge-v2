---
phase: 01-llm-airport-resolution
plan: 01
subsystem: api
tags: [xai, grok, llm, zod, structured-output, airport-codes, natural-language]

# Dependency graph
requires:
  - phase: project-init
    provides: Base Next.js structure, Vercel AI SDK, xAI provider configuration
provides:
  - LLM-based airport code extraction from natural language
  - Three-tier resolution strategy (direct codes, static mapping, LLM)
  - Disambiguation handling for ambiguous cities
  - Confidence levels for extraction quality assessment
affects: [02-alternative-airports, flight-search-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LLM structured output with Zod schemas using experimental_output
    - Tiered fallback strategy for performance optimization
    - Flat schema design to avoid TypeScript deep recursion issues

key-files:
  created:
    - lib/utils/llm-airport-resolver.ts
  modified:
    - lib/utils/airport-codes.ts

key-decisions:
  - "Use flattened Zod schema to avoid TypeScript TS2589 deep recursion error"
  - "Use languageModel from providers.ts instead of direct xAI client for consistency"
  - "Implement three-tier resolution to minimize LLM calls"
  - "Use ts-ignore for Output.object() due to known AI SDK + Zod type issue"

patterns-established:
  - "LLM extraction pattern: Output.object with Zod schema for structured data"
  - "Tiered resolution: fast paths first (direct codes, static), expensive LLM last"
  - "Confidence-based clarification: low confidence triggers user interaction"

# Metrics
duration: 9min
completed: 2026-02-02
---

# Phase 01 Plan 01: LLM Airport Resolution Summary

**Natural language airport extraction with xAI/Grok using structured outputs, three-tier fallback strategy, and contextual disambiguation for ambiguous cities like Liberia and San Jose**

## Performance

- **Duration:** 9 minutes
- **Started:** 2026-02-02T08:53:37Z
- **Completed:** 2026-02-02T09:02:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created LLM-based airport code extractor using xAI/Grok with structured outputs
- Implemented three-tier resolution strategy: direct IATA codes → static mapping → LLM extraction
- Built disambiguation logic for "liberia + costa rica" → LIR and "san jose + costa rica" → SJO
- Added confidence levels (high/medium/low/none) to enable user clarification flows
- Maintained backward compatibility - existing sync functions unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LLM airport resolver module** - `a308dbc` (feat)
   - extractAirportCodes function with Zod schema
   - xAI/Grok integration via languageModel
   - Disambiguation prompt with examples
   - Error handling for NoOutputGeneratedError

2. **Task 2: Add LLM-backed resolution to airport-codes.ts** - `6bc0a6f` (feat)
   - resolveAirportCodesWithLLM async function
   - Helper functions: tryDirectCodeExtraction, tryStaticMapping
   - AirportResolutionResult type with clarification support
   - Converter from flat LLM schema to structured result

## Files Created/Modified

- `lib/utils/llm-airport-resolver.ts` - LLM extraction with structured outputs using Zod schema, handles disambiguation and confidence levels
- `lib/utils/airport-codes.ts` - Added async LLM-backed resolution with three-tier fallback, maintains existing sync functions

## Decisions Made

**1. Flattened Zod schema to avoid TypeScript recursion error**
- **Issue:** Nested AirportSchema caused TS2589 "Type instantiation is excessively deep"
- **Decision:** Flattened to originCode, originName, etc. instead of nested objects
- **Rationale:** TypeScript has known issues with deeply nested Zod schemas in AI SDK types
- **Trade-off:** Less elegant schema, but compiles and works correctly

**2. Use languageModel from providers.ts instead of direct xAI client**
- **Decision:** Import languageModel from ../../ai/providers instead of createXai
- **Rationale:** Consistency with existing codebase patterns (text-translate.ts, extreme-search.ts)
- **Benefit:** Respects USE_XAI environment flag, easier to switch providers if needed

**3. Three-tier resolution strategy**
- **Decision:** Check direct codes first, then static mapping, finally LLM
- **Rationale:** Performance optimization - avoid LLM call when simple pattern matching works
- **Example:** "FRA to LIR" hits Tier 1 in <1ms, "frankfurt liberia" needs LLM

**4. ts-ignore for Output.object due to AI SDK type issue**
- **Issue:** Output.object() triggers TypeScript recursion even with flat schema
- **Decision:** Added ts-ignore comment with explanation
- **Rationale:** Known issue in AI SDK 5.x with Zod type inference, runtime works correctly
- **Note:** Other files in codebase use same pattern (extreme-search.ts, text-translate.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript deep recursion error**
- **Found during:** Task 1 (LLM airport resolver creation)
- **Issue:** Nested Zod schema with AirportSchema.nullable() caused TS2589 compilation error
- **Fix:** Flattened schema to simple string fields (originCode, originName, etc.) instead of nested objects
- **Files modified:** lib/utils/llm-airport-resolver.ts
- **Verification:** npx tsc --noEmit passes without errors
- **Committed in:** a308dbc (Task 1 commit)

**2. [Rule 3 - Blocking] Added ts-ignore for AI SDK type issue**
- **Found during:** Task 1 (generateText with Output.object)
- **Issue:** Output.object() triggers TypeScript recursion limit even with simplified schema
- **Fix:** Added ts-ignore comments with explanation, cast result to AirportExtractionResult
- **Files modified:** lib/utils/llm-airport-resolver.ts
- **Verification:** Compilation succeeds, pattern matches existing codebase usage
- **Committed in:** a308dbc (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope changes, schema still provides structured output as intended.

## Issues Encountered

**TypeScript TS2589 with nested Zod schemas**
- **Problem:** AI SDK's type inference for Output.object() has deep recursion issues with nested Zod objects
- **Resolution:** Flattened schema and added ts-ignore (matches existing codebase pattern)
- **Learning:** For AI SDK structured outputs, keep Zod schemas flat to avoid TypeScript type system limits

## User Setup Required

None - no external service configuration required. Uses existing XAI_API_KEY environment variable already configured in providers.ts.

## Next Phase Readiness

**Ready for:**
- Phase 01 Plan 02: Alternative airports and flexible date search
- Integration with flight-search.ts tool

**Provides:**
- `extractAirportCodes(query)` - Core LLM extraction function
- `resolveAirportCodesWithLLM(query)` - High-level resolution with fallback
- `AirportResolutionResult` type - Structured result with confidence and clarification fields

**Notes:**
- All disambiguation examples from RESEARCH.md implemented (liberia/costa rica, san jose)
- Confidence levels enable future UI flows for ambiguous queries
- Existing static AIRPORT_CODES still used as Tier 2 for performance

---
*Phase: 01-llm-airport-resolution*
*Completed: 2026-02-02*
