# Task Group 3: Chat System Integration

We're continuing the Knowledge Base RAG System implementation with task group 3:

## Implement this task group and all sub-tasks:

### Task 3.1: Implement Intent Detection Logic

**Priority**: High  
**Effort**: 4 hours  
**Dependencies**: None (can start in parallel with Group 1)

**Description**: Create an intent detector that classifies user queries as transactional (flight searches, bookings) or informational (travel tips, destination info).

**Files to Create**:
- `/lib/utils/intent-detector.ts`

**Acceptance Criteria**:
- [ ] Export `QueryIntent` type: 'transactional' | 'informational' | 'ambiguous'
- [ ] Export `IntentResult` interface with intent, confidence, signals
- [ ] Implement `detectIntent(query: string): IntentResult` function
- [ ] TRANSACTIONAL patterns: flight keywords + dates, booking requests, price queries
- [ ] INFORMATIONAL patterns: tips/advice, best time questions, destination info
- [ ] Support both English and German patterns (per existing codebase)
- [ ] Return confidence score (0-1) based on pattern matches
- [ ] Return signals array for debugging/logging
- [ ] File stays under 600 lines per AGENTS.md
- [ ] Unit tests achieve >85% accuracy on test cases

**Example Patterns**:
```typescript
const TRANSACTIONAL_PATTERNS = [
  /\b(fl[uü]g|flight|fliegen|fly)\b.*\b\d{1,2}[\./]\d{1,2}/i,
  /\b(buchen|book|reserv|bestell)\b/i,
];
```

---

### Task 3.2: Enhance Knowledge Base Query Function

**Priority**: High  
**Effort**: 3 hours  
**Dependencies**: Task 1.3

**Description**: Enhance the existing KB query function to support confidence thresholds and better status reporting.

**Files to Modify**:
- `/lib/tools/knowledge-base-query.ts`

**Acceptance Criteria**:
- [ ] Add `confidenceThreshold` option (default 0.70)
- [ ] Add confidence scoring to response
- [ ] Add 'low_confidence' status when below threshold
- [ ] Integrate with database to get active documents
- [ ] Return structured result with confidence metrics
- [ ] Signal for fallback behavior (__KB_LOW_CONFIDENCE__, __KB_NOT_FOUND__)
- [ ] Maintain backward compatibility with existing callers
- [ ] JSDoc documentation for all public interfaces

---

### Task 3.3: Update Knowledge Base Tool

**Priority**: High  
**Effort**: 2-3 hours  
**Dependencies**: Task 3.1, Task 3.2

**Description**: Enhance the KB tool to integrate intent detection and improved response handling.

**Files to Modify**:
- `/lib/tools/knowledge-base.ts`

**Acceptance Criteria**:
- [ ] Enhanced tool description with clear use/skip guidance
- [ ] Integrate `detectIntent` for query classification
- [ ] Skip KB search for clearly transactional queries
- [ ] Use enhanced query function with confidence threshold
- [ ] Return signals for fallback: __KB_LOW_CONFIDENCE__, __KB_NOT_FOUND__
- [ ] Clean answer format (no "[Knowledge Base]" prefix for seamless integration)
- [ ] Proper error handling returning __KB_ERROR__
- [ ] Configurable confidence threshold via environment/config

---

### Task 3.4: Update Chat System Prompts

**Priority**: Medium  
**Effort**: 2 hours  
**Dependencies**: Task 3.3

**Description**: Update the system prompts in actions.ts to provide better guidance on KB tool usage and fallback behavior.

**Files to Modify**:
- `/app/actions.ts` (groupInstructions.web section)

**Acceptance Criteria**:
- [ ] Add explicit guidance on when to skip KB (transactional queries)
- [ ] Add explicit guidance on when to use KB (informational queries)
- [ ] Document intent signals for skipping KB
- [ ] Document fallback behavior for low confidence/not found
- [ ] Keep existing 2-tool limit for KB→web_search fallback
- [ ] Update instructions to match new tool behavior
- [ ] Ensure seamless answer integration (no explicit source citations)

---

## Understand the context

Read these files to understand the full context:
- `@documentation/features/knowledge-base-rag.md` - Full spec (Section 6)
- `@lib/tools/knowledge-base.ts` - Existing KB tool
- `@lib/tools/knowledge-base-query.ts` - Existing query function
- `@app/actions.ts` - Chat system prompts

## User Standards & Preferences Compliance

IMPORTANT: Ensure implementation aligns with these standards:

- `@droidz/standards/global/*` - All global standards
- `@droidz/standards/global/ai-tools.md` - AI tool standards
