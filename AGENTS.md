# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Overview

Mylo Travel Concierge - A Next.js 16.3 application with TypeScript, Drizzle ORM, and a modular architecture. All code must be modular with strict file size limits for maintainability.

## Dev Environment

- **Runtime:** Node.js with pnpm
- **Framework:** Next.js 16.3 (App Router)
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS + shadcn/ui components

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Code Style Guidelines

### File Structure
- **Max file size:** 600 lines (ideal: 500-600)
- **One responsibility per file** (Single Responsibility Principle)
- **Barrel exports:** Each feature folder must include an `index.ts` exporting its public API
- **JSDoc required:** Every public class/function needs `@param`, `@returns`, and purpose description
- **Dependency Injection:** Pass dependencies as parameters, never import internally

### Strict Rules
- Never use `any` type
- Never use dynamic imports (`await import()`)
- No redundant try/catch blocks unless explicitly required
- Always use TypeScript strict mode

## Testing Instructions

```bash
# Run all tests
pnpm test

# Run specific test pattern
npx tsx --test "<pattern>"

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

- Every business logic file requires a colocated `*.test.ts`
- Tests must cover all public interfaces and critical branches
- Fix all test failures before committing

## Build & Verification

Before committing, always run:
```bash
pnpm lint && pnpm typecheck && pnpm test
```

All checks must pass. Fix any errors before proceeding.

## PR Guidelines

- **Title format:** `type(scope): description` (e.g., `feat(auth): add login flow`)
- Run full verification suite before opening PR
- Keep commits atomic and well-described
- Reference related issues in PR description

## Debugging Approach

1. Identify 5-7 potential root causes
2. Narrow to 1-2 most likely hypotheses
3. Add temporary log statements to confirm diagnosis
4. Confirm assumption with user before applying fix

## Security Considerations

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Validate all user inputs
- Sanitize data before database operations
