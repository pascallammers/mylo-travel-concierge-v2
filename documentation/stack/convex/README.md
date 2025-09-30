# 🔥 Convex Backend Documentation

## Overview
Convex is our primary backend solution, providing real-time database, file storage, and serverless functions with end-to-end TypeScript support.

## Quick Links
- 🚀 [Setup Guide](#setup)
- 📊 [Schema Design](./schema-design.md)
- 🔄 [Queries & Mutations](./mutations-queries.md)
- ⚡ [Real-time Features](./real-time.md)
- 📁 [File Storage](./file-storage.md)
- 🔧 [Best Practices](#best-practices)
- 📚 [Examples](./examples/)

## Setup

### Installation
```bash
npm install convex
npx convex dev  # Start development server
```

### Project Structure
```
convex/
├── _generated/           # Auto-generated types (don't edit)
├── schema.ts            # Database schema definition
├── auth.config.ts       # Clerk integration config
├── http.ts              # HTTP endpoints
└── [features]/          # Feature-specific functions
    ├── queries.ts       # Read operations
    ├── mutations.ts     # Write operations
    └── actions.ts       # External API calls
```

## Core Concepts

### 1. Schema Definition
```typescript
// ✅ GOOD: Type-safe schema with validators
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    createdAt: v.number(),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_email", ["email"]),

  posts: defineTable({
    title: v.string(),
    content: v.string(),
    authorId: v.id("users"),
    published: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_published", ["published", "createdAt"]),
});

// ❌ BAD: Untyped schema without indexes
export default defineSchema({
  users: defineTable({
    data: v.any(), // Never use 'any'
  }),
  // Missing indexes = poor query performance
});
```

### 2. Queries (Read Operations)
```typescript
// ✅ GOOD: Typed query with proper error handling
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);

    if (!post) {
      throw new Error("Post not found");
    }

    // Fetch related data
    const author = await ctx.db.get(post.authorId);

    return {
      ...post,
      author: author ? {
        name: author.name,
        email: author.email
      } : null
    };
  },
});

// ❌ BAD: Query without validation or error handling
export const getPost = query(async (ctx, args: any) => {
  return await ctx.db.get(args.postId); // No validation, no null check
});
```

### 3. Mutations (Write Operations)
```typescript
// ✅ GOOD: Mutation with validation and auth
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createPost = mutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", q => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Create post with all required fields
    const postId = await ctx.db.insert("posts", {
      title: args.title,
      content: args.content,
      authorId: user._id,
      published: false,
      createdAt: Date.now(),
    });

    return postId;
  },
});

// ❌ BAD: Mutation without auth or validation
export const createPost = mutation(async (ctx, args: any) => {
  return await ctx.db.insert("posts", args); // No auth, no validation
});
```

### 4. Actions (External APIs)
```typescript
// ✅ GOOD: Action with proper error handling
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Call external API
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "noreply@example.com",
          to: args.to,
          subject: args.subject,
          html: args.body,
        }),
      });

      if (!response.ok) {
        throw new Error(`Email failed: ${response.statusText}`);
      }

      // Log to database
      await ctx.runMutation(internal.emails.logSent, {
        to: args.to,
        subject: args.subject,
        sentAt: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error("Email error:", error);
      throw new Error("Failed to send email");
    }
  },
});
```

## Integration with Next.js

### Provider Setup
→ See [Next.js Integration Guide](../nextjs-convex/README.md)

### Client-side Usage
```typescript
// ✅ GOOD: Using Convex hooks in client components
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function PostList() {
  const posts = useQuery(api.posts.list);
  const deletePost = useMutation(api.posts.remove);

  if (posts === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {posts.map(post => (
        <li key={post._id}>
          {post.title}
          <button onClick={() => deletePost({ id: post._id })}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Best Practices

### ✅ DO's
1. **Use indexes** for all common query patterns
2. **Validate all inputs** with Convex validators
3. **Handle errors gracefully** with try-catch
4. **Use transactions** for related updates
5. **Implement optimistic updates** for better UX

### ❌ DON'Ts
1. **Don't use `any` type** - always define schemas
2. **Don't skip authentication** checks
3. **Don't fetch in loops** - use proper queries
4. **Don't store sensitive data** unencrypted
5. **Don't ignore rate limits** for actions

## Common Patterns

### Pagination
```typescript
export const paginatedPosts = query({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", q => q.eq("published", true))
      .order("desc")
      .paginate(args.limit, args.cursor);

    return posts;
  },
});
```

### Soft Delete
```typescript
// Schema includes deletedAt field
posts: defineTable({
  // ... other fields
  deletedAt: v.optional(v.number()),
})

// Soft delete mutation
export const softDelete = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
    });
  },
});

// Query excludes deleted items
export const activePosts = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("posts")
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});
```

## Debugging & Monitoring

### Development Tools
```bash
# View Convex dashboard
npx convex dashboard

# View logs
npx convex logs

# Run specific function
npx convex run posts:create --args '{"title":"Test"}'
```

### Error Handling
→ See [Debugging Guide](../../workflows/debugging/convex-errors.md)

## Related Documentation
- 🔗 [Clerk Integration](../clerk/convex-integration.md)
- 🔗 [File Upload Patterns](../../patterns/data-management/file-uploads.md)
- 🔗 [Real-time Patterns](../../patterns/data-management/real-time.md)
- 🔗 [Testing Convex Functions](../../workflows/testing/convex-testing.md)

---

*Convex provides the backbone of our application. Always prioritize type safety, proper indexing, and error handling for a robust backend.*