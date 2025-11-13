# Research Skills Index

Complete guide to research skills powered by Exa code search and Ref documentation.

## Overview

These skills help you quickly research and learn your tech stack by:
- **Exa code search** (`get_code_context_exa`) - Find real-world implementation examples
- **Ref documentation** (`ref_search_documentation`) - Search official documentation
- **Ref URL reading** (`ref_read_url`) - Read complete documentation pages

## Available Research Skills

### Core Framework Skills

#### 1. research-nextjs
**When to use:** Learning Next.js 15 App Router patterns, Server Components, data fetching, caching, routing

**Key topics:**
- App Router architecture
- Server vs Client Components
- Data fetching patterns
- API routes and route handlers
- Caching and revalidation
- Metadata and SEO
- Middleware patterns
- Performance optimization

**Example:**
```
"I need to understand how to fetch data in Server Components"
→ Use research-nextjs skill
```

---

#### 2. research-react
**When to use:** Learning React 19 features, hooks, component patterns, state management

**Key topics:**
- React 19 new features (Actions, useOptimistic, use())
- Component patterns and composition
- Hooks (useState, useEffect, useMemo, useCallback, custom hooks)
- Performance optimization (memo, lazy, virtualization)
- Error boundaries
- Suspense and streaming
- Accessibility patterns

**Example:**
```
"How do I use React 19 Actions for form submission?"
→ Use research-react skill
```

---

#### 3. research-typescript
**When to use:** Learning TypeScript patterns, type safety, utility types, generics

**Key topics:**
- Type annotations and inference
- Utility types (Partial, Pick, Omit, etc.)
- Generics and type constraints
- Type guards and discriminated unions
- Advanced type patterns
- Module organization
- Declaration files

**Example:**
```
"I need to create a type-safe API wrapper"
→ Use research-typescript skill
```

---

### Data & State Management Skills

#### 4. research-drizzle
**When to use:** Learning Drizzle ORM patterns, queries, schema design, migrations

**Key topics:**
- Schema definition and relations
- Query builder patterns
- Migrations
- Transactions
- Type-safe queries
- Performance optimization
- Next.js integration (Server Components, Actions)

**Example:**
```
"How do I set up many-to-many relations in Drizzle?"
→ Use research-drizzle skill
```

---

#### 5. research-tanstack-query
**When to use:** Learning client-side data fetching, caching, mutations, optimistic updates

**Key topics:**
- useQuery and useMutation hooks
- Caching strategies
- Optimistic updates
- Pagination and infinite scroll
- Prefetching and SSR
- Query invalidation
- Next.js integration

**Example:**
```
"How do I implement optimistic updates for a todo list?"
→ Use research-tanstack-query skill
```

---

### Validation & Forms Skills

#### 6. research-zod-validation
**When to use:** Learning Zod schema design, validation patterns, error handling

**Key topics:**
- Schema design and composition
- Type inference
- Transformations and refinements
- Error handling
- React Hook Form integration
- API validation
- Environment variables

**Example:**
```
"How do I validate nested form data with Zod?"
→ Use research-zod-validation skill
```

---

### Styling Skills

#### 7. research-tailwind
**When to use:** Learning Tailwind CSS v4, responsive design, dark mode, component patterns

**Key topics:**
- Tailwind v4 features (Oxide engine)
- Responsive design patterns
- Dark mode implementation
- Custom components and variants
- Animation patterns
- Integration with Radix UI
- CVA (Class Variance Authority)
- Performance optimization

**Example:**
```
"How do I create a responsive navigation with dark mode?"
→ Use research-tailwind skill
```

---

### Authentication Skills

#### 8. research-better-auth
**When to use:** Learning Better Auth patterns, authentication flows, session management

**Key topics:**
- Setup and configuration
- Email/password authentication
- OAuth providers
- Session management
- Middleware protection
- Role-based access control
- Password security
- Database integration with Drizzle

**Example:**
```
"How do I protect routes with Better Auth middleware?"
→ Use research-better-auth skill
```

---

### AI & Advanced Skills

#### 9. research-ai-sdk
**When to use:** Learning Vercel AI SDK patterns, streaming, multi-provider integration, tool calling

**Key topics:**
- Streaming responses
- Tool calling and function execution
- Multi-provider integration (Anthropic, OpenAI, Google, etc.)
- Structured output with Zod
- RAG patterns
- React integration (useChat, useCompletion)
- Server Actions integration
- Error handling

**Example:**
```
"How do I implement streaming AI responses with tool calling?"
→ Use research-ai-sdk skill
```

---

## How to Use Research Skills

### Method 1: Direct Usage

When you encounter a topic you need to learn:

1. Identify which skill matches your need (use index above)
2. Invoke the skill: `/research-[name]`
3. Provide your specific question or topic
4. The skill will guide the research process using Exa and Ref

### Method 2: Contextual Usage

Skills are automatically suggested when you ask questions like:
- "How do I implement [feature] in Next.js?"
- "What's the best way to handle [pattern] in React?"
- "Show me examples of [topic]"

### Method 3: Combined Research

For complex topics, use multiple skills:

```
Example: Building an authenticated API with data validation

1. research-nextjs → API route patterns
2. research-better-auth → Authentication checks
3. research-drizzle → Database queries
4. research-zod-validation → Input validation
```

## Research Workflow

### Step 1: Search Documentation (Ref)
```typescript
// Find official documentation
ref_search_documentation("Next.js 15 server actions")

// Read specific documentation
ref_read_url("https://nextjs.org/docs/app/...")
```

### Step 2: Find Code Examples (Exa)
```typescript
// Get real-world implementations
get_code_context_exa(
  "Next.js 15 server action form submission validation example",
  tokensNum: 5000
)
```

### Step 3: Synthesize Learning
- Compare docs with real examples
- Identify best practices
- Note project-specific considerations
- Document patterns for future use

## Tech Stack Coverage

Your project is fully covered by these research skills:

| Technology | Skill | Coverage |
|------------|-------|----------|
| Next.js 15 | research-nextjs | ✅ Complete |
| React 19 | research-react | ✅ Complete |
| TypeScript 5 | research-typescript | ✅ Complete |
| Drizzle ORM | research-drizzle | ✅ Complete |
| Tanstack Query | research-tanstack-query | ✅ Complete |
| Zod | research-zod-validation | ✅ Complete |
| Tailwind CSS v4 | research-tailwind | ✅ Complete |
| Better Auth | research-better-auth | ✅ Complete |
| Vercel AI SDK | research-ai-sdk | ✅ Complete |

**Additional libraries** (Radix UI, Framer Motion, React Hook Form, etc.) are covered within relevant skills.

## Quick Reference

### By Use Case

**Building a feature:**
1. research-nextjs (routing, data fetching)
2. research-react (components, hooks)
3. research-drizzle (database)
4. research-tailwind (styling)

**Form with validation:**
1. research-react (form handling)
2. research-zod-validation (validation)
3. research-tanstack-query (submission)

**Authentication:**
1. research-better-auth (auth flows)
2. research-nextjs (middleware)
3. research-drizzle (user storage)

**AI features:**
1. research-ai-sdk (AI integration)
2. research-nextjs (streaming)
3. research-react (UI components)

### By Problem Type

**"I don't know how to..."**
→ Use relevant research skill to learn patterns

**"What's the best way to..."**
→ Research skill finds best practices from docs and examples

**"Show me examples of..."**
→ Exa code search finds real implementations

**"How does X work?"**
→ Ref documentation provides comprehensive explanation

## Best Practices

### 1. Start with Documentation
Always check official docs first before diving into code examples.

### 2. Verify Examples
Code from Exa is real-world but may not follow best practices. Cross-reference with docs.

### 3. Consider Your Stack
Your project has specific versions and configurations. Always adapt examples to your context.

### 4. Document Learnings
Save patterns you discover in `.claude/memory/org/patterns.json` for future reference.

### 5. Combine Skills
Complex features often require multiple skills. Don't hesitate to research across domains.

## Tips for Effective Research

### Writing Good Queries

**For Ref (documentation):**
- Be specific about version numbers
- Include framework/library names
- Focus on concepts and features

```
Good: "Next.js 15 server components data fetching"
Bad: "how to fetch data"
```

**For Exa (code search):**
- Include implementation details
- Specify technologies used
- Add "example" or "implementation"

```
Good: "Next.js 15 server component Drizzle database query example"
Bad: "server component query"
```

### Narrowing Results

If you get too many results:
1. Add more specific terms
2. Include version numbers
3. Specify the exact use case
4. Mention related technologies

### Expanding Results

If you get too few results:
1. Use broader terms
2. Remove version specifics
3. Search for the general pattern
4. Try alternative terminology

## Skill Maintenance

These research skills are based on your detected tech stack:
- **Next.js 15.6.0-canary.25**
- **React 19.1.1**
- **TypeScript 5.x**
- **Drizzle ORM 0.44.5**
- **Better Auth 1.1.3**
- **Vercel AI SDK 5.0.51**
- **Tailwind CSS 4.1.13**
- **Tanstack Query 5.90.2**
- **Zod 3.25.76**

When you upgrade major versions, consider updating the skills to reflect new features and patterns.

## Getting Started

1. **Try a skill:** Pick a technology you want to learn more about
2. **Ask a question:** Be specific about what you want to know
3. **Review results:** Documentation + code examples
4. **Apply learning:** Implement in your project
5. **Document patterns:** Save for future reference

**Example first research:**
```
/research-nextjs

"Show me how to implement server-side data fetching
with Drizzle ORM in a Next.js 15 server component"
```

## Support

For each skill, check the individual skill file for:
- Detailed usage instructions
- Common query patterns
- Example sessions
- Output formats
- Integration guides

**Skill files location:** `.claude/skills/research-[name]/skill.md`

---

Happy researching! These skills will help you quickly learn and implement patterns from your tech stack. 🚀
