# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Runner:**
- Node.js built-in test runner (no external framework)
- Configured via `tsx` TypeScript runner
- Version: Node.js 20+

**Assertion Library:**
- Native Node.js `assert` module
- `assert/strict` for strict equality checks: `import assert from 'node:assert/strict'`
- Alternatively Bun's built-in `expect`: `import { expect } from 'bun:test'`

**Run Commands:**
```bash
npm run test              # Run all tests: tsx --test "lib/**/*.test.ts"
npm run test:unit        # Unit tests only: tsx --test "lib/api/*.test.ts" "lib/db/**/*.test.ts"
npm run test:integration # Integration tests: tsx --test "lib/tools/*.integration.test.ts"
npm run test:watch       # Watch mode: tsx --test --watch "lib/**/*.test.ts"
```

## Test File Organization

**Location:**
- Co-located with source files in same directory
- Example: `lib/api/amadeus-client.ts` paired with `lib/api/amadeus-client.test.ts`

**Naming:**
- Unit tests: `{filename}.test.ts`
- Integration tests: `{filename}.integration.test.ts`
- React component tests: `{componentname}.test.tsx` or `.test.ts` (depending on test type)

**Structure:**
```
lib/
├── api/
│   ├── amadeus-client.ts
│   ├── amadeus-client.test.ts        # Unit tests
│   ├── amadeus-token.ts
│   └── amadeus-token.test.ts         # Unit tests
├── db/
│   └── queries/
│       ├── tool-calls.ts
│       └── tool-calls.test.ts        # Unit tests
└── tools/
    ├── flight-search.ts
    └── flight-search.integration.test.ts  # Integration tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { functionUnderTest } from './module';

describe('Module Name', () => {
  describe('functionUnderTest', () => {
    it('should do X when Y', async () => {
      // Arrange
      const input = ...;

      // Act
      const result = await functionUnderTest(input);

      // Assert
      assert.strictEqual(result, expected);
    });
  });
});
```

**Patterns:**
- Top-level `describe()` block per module/class
- Nested `describe()` blocks for grouped functionality
- `it()` blocks for individual test cases
- Descriptive test names: "should X when Y" or "should return Z for input A"
- Use `beforeEach()` for setup before each test (see example below)
- Use `afterEach()` for cleanup after each test

**Setup Example from `lib/chat-utils.test.ts`:**
```typescript
describe('formatCompactTime', () => {
  beforeEach(() => {
    clearTimeFormatCache();  // Reset cache before each test
  });

  it('formats seconds ago', () => {
    const date = new Date();
    date.setSeconds(date.getSeconds() - 30);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+s/);
  });
});
```

## Mocking

**Framework:** Native Node.js `mock` from `node:test`

**Patterns:**
```typescript
import { mock } from 'node:test';

// Mock a function
const mockFn = mock.fn(async (params) => {
  return { id: 1, value: 'mocked' };
});

// Use mocked function
const result = await mockFn({ key: 'test' });

// Verify calls
assert.strictEqual(mockFn.mock.calls.length, 1, 'Should be called once');

// Access call arguments
const firstCall = mockFn.mock.calls[0];
assert.deepEqual(firstCall.arguments[0], expectedParams);
```

**Mocking Global Objects:**
```typescript
// Mock fetch globally
global.fetch = mock.fn(async () => ({
  ok: true,
  json: async () => ({ access_token: 'TEST_TOKEN' }),
})) as any;

// Mock module exports
const originalQuery = queries.getAmadeusTokenFromDb;
(queries as any).getAmadeusTokenFromDb = mock.fn(async () => mockToken);

// Restore after test
(queries as any).getAmadeusTokenFromDb = originalQuery;
```

**What to Mock:**
- External API calls (fetch, database queries)
- Third-party service clients
- Module functions that have side effects
- Time-dependent functions (use fixed dates in tests)

**What NOT to Mock:**
- Pure utility functions (string formatting, calculations)
- Type definitions
- Constants and configuration
- Functions under test (except their dependencies)

## Fixtures and Factories

**Test Data:**
- Factory functions create test objects consistently
- Located at top of test file or in shared helpers

Example from `lib/tools/knowledge-base-query.test.ts`:
```typescript
/**
 * Factory to create a mock QueryResult with found status.
 */
const makeFoundResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  answer: overrides.answer ?? 'A detailed answer about travel.',
  sources: overrides.sources ?? [{ title: 'Doc1', chunk: 'Some content', uri: 'gs://test/doc.md' }],
  confidence: overrides.confidence ?? 0.9,
  status: 'found',
});
```

Example from `lib/chat-utils.test.ts`:
```typescript
// Helper to create a chat with a specific date
function createChat(id: string, daysAgo: number, visibility: 'public' | 'private' = 'private'): Chat {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    title: `Chat ${id}`,
    createdAt: date,
    userId: 'user-1',
    visibility,
  };
}
```

**Location:**
- Defined in test file itself (not in separate fixtures directory)
- Placed before test suites
- Clearly documented with JSDoc comments
- Marked with comment headers: `// ============================================ // Test Utilities // ============================================`

## Coverage

**Requirements:** No enforced minimum (not configured in `package.json`)

**View Coverage:**
```bash
npm test -- --experimental-test-coverage "lib/**/*.test.ts"
```

**Current Coverage Areas:**
- API clients: amadeus, seats-aero, duffel, awardwallet
- Token management and caching
- Database query operations
- Tool call registry and deduplication
- Chat utilities (search, categorization, formatting)
- Intent detection
- Flight search link building

## Test Types

**Unit Tests:**
- Scope: Single function or class in isolation
- Dependencies: Mocked (fetch, database, external services)
- Location: `lib/api/*.test.ts`, `lib/db/queries/*.test.ts`, `lib/utils/*.test.ts`
- Example: `lib/api/amadeus-token.test.ts` - tests token caching and retrieval with mocked database
- Execution: Fast, no external resources needed

**Integration Tests:**
- Scope: Multiple components working together
- Dependencies: May use real services or realistic mocks
- Location: `lib/tools/*.integration.test.ts`
- Example: `lib/tools/flight-search.integration.test.ts` - tests complete flight search flow with both award and cash APIs
- Execution: Slower, may require setup/teardown

**E2E Tests:**
- Status: Not used in current codebase
- Alternative: Integration tests cover full workflows

## Common Patterns

**Async Testing:**
```typescript
// Using assert.rejects for expected errors
it('should handle network errors', async () => {
  global.fetch = mock.fn(async () => {
    throw new Error('Network error');
  }) as any;

  await assert.rejects(
    async () => await getAmadeusToken(),
    Error,
    'Should throw error on network failure'
  );
});

// Testing successful async operations
it('should return cached token if not expired', async () => {
  const mockToken = { accessToken: 'TEST_TOKEN', expiresAt: new Date(Date.now() + 1800000) };
  (queries as any).getAmadeusTokenFromDb = mock.fn(async () => mockToken);

  const token = await getAmadeusToken();
  assert.strictEqual(token, 'TEST_TOKEN');
});
```

**Error Testing:**
```typescript
// Test error conditions with specific assertions
it('should handle Amadeus API errors', async () => {
  global.fetch = mock.fn(async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
  })) as any;

  await assert.rejects(
    async () => await getAmadeusToken(),
    Error,
    'Should throw error on API failure'
  );
});

// Test validation errors
it('should reject text with less than 3 characters', () => {
  const result = validateMemoryInput('ab');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Text must be at least 3 characters');
});
```

**Mocking Module State:**
```typescript
// Save original, mock, test, restore pattern
const originalQuery = queries.getAmadeusTokenFromDb;
(queries as any).getAmadeusTokenFromDb = mock.fn(async () => mockToken);

// ... test code ...

(queries as any).getAmadeusTokenFromDb = originalQuery;
```

**Testing with Multiple Assertions:**
```typescript
// Test multiple expectations in one case
it('should record tool call with all fields', async () => {
  const toolCall = await recordToolCall({
    chatId: 'test-chat-123',
    toolName: 'search_flights',
    parameters: { origin: 'FRA', destination: 'JFK' },
    status: 'pending',
  });

  assert.ok(toolCall, 'Should return tool call record');
  assert.strictEqual(toolCall.chatId, 'test-chat-123', 'Chat ID should match');
  assert.strictEqual(toolCall.toolName, 'search_flights', 'Tool name should match');
  assert.strictEqual(toolCall.status, 'pending', 'Status should be pending');
  assert.ok(toolCall.dedupeKey, 'Should have dedupe key');
});
```

**Testing Pure Functions with Multiple Cases:**
```typescript
// Use multiple `it()` blocks for separate cases
it('returns true for empty query', () => {
  assert.equal(fuzzySearch('', 'any text'), true);
});

it('finds exact substring matches', () => {
  assert.equal(fuzzySearch('test', 'this is a test'), true);
});

it('performs case-insensitive matching', () => {
  assert.equal(fuzzySearch('Test', 'testing'), true);
});

// Or test related cases together
it('handles various input formats', () => {
  const result1 = formatCompactTime(new Date());
  const result2 = formatCompactTime(new Date(Date.now() - 60000));
  assert.ok(typeof result1 === 'string');
  assert.ok(typeof result2 === 'string');
});
```

**Testing with Factories:**
```typescript
// Use factories to create test data with variations
const baseChat = createChat('1', 0);  // Today
const yesterdayChat = createChat('2', 1);  // Yesterday

const result = categorizeChatsByDate([baseChat, yesterdayChat]);
assert.equal(result.today.length, 1);
assert.equal(result.yesterday.length, 1);
```

## Test Discovery

- Files matching `**/*.test.ts` and `**/*.integration.test.ts` are automatically discovered
- Run with `tsx --test "lib/**/*.test.ts"` (see `package.json` scripts)
- Watch mode available: `tsx --test --watch "lib/**/*.test.ts"`

## Best Practices

1. **Arrange-Act-Assert Pattern:** Structure tests with clear setup, execution, and verification
2. **Descriptive Names:** Test names should clearly state what is being tested and expected outcome
3. **Isolation:** Each test should be independent; use `beforeEach()` for shared setup
4. **No Implementation Details:** Test behavior, not internal implementation
5. **Fail Meaningfully:** Include clear assertion messages: `assert.strictEqual(value, expected, 'Clear message')`
6. **Mock Externals:** Always mock network calls, database queries, and external APIs
7. **Restore State:** Clean up mocks and state after tests to avoid test pollution
8. **Test Edge Cases:** Empty inputs, nulls, large datasets, special characters
9. **Keep Tests Fast:** Unit tests should run in milliseconds; use mocks to avoid I/O

---

*Testing analysis: 2026-02-02*
