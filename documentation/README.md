# 📚 AI-Coding Documentation System

## 🎯 Purpose
This documentation system provides comprehensive guidance for AI coding agents and human developers working with our standard tech stack. It emphasizes interconnected documentation with clear examples and anti-patterns.

## 🚀 Quick Navigation

### Core Documentation
- **[STACK.md](./STACK.md)** - Complete tech stack overview and versions
- **[AGENTS.md](./AGENTS.md)** - AI agent instructions and routing logic
- **[SETUP.md](./workflows/project-setup/README.md)** - Project initialization guide

### Stack-Specific Guides
- **[Next.js + Convex](./stack/nextjs-convex/)** - Full-stack integration patterns
- **[Clerk Auth](./stack/clerk/)** - Authentication setup and patterns
- **[UI Components](./stack/ui-components/)** - ShadCN + Tailwind guidelines
- **[Convex Backend](./stack/convex/)** - Database and real-time features
- **[Supabase](./stack/supabase/)** - Alternative backend (when needed)

### Development Workflows
- **[Project Setup](./workflows/project-setup/)** - Initial configuration
- **[Feature Development](./workflows/feature-development/)** - Building new features
- **[Debugging](./workflows/debugging/)** - Troubleshooting guides

### Reusable Patterns
- **[Authentication](./patterns/authentication/)** - Auth flows and protection
- **[Data Management](./patterns/data-management/)** - CRUD, real-time, uploads
- **[UI Patterns](./patterns/ui-patterns/)** - Forms, modals, loading states

## 🔍 How to Use This Documentation

### For AI Agents
1. Check `AGENTS.md` for task routing
2. Follow cross-references between documents
3. Use examples from `/examples/{good,bad}/` folders
4. Verify patterns against completed features

### For Developers
1. Start with `STACK.md` for tech overview
2. Use workflow guides for common tasks
3. Reference pattern library for solutions
4. Check examples before implementing

## 📋 Documentation Standards

### File Naming
- Use kebab-case: `feature-name.md`
- Descriptive but concise names
- Consistent suffixes: `-guide.md`, `-patterns.md`

### Cross-References
Every document should link to related content:
```markdown
→ See also: [Related Topic](../other-folder/file.md)
→ Example: [Implementation](../../examples/feature/)
→ Pattern: [Reusable Solution](../../patterns/category/)
```

### Code Examples
Always provide both good and bad examples:

```typescript
// ✅ GOOD: Clear description why this is correct
const example = await ctx.db.query("table").first();

// ❌ BAD: Explanation of the problem
const example = db.query("table").first(); // Missing await and ctx
```

## 🏗️ Stack Architecture

```
┌─────────────────────────────────────┐
│         Next.js (App Router)         │
│  ┌─────────────┐  ┌───────────────┐ │
│  │   Clerk     │  │  ShadCN UI    │ │
│  │    Auth     │  │  + Tailwind   │ │
│  └─────────────┘  └───────────────┘ │
└───────────────┬─────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼──────────┐   ┌────────▼────────┐
│    Convex    │   │    Supabase     │
│   (Primary)  │   │   (Optional)    │
└──────────────┘   └─────────────────┘
                │
        ┌───────▼───────┐
        │    Vercel     │
        │  Deployment   │
        └───────────────┘
```

## 📊 Version Tracking

| Package | Current Version | Docs Updated |
|---------|----------------|--------------|
| Next.js | 14.x | 2024-01 |
| Convex | 1.x | 2024-01 |
| Clerk | 5.x | 2024-01 |
| ShadCN | Latest | 2024-01 |
| Tailwind | 3.x | 2024-01 |

## 🔄 Maintenance

- **Weekly**: Review active features documentation
- **Monthly**: Update package versions
- **Quarterly**: Audit and refactor patterns
- **On-demand**: Add new patterns from successful implementations

## 🚦 Getting Started

1. **New Project?** → Start with [Project Setup](./workflows/project-setup/)
2. **Adding Features?** → Check [Feature Development](./workflows/feature-development/)
3. **Need Examples?** → Browse [Examples](./examples/)
4. **Stuck?** → See [Debugging Guides](./workflows/debugging/)

---

*This documentation system is designed to be modular, scalable, and AI-friendly. Each component can be used independently or as part of the complete system.*