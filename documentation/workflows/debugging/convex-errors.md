# 🐛 Convex Debugging Guide

## Overview
Common Convex errors and their solutions. Check here when encountering issues with queries, mutations, or real-time subscriptions.

## Quick Links
- 🔴 [Common Errors](#common-errors)
- 🔍 [Debugging Tools](#debugging-tools)
- ⚡ [Performance Issues](#performance-issues)
- 🔐 [Authentication Problems](#authentication-problems)

## Common Errors

### Error: "CONVEX_CLIENT_NOT_CONFIGURED"

**Symptoms:**
```
Error: Uncaught Error: CONVEX_CLIENT_NOT_CONFIGURED
Could not find ConvexReactClient
```

**✅ Solution:**
```typescript
// Ensure ConvexProvider wraps your app
// app/providers.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL! // Check this exists
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}

// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Error: "Argument does not match validator"

**Symptoms:**
```
Error: Argument "userId" does not match validator
Expected: v.id("users"), Got: "user_123"
```

**✅ Solution:**
```typescript
// ❌ BAD: Passing wrong type
const user = await getUser({ userId: "user_123" }); // String instead of Id

// ✅ GOOD: Use proper Id type
import { Id } from "@/convex/_generated/dataModel";

const userId: Id<"users"> = "j173kf8..."; // Actual Convex ID
const user = await getUser({ userId });

// Or validate in mutation/query
export const getUser = query({
  args: {
    // Accept either format
    userId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    // Convert string to query if needed
    if (typeof args.userId === "string") {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk", q => q.eq("clerkId", args.userId))
        .first();
    }
    return await ctx.db.get(args.userId);
  },
});
```

### Error: "Cannot read properties of undefined"

**Symptoms:**
```
TypeError: Cannot read properties of undefined (reading 'map')
```

**✅ Solution:**
```typescript
// ❌ BAD: Not handling loading state
export function PostList() {
  const posts = useQuery(api.posts.list);
  return posts.map(post => <div>{post.title}</div>); // Error when undefined
}

// ✅ GOOD: Handle loading state
export function PostList() {
  const posts = useQuery(api.posts.list);

  if (posts === undefined) {
    return <LoadingSkeleton />;
  }

  if (posts === null || posts.length === 0) {
    return <EmptyState />;
  }

  return posts.map(post => <div key={post._id}>{post.title}</div>);
}
```

### Error: "Not authenticated"

**Symptoms:**
```
Error: Not authenticated
User identity is null
```

**✅ Solution:**
```typescript
// 1. Check Clerk integration
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, // Must match Clerk
      applicationID: "convex",
    },
  ],
};

// 2. Use proper auth hooks
"use client";
import { useConvexAuth } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";

export function ProtectedContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <SignInPrompt />;

  return <SecretContent />;
}

// 3. Check auth in Convex functions
export const protectedQuery = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      // Return null instead of throwing for better UX
      return null;
    }

    // Protected logic here
  },
});
```

### Error: "Index not found"

**Symptoms:**
```
Error: Index "by_user" not found on table "posts"
```

**✅ Solution:**
```typescript
// Add missing index to schema
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    title: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]) // Add this index
    .index("by_user_date", ["userId", "createdAt"]), // Compound index
});

// After adding, restart convex dev
// npx convex dev
```

## Debugging Tools

### 1. Convex Dashboard

```bash
# Open dashboard
npx convex dashboard

# Features:
# - View real-time logs
# - Inspect data
# - Test functions
# - Monitor performance
```

### 2. Console Logging

```typescript
// ✅ GOOD: Strategic logging
export const debugQuery = query({
  handler: async (ctx, args) => {
    console.log("Query started:", { args });

    const user = await ctx.db.get(args.userId);
    console.log("User found:", user ? "Yes" : "No");

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect();
    console.log("Posts count:", posts.length);

    return posts;
  },
});
```

### 3. Development Mode Helpers

```typescript
// lib/convex-debug.ts
export function debugConvex<T>(
  data: T | undefined,
  label: string
): T | undefined {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Convex Debug] ${label}:`, data);
  }
  return data;
}

// Usage
const posts = debugConvex(
  useQuery(api.posts.list),
  "Posts Query"
);
```

## Performance Issues

### Slow Queries

**Problem:** Queries taking too long

**✅ Solutions:**

```typescript
// 1. Add proper indexes
defineTable({
  // fields...
})
  .index("by_status", ["status"]) // Single field
  .index("by_user_status", ["userId", "status"]) // Compound

// 2. Limit query results
export const recentPosts = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_date")
      .order("desc")
      .take(20); // Limit results
  },
});

// 3. Use pagination
export const paginatedPosts = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("posts")
      .paginate({ cursor: args.cursor, numItems: 10 });
  },
});
```

### Memory Issues

**Problem:** "JavaScript heap out of memory"

**✅ Solutions:**

```typescript
// ❌ BAD: Loading everything
const allPosts = await ctx.db.query("posts").collect();

// ✅ GOOD: Process in batches
async function processPosts(ctx: QueryCtx) {
  let cursor = null;
  const batchSize = 100;

  while (true) {
    const batch = await ctx.db
      .query("posts")
      .paginate({ cursor, numItems: batchSize });

    // Process batch
    for (const post of batch.results) {
      // Process each post
    }

    if (!batch.continueCursor) break;
    cursor = batch.continueCursor;
  }
}
```

## Authentication Problems

### Clerk Token Issues

**Problem:** "Invalid token" or auth mismatch

**✅ Debug Steps:**

```typescript
// 1. Check environment variables
console.log("Convex URL:", process.env.NEXT_PUBLIC_CONVEX_URL);
console.log("Clerk Key:", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// 2. Verify Clerk JWT template
// In Clerk Dashboard → JWT Templates → Convex
// Issuer should match convex/auth.config.ts

// 3. Debug auth state
export function AuthDebug() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    console.log("Convex Auth:", { isAuthenticated, isLoading });
    console.log("Clerk Auth:", { isSignedIn, userId: user?.id });
  }, [isAuthenticated, isLoading, isSignedIn, user]);

  return null;
}
```

## WebSocket Issues

### Connection Problems

**Symptoms:** Real-time updates not working

**✅ Solutions:**

```typescript
// 1. Check WebSocket connection
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!,
  {
    // Enable verbose logging
    verbose: true,
  }
);

// 2. Handle reconnection
export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const checkConnection = setInterval(() => {
      // Check if queries are updating
      const testQuery = async () => {
        try {
          await fetch(process.env.NEXT_PUBLIC_CONVEX_URL!);
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        }
      };
      testQuery();
    }, 5000);

    return () => clearInterval(checkConnection);
  }, []);

  if (!isConnected) {
    return <div>Connection lost. Retrying...</div>;
  }

  return null;
}
```

## Error Recovery Patterns

### Graceful Degradation

```typescript
// ✅ GOOD: Handle errors gracefully
export function ResilientComponent() {
  const posts = useQuery(api.posts.list);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (posts === undefined) return; // Still loading

    if (posts === null) {
      setError("Failed to load posts");
    } else {
      setError(null);
    }
  }, [posts]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return <PostList posts={posts || []} />;
}
```

## Monitoring & Logging

### Production Error Tracking

```typescript
// lib/error-reporter.ts
export function reportError(error: Error, context: any) {
  console.error("Convex Error:", error, context);

  // Send to error tracking service
  if (process.env.NODE_ENV === "production") {
    // Sentry, LogRocket, etc.
    captureException(error, { extra: context });
  }
}

// Use in Convex functions
export const safeQuery = query({
  handler: async (ctx, args) => {
    try {
      // Your logic
    } catch (error) {
      reportError(error, { function: "safeQuery", args });
      throw error;
    }
  },
});
```

## Common Fixes Checklist

### Quick Fixes

- [ ] Run `npx convex dev` in separate terminal
- [ ] Check `.env.local` has correct URLs
- [ ] Clear browser cache and cookies
- [ ] Restart Next.js dev server
- [ ] Check Convex dashboard for errors
- [ ] Verify Clerk webhook is configured
- [ ] Ensure indexes are defined in schema
- [ ] Check for TypeScript errors

## Related Guides
- 🔗 [Clerk Issues](./clerk-issues.md)
- 🔗 [Vercel Deployment](./vercel-deployment.md)
- 🔗 [Performance Optimization](../../patterns/performance/)

---

*Most Convex errors are related to configuration or type mismatches. Always check the dashboard logs and ensure your schema matches your queries.*