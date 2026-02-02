# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- kebab-case for files: `amadeus-client.ts`, `flight-search-links.ts`, `chat-utils.ts`
- Test files append `.test.ts` or `.integration.test.ts`: `amadeus-token.test.ts`, `flight-search.integration.test.ts`
- Component files use kebab-case with `.tsx`: `chat-interface.tsx`, `chat-dialogs.tsx`, `auth-card.tsx`
- Hook files prefixed with `use-`: `use-mobile.ts`, `use-chat-history.ts`, `use-local-storage.tsx`

**Functions:**
- camelCase for all function names: `getAmadeusToken()`, `searchAmadeus()`, `fuzzySearch()`, `recordToolCall()`
- Async functions explicitly use `async` keyword: `async function getAmadeusToken(params)`
- Factory functions and helpers prefixed with `create`, `make`, or `get`: `createInitialState()`, `makeFo

undResult()`, `getSearchModeLabel()`

**Variables:**
- camelCase for all variables and constants: `isMobile`, `selectedModel`, `initialChatId`, `MAX_RETRIES`
- Constants all-caps with underscores: `MOBILE_BREAKPOINT = 768`, `MAX_RETRIES = 2`, `BASE_DELAY_MS = 1000`
- Boolean variables prefixed with `is`, `has`, or `should`: `isMobile`, `isRetryableError()`, `shouldRetry`
- Temporary/loop variables single letter acceptable: `i`, `error`, `result`

**Types:**
- PascalCase for all types and interfaces: `AmadeusSearchParams`, `AmadeusFlight`, `QueryIntent`, `IntentResult`
- Discriminant unions use string literals: `status: 'found' | 'not_found' | 'error'`
- Exported types prefixed with `export type` or `export interface`: `export interface AmadeusSearchParams { }`

**React Components:**
- PascalCase for component names: `ChatInterface`, `Button`, `Navbar`, `LoyaltyHeaderBanner`
- Components are functions, not classes
- Use `memo()` for optimization: `const ChatInterface = memo(({ ... }: Props) => { ... })`
- Props interfaces named `{ComponentName}Props`: `ChatInterfaceProps`, not `Props`

## Code Style

**Formatting:**
- Tool: Prettier
- Config file: `.prettierrc`
- Settings:
  - Semi-colons: `true`
  - Single quotes: `true`
  - Trailing commas: `'all'`
  - Print width: `120`
  - Tab width: `2 spaces`
  - No tabs: `false`

**Linting:**
- Tool: ESLint
- Config: `.eslintrc.json` extends `next/core-web-vitals`
- Settings are minimal, relying on Next.js defaults for strict rules

**TypeScript:**
- Strict mode enabled: `true` in `tsconfig.json`
- Target: `ESNext`
- Module resolution: `bundler` (for Next.js)
- Path aliases available: `@/*` maps to project root

## Import Organization

**Order:**
1. Node.js built-in modules: `import { describe, it, mock } from 'node:test'`
2. Third-party packages: `import { useChat } from '@ai-sdk/react'`
3. Internal absolute imports using `@/`: `import { getAmadeusToken } from '@/lib/api/amadeus-token'`
4. Relative imports only when necessary within same directory: `import { isRetryableError } from './tool-error-response'`
5. Type imports clearly marked: `import type { KBQueryService } from './knowledge-base-query'`

**Path Aliases:**
- `@/*` resolves to project root (see `tsconfig.json`)
- Used throughout for consistency: `@/lib`, `@/components`, `@/hooks`, `@/app`
- Example: `import { cn } from '@/lib/utils'`

**Barrel Files:**
- Used for exporting multiple related modules: `lib/tools/index.ts` re-exports all tools
- Pattern: `export * from './module-name'`
- Avoid circular imports with barrel files

## Error Handling

**Patterns:**
- Async functions wrap API calls in try-catch blocks:
```typescript
try {
  return await executeAmadeusSearch(params);
} catch (error) {
  lastError = error instanceof Error ? error : new Error(String(error));
  // Decide whether to retry or throw
}
```

- Discriminate errors with type guards: `if (error instanceof Error) { ... }`
- Use custom error types for domain-specific errors: `ChatSDKError` in `@/lib/errors`
- Retry logic with exponential backoff for transient failures:
```typescript
const delay = BASE_DELAY_MS * Math.pow(2, attempt);
const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);
```

- When rejecting promises, use `assert.rejects()` in tests: `await assert.rejects(async () => ..., Error)`
- Throw descriptive errors with context:
```typescript
throw new Error(`Amadeus token request failed: ${error}`);
throw new Error('DUFFEL_API_KEY is not configured. Please add it to your environment variables.');
```

## Logging

**Framework:** `console` (no logger library)

**Patterns:**
- `console.log()` for debug/informational: `console.log('Searching Amadeus with params:', params)`
- `console.error()` for errors: `console.error('Amadeus search failed:', lastError)`
- No structured logging or levels (info/warn/debug) - use console directly
- Logging includes context when helpful: parameter values, error types, retry counts
- Example from `lib/api/amadeus-client.ts`:
```typescript
console.log('Searching Amadeus with query:', {
  ...params,
  token: '***' // mask sensitive data
});
console.error('Amadeus API call failed on attempt', attempt + 1, ':', lastError.message);
```

## Comments

**When to Comment:**
- JSDoc/TSDoc above all exported functions and types
- Explain WHY, not WHAT - code should be self-documenting
- Comment complex logic blocks, especially retry/timeout handling
- Mark intentional limitations or workarounds with inline comments

**JSDoc/TSDoc:**
- All public functions documented with `/** ... */` blocks
- Include `@param` for parameters
- Include `@returns` for return types
- Mark deprecated code with `@deprecated`
- Example from `lib/api/amadeus-client.ts`:
```typescript
/**
 * Search for cash flights using Amadeus Flight Offers API
 * Includes automatic retry with exponential backoff for transient errors
 *
 * @param params - Search parameters
 * @returns List of flight offers
 */
export async function searchAmadeus(
  params: AmadeusSearchParams
): Promise<AmadeusFlight[]> {
  // ...
}
```

- Short inline comments above blocks of related code:
```typescript
// Check if we should retry
const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);
```

## Function Design

**Size:** Prefer small functions (under 50 lines). Break large functions into helpers.

**Parameters:**
- Use object destructuring for multiple parameters:
```typescript
export async function searchAmadeus(params: AmadeusSearchParams): Promise<AmadeusFlight[]>
```
- Avoid positional parameters beyond 2-3 items
- Prefer named parameters over positional

**Return Values:**
- Return data types, not status codes
- Use discriminated unions for error cases: `{ status: 'found' | 'not_found' } | { status: 'error', reason: string }`
- Use `Promise<T>` for async functions
- Use `| null` or `| undefined` when appropriate, not throwing errors for missing data

**Async/Await:**
- Always use `async/await` instead of `.then()` chains
- Wrap async operations in try-catch
- Test async code with `assert.rejects()` for expected errors

## Module Design

**Exports:**
- Use named exports: `export function functionName() { }` or `export const value = ...`
- Avoid default exports (use named exports for clarity)
- Export types with `export type` or `export interface`
- Group related exports together

**Barrel Files:**
- Located at `index.ts` in directories
- Re-export public API: `export * from './amadeus-client'`
- Example: `lib/tools/index.ts` exports all flight/search tools

**File Organization:**
- One primary export per file (exception: types/interfaces can be co-located)
- Related helpers in same file if <50 lines, otherwise split
- Utilities in dedicated files: `lib/utils/`, `lib/api/`, `lib/db/queries/`

---

*Convention analysis: 2026-02-02*
