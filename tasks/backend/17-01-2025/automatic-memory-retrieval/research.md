# Research: Automatic Memory Retrieval

**Date:** 2025-01-17  
**Task:** Implement automatic memory retrieval service  
**Phase:** Backend Foundation (Day 1)

---

## 📋 Research Summary

### Existing Memory Infrastructure

#### 1. Memory Storage (`lib/memory-actions.ts`)
**Current Capabilities:**
- ✅ `saveMemoryFromChat()`: Save memories with context metadata
- ✅ `searchMemories()`: Semantic search via Supermemory API
- ✅ `getAllMemories()`: Paginated memory listing
- ✅ `deleteMemory()`: Memory deletion

**Key Findings:**
- Supermemory client is already initialized with API key
- User isolation via `containerTags: [userId]`
- Search returns `MemoryResponse` with `memories[]` and `total` count
- No current integration with chat flow

**Code Reference:**
```typescript
// Existing search function we'll use:
export async function searchMemories(query: string, page = 1, pageSize = 20): Promise<MemoryResponse> {
  const user = await getUser();
  if (!user) throw new Error('Authentication required');
  
  const result = await supermemoryClient.search.memories({
    q: query,
    containerTag: user.id,
    limit: pageSize,
  });
  
  return { memories: [], total: result.total || 0 };
}
```

#### 2. Supermemory Integration (`lib/tools/supermemory.ts`)
**Current State:**
- ✅ Memory tools exist for "memory" group only
- ✅ Tools: `search_memories`, `add_memory`
- ❌ Not automatically invoked in other groups
- ❌ No prompt-level integration

**Key Finding:** Tools require explicit invocation by AI, not automatic retrieval.

#### 3. API Route Structure (`app/api/search/route.ts`)
**Current Flow:**
1. Authenticate user (~50ms)
2. Parallel operations (~300ms):
   - `getGroupConfig()` - fetch tools + instructions
   - `getCachedCustomInstructions()` - fetch custom instructions
   - `getChatById()` - fetch chat metadata
3. Stream AI response with `streamText()`

**Key Finding:** Perfect insertion point for memory retrieval in parallel operations.

**Relevant Code:**
```typescript
const [{ tools: activeTools, instructions }, customInstructionsResult] = 
  await Promise.all([
    configWithTiming,
    customInstructionsWithTiming,
  ]);
  
// ⭐ NEW: Add memory retrieval here (parallel)

const result = streamText({
  system: instructions + customInstructions, // ⭐ Inject memories here
  // ...
});
```

#### 4. Data Streaming (`lib/types.ts`)
**Current Capabilities:**
- ✅ Custom data types supported via `CustomUIDataTypes`
- ✅ Examples: `related-searches`, `weather-data`
- ✅ Client can listen for custom data events

**Pattern to Follow:**
```typescript
export type CustomUIDataTypes =
  | { type: 'related-searches'; searches: string[] }
  | { type: 'memory-context'; memories: MemoryContextData[]; ... }; // ⭐ NEW
```

---

## 🔍 Technical Analysis

### Performance Considerations

**Current Baseline (without memories):**
- Total time to streamText: ~370ms
- DB operations: ~300ms (parallel)
- User authentication: ~50ms

**Target with Memory Retrieval:**
- Memory search: 200-300ms (parallel with existing ops)
- Cache hit: ~5ms
- Total added latency: 0-150ms (mostly absorbed by parallel execution)

**Optimization Strategy:**
- Run `retrieveRelevantMemories()` in parallel with `getGroupConfig()`
- Cache results for 30 seconds (in-memory)
- Fail gracefully (return empty array on error)

### Search Query Optimization

**Challenge:** Raw user message may not be optimal for semantic search

**Examples:**
```
User: "What is the best way to learn TypeScript?"
Bad query: "What is the best way to learn TypeScript?" (too wordy)
Good query: "best way learn typescript" (concise, meaningful)

User: "Can you remind me about my preferences?"
Bad query: "Can you remind me about my preferences?" (meta)
Good query: "preferences" (direct)
```

**Solution:** Extract meaningful keywords
- Remove filler words: the, a, an, is, are, what, how, etc.
- Remove punctuation
- Take first 10 meaningful words
- Lowercase for consistency

### Prompt Injection Strategy

**Goal:** Inject memories BEFORE system instructions for highest priority

**Format:**
```
## 🧠 Relevant User Memories

[Memory 1] (Saved: Jan 15, 2025)
User prefers TypeScript over JavaScript

[Memory 2] (Saved: Jan 10, 2025)
Working on React project with Next.js 14

**Instructions:**
- Use this context to personalize your response
- Reference these memories naturally
- Do NOT mention "based on your memories"

---

[SYSTEM INSTRUCTIONS]
You are Scira, an AI assistant...
```

**Why this works:**
- Clear section boundary
- Numbered for easy reference
- Temporal context (saved date)
- Explicit AI instructions
- Separates memory context from system instructions

---

## 🛠️ Implementation Requirements

### New Service: `lib/services/memory-retrieval.ts`

**Required Functions:**

1. **`retrieveRelevantMemories(options)`**
   - Input: userId, userMessage, maxResults, minRelevanceScore
   - Process: Extract query → Check cache → Call searchMemories()
   - Output: RetrievedMemory[], searchQuery, totalFound, retrievalTimeMs
   - Error handling: Return empty array, log error

2. **`extractSearchQuery(userMessage)`**
   - Input: Raw user message string
   - Process: Remove filler words, punctuation, lowercase, truncate
   - Output: Optimized search query string

3. **`formatMemoriesForPrompt(memories)`**
   - Input: RetrievedMemory[]
   - Process: Format into structured context block
   - Output: String ready for prompt injection

**Cache Design:**
```typescript
const memoryCache = new Map<string, {
  result: MemoryRetrievalResult;
  timestamp: number;
  ttl: number;
}>();

// Key: `${userId}:${messageSubstring}`
// TTL: 30 seconds
```

### API Route Modifications

**Changes Required in `app/api/search/route.ts`:**

1. Import new service
2. Add memory retrieval in parallel block
3. Extract user message text from last message
4. Call `retrieveRelevantMemories()`
5. Format memories with `formatMemoriesForPrompt()`
6. Inject into system prompt (BEFORE instructions)
7. Stream memory-context data in `onFinish()`

**Pseudocode:**
```typescript
// After existing parallel operations
let memoryContext = '';
let retrievedMemories = null;

if (user?.id) {
  try {
    const userMessageText = extractTextFromMessage(messages[messages.length - 1]);
    retrievedMemories = await retrieveRelevantMemories({
      userId: user.id,
      userMessage: userMessageText,
      maxResults: 5,
    });
    memoryContext = formatMemoriesForPrompt(retrievedMemories.memories);
  } catch (error) {
    console.error('Memory retrieval failed:', error);
    // Continue without memories
  }
}

// Modify streamText
system: memoryContext + '\n\n' + instructions + ...
```

---

## 📊 Research Findings

### Supermemory API Behavior

**Search Endpoint:**
- Method: `supermemoryClient.search.memories()`
- Parameters: `q` (query), `containerTag` (userId), `limit`
- Returns: `{ total: number, ... }` (memories array currently empty in implementation)
- Performance: Unknown (need to measure)

**Note:** Current implementation returns empty array but tracks total count. This might be intentional or a bug to investigate.

### Existing Patterns to Follow

**Custom Instructions Pattern:**
```typescript
// From app/api/search/route.ts
const customInstructionsPromise = user ? getCachedCustomInstructions(user) : Promise.resolve(null);

// Later...
system: instructions + 
  (customInstructions && isCustomInstructionsEnabled 
    ? `\n\nUser's custom instructions: ${customInstructions.content}`
    : '')
```

**We'll follow the same pattern:**
```typescript
const memoryContext = retrievedMemories?.memories.length > 0
  ? formatMemoriesForPrompt(retrievedMemories.memories)
  : '';

system: memoryContext + '\n\n' + instructions + ...
```

---

## ⚠️ Identified Risks

### Risk 1: Supermemory API Returns Empty Array
**Evidence:** `searchMemories()` currently returns `{ memories: [], total: ... }`

**Mitigation:**
- Verify if this is intentional or implementation issue
- Test with real saved memories
- If broken, may need to use `getAllMemories()` and filter locally

### Risk 2: Performance Impact
**Concern:** Memory retrieval might slow down API response

**Mitigation:**
- Parallel execution absorbs most latency
- Aggressive caching (30s TTL)
- 500ms timeout on Supermemory API call
- Graceful degradation (continue without memories)

### Risk 3: Irrelevant Memories Retrieved
**Concern:** Semantic search might return non-relevant memories

**Mitigation:**
- Optimize search query extraction
- Limit to top 5 results
- Future: Add relevance scoring threshold
- Future: Implement re-ranking with LLM

### Risk 4: Token Limit Exceeded
**Concern:** Adding memories might exceed prompt token limits

**Mitigation:**
- Truncate each memory to 500 chars
- Limit to 5 memories max (~500 tokens total)
- Monitor total prompt size
- Still well under 128k-200k context window

---

## ✅ Next Steps

1. **Create `lib/services/memory-retrieval.ts`** with:
   - Type definitions
   - Cache implementation
   - `extractSearchQuery()` function
   - `formatMemoriesForPrompt()` function
   - `retrieveRelevantMemories()` function

2. **Write comprehensive tests** in `lib/services/memory-retrieval.test.ts`

3. **Integrate into API route** (`app/api/search/route.ts`)

4. **Test with real data** to verify Supermemory integration

5. **Measure performance** to confirm <500ms target

---

## 📚 References

- Supermemory API: `lib/memory-actions.ts`
- Existing memory tools: `lib/tools/supermemory.ts`
- API route structure: `app/api/search/route.ts`
- Type definitions: `lib/types.ts`
- Custom instructions pattern: `app/api/search/route.ts` (lines ~150-200)

---

**Research Complete:** Ready to proceed with implementation.
