# Implementation Plan: Automatic Memory Retrieval

**Date:** 2025-01-17  
**Task:** Backend Foundation - Memory Retrieval Service  
**Estimated Time:** Day 1-2 (4-6 hours)

---

## 🎯 Objectives

1. Create memory retrieval service with caching
2. Write comprehensive unit tests (90%+ coverage)
3. Integrate into API route for automatic retrieval
4. Verify performance targets (<500ms retrieval)

---

## 📋 Implementation Checklist

### Step 1: Create Service File Structure
**File:** `lib/services/memory-retrieval.ts` (~200 lines)

- [ ] Create file with TypeScript strict mode
- [ ] Define TypeScript interfaces:
  - [ ] `RetrievedMemory`
  - [ ] `MemoryRetrievalOptions`
  - [ ] `MemoryRetrievalResult`
- [ ] Initialize cache structure
- [ ] Import dependencies

**Dependencies:**
```typescript
import { searchMemories, MemoryItem } from '@/lib/memory-actions';
import { ChatMessage } from '@/lib/types';
```

---

### Step 2: Implement Cache System
**Function:** Cache infrastructure

- [ ] Create `memoryCache` Map with TTL structure
- [ ] Define `MEMORY_CACHE_TTL` constant (30 seconds)
- [ ] Implement cache key generation logic
- [ ] Add cache hit/miss logging

**Implementation:**
```typescript
const memoryCache = new Map<string, {
  result: MemoryRetrievalResult;
  timestamp: number;
  ttl: number;
}>();

const MEMORY_CACHE_TTL = 30 * 1000; // 30 seconds

function generateCacheKey(userId: string, message: string): string {
  return `${userId}:${message.substring(0, 100)}`;
}
```

---

### Step 3: Implement Query Extraction
**Function:** `extractSearchQuery(userMessage: string): string`

- [ ] Define filler words array
- [ ] Implement text normalization:
  - [ ] Convert to lowercase
  - [ ] Remove punctuation
  - [ ] Split into words
- [ ] Filter out filler words and short words (<3 chars)
- [ ] Take first 10 meaningful words
- [ ] Join and return optimized query

**Test Cases:**
```typescript
// Input: "What is the best way to learn TypeScript?"
// Output: "best way learn typescript"

// Input: "Can you remind me about my preferences?"
// Output: "remind preferences"

// Input: "" (empty)
// Output: ""
```

---

### Step 4: Implement Prompt Formatting
**Function:** `formatMemoriesForPrompt(memories: RetrievedMemory[]): string`

- [ ] Handle empty memories (return empty string)
- [ ] Create header section with emoji
- [ ] Format each memory:
  - [ ] Add memory index
  - [ ] Format saved date
  - [ ] Include content
- [ ] Add usage instructions for AI
- [ ] Return formatted string

**Output Format:**
```
## 🧠 Relevant User Memories

The following memories from the user's previous conversations are relevant:

[Memory 1] (Saved: Jan 15, 2025)
{content}

[Memory 2] (Saved: Jan 10, 2025)
{content}

**Instructions:**
- Use this context to personalize your response
- Reference these memories naturally when relevant
- Do NOT explicitly mention "based on your memories"
- Treat this information as if the user told you directly
```

---

### Step 5: Implement Main Retrieval Function
**Function:** `retrieveRelevantMemories(options: MemoryRetrievalOptions): Promise<MemoryRetrievalResult>`

**Subtasks:**
- [ ] Destructure options with defaults
- [ ] Start performance timer
- [ ] Check cache (if enabled):
  - [ ] Generate cache key
  - [ ] Check if cached result exists and is valid
  - [ ] Return cached result if found
- [ ] Extract search query from user message
- [ ] Call `searchMemories()` with try/catch
- [ ] Transform `MemoryItem[]` to `RetrievedMemory[]`:
  - [ ] Map fields
  - [ ] Extract metadata
  - [ ] Filter empty content
- [ ] Calculate retrieval time
- [ ] Create result object
- [ ] Cache result (if enabled)
- [ ] Log success with metrics
- [ ] Return result

**Error Handling:**
- [ ] Catch all errors in try/catch
- [ ] Log error details
- [ ] Return empty result (graceful degradation)
- [ ] Never throw errors

**Performance Logging:**
```typescript
console.log(`✅ [Memory] Retrieved ${memories.length} memories in ${retrievalTimeMs}ms`);
```

---

### Step 6: Write Unit Tests
**File:** `lib/services/memory-retrieval.test.ts` (~300 lines)

**Test Suite 1: `extractSearchQuery()`**
- [ ] Test filler word removal
- [ ] Test punctuation removal
- [ ] Test empty input handling
- [ ] Test long input truncation (>10 words)
- [ ] Test special characters
- [ ] Test mixed case normalization

**Test Suite 2: `formatMemoriesForPrompt()`**
- [ ] Test empty array returns empty string
- [ ] Test single memory formatting
- [ ] Test multiple memories formatting
- [ ] Test date formatting correctness
- [ ] Test memory index numbering
- [ ] Test instructions block inclusion

**Test Suite 3: `retrieveRelevantMemories()`**
- [ ] Test successful retrieval and formatting
- [ ] Test empty search results handling
- [ ] Test API error handling (graceful degradation)
- [ ] Test cache hit scenario
- [ ] Test cache miss scenario
- [ ] Test cache expiration
- [ ] Test maxResults parameter respected
- [ ] Test retrieval time tracking
- [ ] Test with malformed memory data
- [ ] Test with empty user message

**Mock Setup:**
```typescript
import { vi } from 'vitest';
import * as memoryActions from '@/lib/memory-actions';

beforeEach(() => {
  vi.clearAllMocks();
});

vi.spyOn(memoryActions, 'searchMemories').mockResolvedValue({
  memories: mockMemories,
  total: 1,
});
```

**Coverage Target:** 90%+ on all functions

---

### Step 7: Integrate into API Route
**File:** `app/api/search/route.ts` (+~80 lines)

**Subtasks:**

- [ ] **Import service:**
```typescript
import { 
  retrieveRelevantMemories, 
  formatMemoriesForPrompt 
} from '@/lib/services/memory-retrieval';
```

- [ ] **Add memory retrieval logic** (in `execute` function, after config/instructions fetch):
```typescript
let memoryContext = '';
let retrievedMemories: any = null;

if (user?.id) {
  const memoryRetrievalStartTime = Date.now();
  console.log('🧠 [Memory] Starting automatic memory retrieval...');
  
  try {
    const lastUserMessage = messages[messages.length - 1];
    const userMessageText = lastUserMessage.parts
      ?.filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ') || '';
    
    if (userMessageText.trim()) {
      retrievedMemories = await retrieveRelevantMemories({
        userId: user.id,
        userMessage: userMessageText,
        maxResults: 5,
        minRelevanceScore: 0.3,
        enableCache: true,
      });
      
      memoryContext = formatMemoriesForPrompt(retrievedMemories.memories);
      
      console.log(
        `✅ [Memory] Retrieved ${retrievedMemories.memories.length} memories ` +
        `in ${retrievedMemories.retrievalTimeMs}ms`
      );
    }
  } catch (error) {
    console.error('❌ [Memory] Failed to retrieve memories:', error);
  }
  
  const memoryRetrievalTime = (Date.now() - memoryRetrievalStartTime) / 1000;
  dbOperationTimings.push({ operation: 'retrieveMemories', time: memoryRetrievalTime });
  console.log(`⏱️  [Memory] Total retrieval took: ${memoryRetrievalTime.toFixed(2)}s`);
}
```

- [ ] **Modify system prompt construction:**
```typescript
system: 
  memoryContext +  // ⭐ INJECT FIRST
  '\n\n' +
  instructions + 
  (customInstructions && (isCustomInstructionsEnabled ?? true)
    ? `\n\nThe user's custom instructions: ${customInstructions?.content}`
    : '\n') +
  (latitude && longitude 
    ? `\n\nUser's location: ${latitude}, ${longitude}.` 
    : ''),
```

- [ ] **Add memory-context streaming** (in `onFinish` callback):
```typescript
onFinish: async (event) => {
  // ... existing logic ...
  
  if (retrievedMemories && retrievedMemories.memories.length > 0) {
    dataStream.writeData({
      type: 'memory-context',
      memories: retrievedMemories.memories,
      searchQuery: retrievedMemories.searchQuery,
      totalFound: retrievedMemories.totalFound,
    });
  }
},
```

---

### Step 8: Update Type Definitions
**File:** `lib/types.ts` (+~15 lines)

- [ ] Add `MemoryContextData` interface
- [ ] Add to `CustomUIDataTypes` union

```typescript
export interface MemoryContextData {
  id: string;
  content: string;
  summary: string;
  savedAt: string;
  conversationId?: string;
  messageRole?: 'user' | 'assistant';
  relevanceScore?: number;
}

export type CustomUIDataTypes =
  | { type: 'related-searches'; searches: string[] }
  | { type: 'weather-data'; location: string; temperature: number; conditions: string }
  | { 
      type: 'memory-context'; 
      memories: MemoryContextData[]; 
      searchQuery: string; 
      totalFound: number 
    }
  // ... other types
```

---

### Step 9: Manual Testing
**Goal:** Verify end-to-end functionality

- [ ] Start dev server
- [ ] Login as test user
- [ ] Save a test memory via inline selection
- [ ] Send a message related to the saved memory
- [ ] Check console logs for:
  - [ ] Memory retrieval timing
  - [ ] Number of memories found
  - [ ] Cache behavior
- [ ] Verify no errors in console
- [ ] Check network tab for memory-context data

**Test Scenarios:**
1. User with saved memories → Should retrieve
2. User with no memories → Should return empty
3. Unauthenticated user → Should skip retrieval
4. Similar messages (cache test) → Second should be fast (<10ms)

---

### Step 10: Performance Validation
**Goal:** Confirm <500ms retrieval target

- [ ] Measure cold retrieval time (no cache)
- [ ] Measure warm retrieval time (cache hit)
- [ ] Measure total API latency impact
- [ ] Verify parallel execution working

**Performance Targets:**
- Cold retrieval: <500ms
- Cache hit: <10ms
- Total added latency: <200ms (due to parallel execution)

**Logging to Monitor:**
```
⏱️  [Memory] Total retrieval took: 0.32s
📊 [Metrics] Memory Retrieval: {
  userId: 'test-user',
  retrievalTimeMs: 320,
  memoriesFound: 5,
  memoriesReturned: 5,
  cacheHit: false
}
```

---

## 🧪 Verification Steps

### Unit Tests
```bash
# Run tests
npx vitest lib/services/memory-retrieval.test.ts --run

# Expected output:
# ✓ extractSearchQuery (6 tests)
# ✓ formatMemoriesForPrompt (6 tests)
# ✓ retrieveRelevantMemories (10 tests)
# Coverage: 90%+
```

### Integration Test
```bash
# Start dev server
npm run dev

# Test in browser:
# 1. Login
# 2. Save memory
# 3. Send related message
# 4. Check console for memory retrieval logs
```

### Type Check
```bash
npx tsc --noEmit
# Should pass with no errors
```

---

## 🚧 Known Issues & Workarounds

### Issue 1: Supermemory Returns Empty Array
**Status:** To be investigated during implementation

**Current Code:**
```typescript
// lib/memory-actions.ts line ~60
return { memories: [], total: result.total || 0 };
```

**Workaround Options:**
1. Fix searchMemories() to return actual memories
2. Use getAllMemories() and filter locally
3. Test with real Supermemory API to verify behavior

**Action:** Test during implementation and fix if needed

---

## 📊 Success Criteria

- [ ] All unit tests pass (90%+ coverage)
- [ ] Integration test successful (memory retrieval working)
- [ ] No TypeScript errors
- [ ] Performance within targets (<500ms)
- [ ] Cache working correctly (hit rate observable)
- [ ] Graceful error handling verified
- [ ] Console logs informative and clean
- [ ] No breaking changes to existing functionality

---

## 🔄 Rollback Plan

If implementation causes issues:

1. **Revert files:**
   ```bash
   git checkout HEAD -- lib/services/memory-retrieval.ts
   git checkout HEAD -- app/api/search/route.ts
   git checkout HEAD -- lib/types.ts
   ```

2. **Remove test file:**
   ```bash
   rm lib/services/memory-retrieval.test.ts
   ```

3. **Restart dev server**

4. **Verify system stability**

---

## 📝 Notes

- Follow strict TypeScript typing (no `any` except in integration points)
- Use existing patterns from codebase (e.g., custom instructions pattern)
- Log all performance metrics for monitoring
- Document any deviations from plan
- Keep functions under 100 lines each (SRP)

---

**Plan Complete:** Ready to begin implementation.
