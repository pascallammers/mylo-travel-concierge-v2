# Project Standards

This directory contains comprehensive coding standards, best practices, and conventions for the Mylo Travel Concierge project.

## Purpose

These standards ensure:
- **Consistency**: All code follows the same patterns
- **Quality**: Best practices are enforced
- **Maintainability**: Code is easy to understand and modify
- **Collaboration**: Team has shared conventions

## Standards Categories

### Global Standards

Apply to all code in this project:

| Standard | Description |
|----------|-------------|
| [tech-stack.md](global/tech-stack.md) | Framework and library versions |
| [coding-style.md](global/coding-style.md) | TypeScript conventions and naming |
| [error-handling.md](global/error-handling.md) | ChatSDKError patterns |
| [validation.md](global/validation.md) | Zod schema patterns |
| [security.md](global/security.md) | Authentication and data protection |
| [ai-tools.md](global/ai-tools.md) | Vercel AI SDK tool patterns |

### Frontend Standards

For React components and UI:

| Standard | Description |
|----------|-------------|
| [components.md](frontend/components.md) | React 19 and Next.js 15 patterns |
| [css.md](frontend/css.md) | Tailwind CSS v4 styling |
| [accessibility.md](frontend/accessibility.md) | WCAG compliance via Radix UI |
| [responsive.md](frontend/responsive.md) | Mobile-first responsive design |

### Backend Standards

For API routes and data:

| Standard | Description |
|----------|-------------|
| [api.md](backend/api.md) | Next.js Route Handlers patterns |
| [models.md](backend/models.md) | Drizzle ORM schema definitions |
| [queries.md](backend/queries.md) | Database query patterns |
| [migrations.md](backend/migrations.md) | Drizzle Kit migrations |

### Testing Standards

| Standard | Description |
|----------|-------------|
| [test-writing.md](testing/test-writing.md) | Node.js test runner patterns |

## Tech Stack Summary

| Category | Technologies |
|----------|--------------|
| **Framework** | Next.js 15 (App Router), React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Database** | PostgreSQL (Neon), Drizzle ORM |
| **Auth** | better-auth |
| **AI** | Vercel AI SDK (multi-provider) |
| **Validation** | Zod |
| **Testing** | Node.js test runner + Testing Library |

## How to Use

### For Developers

1. **Before starting work**: Review relevant standards
2. **During development**: Reference patterns for consistency
3. **Code review**: Use standards as checklist

### For AI Assistants

Standards are automatically:
- Loaded during task orchestration
- Referenced during implementation
- Enforced during code generation

### Quick Reference

**Creating a new API route?**
→ See [backend/api.md](backend/api.md)

**Building a React component?**
→ See [frontend/components.md](frontend/components.md)

**Adding a new AI tool?**
→ See [global/ai-tools.md](global/ai-tools.md)

**Writing database queries?**
→ See [backend/queries.md](backend/queries.md)

**Handling errors?**
→ See [global/error-handling.md](global/error-handling.md)

## Code Review Checklist

- [ ] Follows coding style conventions
- [ ] Uses TypeScript strictly (no `any`)
- [ ] Validates input with Zod
- [ ] Handles errors with ChatSDKError
- [ ] Uses `.$withCache()` for read queries
- [ ] Server Components by default (no unnecessary 'use client')
- [ ] Uses cn() for conditional classes
- [ ] Has tests for business logic
- [ ] Security considerations addressed

## Maintenance

Standards should be updated when:
- New patterns emerge in codebase
- Framework best practices change
- Team learns better approaches
- New libraries are adopted

---

Last Updated: November 2025
