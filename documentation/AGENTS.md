# 🤖 AI Agent Instructions

## Purpose
This document provides routing logic and context-aware instructions for AI coding agents. It helps agents understand which documentation to reference based on the task at hand.

## Stack Detection Logic

```javascript
// Automatic stack detection for AI agents
function detectProjectStack() {
  const stack = {
    frontend: null,
    backend: null,
    auth: null,
    ui: null,
    deployment: null
  };

  // Frontend detection
  if (fileExists('next.config.js') || fileExists('next.config.ts')) {
    stack.frontend = 'nextjs';
    if (directoryExists('app/')) {
      stack.frontend = 'nextjs-app-router';
    }
  }

  // Backend detection
  if (directoryExists('convex/')) {
    stack.backend = 'convex';
    loadDocumentation('/stack/convex/');
    loadDocumentation('/stack/nextjs-convex/');
  }
  if (packageJsonContains('@supabase/supabase-js')) {
    stack.backend = stack.backend ? 'mixed' : 'supabase';
    loadDocumentation('/stack/supabase/');
  }

  // Authentication detection
  if (packageJsonContains('@clerk/nextjs')) {
    stack.auth = 'clerk';
    loadDocumentation('/stack/clerk/');
  }

  // UI framework detection
  if (fileExists('tailwind.config.js') || fileExists('tailwind.config.ts')) {
    stack.ui = 'tailwind';
  }
  if (directoryExists('components/ui/')) {
    stack.ui = 'shadcn-tailwind';
    loadDocumentation('/stack/ui-components/');
  }

  return stack;
}
```

## Task Routing Matrix

### Authentication Tasks
| User Request | Primary Docs | Secondary Docs | Examples |
|--------------|--------------|----------------|----------|
| "Add authentication" | `/stack/clerk/` | `/patterns/authentication/` | `/stack/clerk/examples/` |
| "Protect this route" | `/stack/clerk/middleware.md` | `/stack/nextjs-convex/` | Good: Protected API pattern |
| "Add social login" | `/stack/clerk/social-providers.md` | - | Good: OAuth setup |
| "User profiles" | `/stack/clerk/user-management.md` | `/stack/convex/schema-design.md` | CRUD examples |

### Database & Backend Tasks
| User Request | Primary Docs | Secondary Docs | Examples |
|--------------|--------------|----------------|----------|
| "Create database schema" | `/stack/convex/schema-design.md` | `/patterns/data-management/` | Schema examples |
| "Add real-time feature" | `/stack/convex/real-time.md` | `/stack/nextjs-convex/` | WebSocket patterns |
| "File upload" | `/stack/convex/file-storage.md` | `/patterns/data-management/file-uploads.md` | Upload component |
| "Complex SQL query" | `/stack/supabase/when-to-use.md` | `/stack/supabase/` | Convex vs Supabase |

### UI & Component Tasks
| User Request | Primary Docs | Secondary Docs | Examples |
|--------------|--------------|----------------|----------|
| "Create a form" | `/patterns/ui-patterns/forms.md` | `/stack/ui-components/` | ShadCN form examples |
| "Add modal/dialog" | `/patterns/ui-patterns/modals.md` | `/stack/ui-components/` | Dialog patterns |
| "Dark mode" | `/stack/ui-components/theming.md` | - | Theme provider setup |
| "Responsive design" | `/stack/ui-components/responsive.md` | - | Breakpoint examples |

### Feature Development
| User Request | Primary Docs | Secondary Docs | Examples |
|--------------|--------------|----------------|----------|
| "New feature" | `/workflows/feature-development/` | Task-specific docs | Feature templates |
| "CRUD operations" | `/patterns/data-management/crud.md` | `/stack/convex/mutations-queries.md` | CRUD app example |
| "Search functionality" | `/patterns/data-management/search.md` | `/stack/convex/` | Search implementation |

## Decision Trees

### 🔀 Convex vs Supabase Decision
```
Need real-time updates?
  YES → Use Convex
  NO → Continue ↓

Need complex SQL/PostgreSQL features?
  YES → Use Supabase
  NO → Use Convex (simpler)

Have existing PostgreSQL database?
  YES → Use Supabase
  NO → Use Convex (better DX)

Need row-level security?
  YES → Consider Supabase
  NO → Convex is sufficient
```

### 🎨 Component Creation Flow
```
Is it a reusable UI component?
  YES → Check /stack/ui-components/
    → Use ShadCN if available
    → Create custom with Tailwind
  NO → Continue ↓

Is it a page/route component?
  YES → Check /stack/nextjs-convex/
    → Server vs Client component?
    → Data fetching pattern?
  NO → Feature-specific component
```

## Code Quality Checks

### Before Implementation
```typescript
// ✅ ALWAYS check before starting:
checkDocumentation([
  '/stack/[relevant-framework]/',
  '/patterns/[relevant-pattern]/',
  '/examples/[similar-feature]/'
]);

// ✅ Verify stack compatibility
if (using('convex') && using('supabase')) {
  readDocumentation('/stack/supabase/migration-guide.md');
}
```

### During Implementation
```typescript
// ✅ GOOD: Following established patterns
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ❌ BAD: Direct database access in components
import { db } from "@/lib/database"; // Don't do this
```

### After Implementation
```typescript
// ✅ Verification checklist:
const checks = [
  "TypeScript: no 'any' types",
  "Convex: proper error handling",
  "Clerk: auth checks in place",
  "UI: responsive on mobile",
  "Performance: optimistic updates"
];
```

## Pattern Recognition

### 🎯 Common Task Patterns

#### Pattern: User Dashboard
```
Required Docs:
1. /stack/clerk/user-management.md (get user data)
2. /stack/nextjs-convex/data-fetching.md (query user content)
3. /patterns/ui-patterns/loading-states.md (skeleton UI)
4. /stack/ui-components/component-patterns.md (layout)

Example: /examples/crud-app/dashboard/
```

#### Pattern: File Sharing Feature
```
Required Docs:
1. /stack/convex/file-storage.md (upload handling)
2. /patterns/authentication/protected-api.md (secure URLs)
3. /patterns/data-management/file-uploads.md (UI flow)
4. /stack/clerk/permissions.md (access control)

Example: /examples/file-sharing/
```

#### Pattern: Real-time Collaboration
```
Required Docs:
1. /stack/convex/real-time.md (subscriptions)
2. /patterns/data-management/optimistic-updates.md
3. /stack/nextjs-convex/client-components.md
4. /patterns/ui-patterns/presence.md (user indicators)

Example: /examples/real-time-chat/
```

## Error Resolution Paths

### Common Errors → Documentation
```javascript
const errorMap = {
  "CONVEX_CLIENT_NOT_CONFIGURED": "/stack/convex/setup.md",
  "CLERK_PUBLISHABLE_KEY_MISSING": "/stack/clerk/setup.md",
  "HYDRATION_ERROR": "/stack/nextjs-convex/server-client.md",
  "TAILWIND_NOT_WORKING": "/stack/ui-components/setup.md",
  "DEPLOYMENT_FAILED": "/workflows/debugging/vercel-deployment.md"
};
```

## Best Practices for AI Agents

### ✅ DO's
1. **Always check existing patterns** before creating new solutions
2. **Follow the tech stack** - don't introduce unnecessary dependencies
3. **Use TypeScript** for all new code
4. **Reference examples** with good/bad patterns
5. **Cross-reference documentation** for complete context

### ❌ DON'Ts
1. **Don't mix backend solutions** (Convex + Supabase) without clear reason
2. **Don't bypass Clerk** for authentication
3. **Don't use plain CSS** when Tailwind utilities exist
4. **Don't create custom components** if ShadCN has one
5. **Don't ignore error handling** in async operations

## Quick Commands Reference

```bash
# When user says "setup new project"
→ /workflows/project-setup/

# When user says "add component"
→ npx shadcn@latest add [component]

# When user says "create API endpoint"
→ /stack/convex/mutations-queries.md

# When user says "deploy"
→ /workflows/debugging/vercel-deployment.md

# When user says "fix authentication"
→ /stack/clerk/troubleshooting.md
```

## Context Awareness

### Project Phase Detection
```typescript
if (no_convex_folder) {
  // Early setup phase
  suggestDocumentation('/workflows/project-setup/');
} else if (no_auth_configured) {
  // Need authentication
  suggestDocumentation('/stack/clerk/setup.md');
} else if (basic_ui_only) {
  // Need UI components
  suggestDocumentation('/stack/ui-components/');
} else {
  // Feature development
  suggestDocumentation('/workflows/feature-development/');
}
```

## Integration Priority

When multiple technologies interact, follow this priority:

1. **Clerk** (authentication always first)
2. **Convex** (backend/database)
3. **Next.js** (routing and SSR)
4. **ShadCN/Tailwind** (UI layer)
5. **Supabase** (only if needed)

---

*This document helps AI agents navigate the documentation system efficiently. Always prefer established patterns over creating new solutions. When in doubt, reference the examples folder for concrete implementations.*