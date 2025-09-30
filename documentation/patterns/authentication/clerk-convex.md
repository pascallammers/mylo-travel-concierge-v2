# 🔐 Clerk + Convex Authentication Pattern

## Overview
Complete authentication flow integrating Clerk for user management with Convex for database operations.

## Quick Links
- → [Clerk Setup](../../stack/clerk/README.md)
- → [Convex Integration](../../stack/convex/README.md)
- → [Webhooks](../../stack/clerk/webhook-setup.md)

## Core Pattern

### 1. Three-Layer Authentication

```typescript
// Layer 1: Next.js Middleware (Route Protection)
// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/api/webhooks(.*)"],
  afterAuth(auth, req) {
    // Custom logic after auth check
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }
});

// Layer 2: Client-Side (UI Protection)
// components/protected-content.tsx
"use client";
import { useConvexAuth } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export function ProtectedContent() {
  return (
    <>
      <AuthLoading>
        <LoadingSkeleton />
      </AuthLoading>

      <Authenticated>
        <SecretContent />
      </Authenticated>

      <Unauthenticated>
        <SignInPrompt />
      </Unauthenticated>
    </>
  );
}

// Layer 3: Database (Convex Functions)
// convex/tasks.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getMyTasks = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", q => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    return await ctx.db
      .query("tasks")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
  },
});
```

## User Sync Pattern

### ✅ GOOD: Webhook-Based User Sync

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export async function POST(req: Request) {
  // 1. Verify webhook signature
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  // 2. Handle different event types
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    // Create user in Convex
    await convex.mutation(api.users.create, {
      clerkId: id,
      email: email_addresses[0]?.email_address || "",
      firstName: first_name || "",
      lastName: last_name || "",
      imageUrl: image_url || "",
    });
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    // Update user in Convex
    await convex.mutation(api.users.update, {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url,
    });
  }

  if (eventType === "user.deleted") {
    // Soft delete or anonymize user data
    await convex.mutation(api.users.softDelete, {
      clerkId: evt.data.id!,
    });
  }

  return new Response("", { status: 200 });
}
```

### Convex User Mutations

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", q => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      ...args,
      name: `${args.firstName} ${args.lastName}`.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", q => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.email !== undefined) updates.email = args.email;
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;

    if (args.firstName !== undefined || args.lastName !== undefined) {
      updates.name = `${args.firstName || user.firstName} ${args.lastName || user.lastName}`.trim();
    }

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});
```

## Protected API Pattern

### ✅ GOOD: Secure Convex Functions

```typescript
// convex/_utils/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk", q => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
) {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user;
}

// Usage in queries/mutations
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./_utils/auth";

export const getPrivateData = query({
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Now we have authenticated user
    return await ctx.db
      .query("privateData")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
  },
});
```

## Session & Claims Pattern

### Custom Session Claims

```typescript
// In Clerk Dashboard: Configure session claims
{
  "userId": "{{user.id}}",
  "email": "{{user.primary_email_address}}",
  "metadata": {
    "role": "{{user.public_metadata.role}}",
    "plan": "{{user.public_metadata.plan}}",
    "permissions": "{{user.public_metadata.permissions}}"
  }
}

// Access in Next.js
import { auth } from "@clerk/nextjs/server";

export async function checkPermission(permission: string) {
  const { sessionClaims } = auth();
  const permissions = sessionClaims?.metadata?.permissions || [];

  return permissions.includes(permission);
}

// Access in Convex
export const adminOnlyAction = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity?.metadata?.role === "admin") {
      throw new Error("Admin access required");
    }

    // Admin logic here
  },
});
```

## Common Patterns

### 1. First-Time User Onboarding

```typescript
// app/onboarding/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user has completed onboarding
  const user = await getUserFromDatabase(userId);

  if (user?.onboarded) {
    redirect("/dashboard");
  }

  return <OnboardingFlow userId={userId} />;
}
```

### 2. Role-Based Access Control

```typescript
// convex/rbac.ts
import { mutation } from "./_generated/server";
import { requireAuth } from "./_utils/auth";

export const adminAction = mutation({
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Check role in database
    if (user.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Admin action here
  },
});

// UI Component
"use client";
import { useUser } from "@clerk/nextjs";

export function AdminPanel() {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  if (!isAdmin) {
    return null;
  }

  return <AdminContent />;
}
```

### 3. API Rate Limiting

```typescript
// convex/rateLimit.ts
import { mutation } from "./_generated/server";
import { requireAuth } from "./_utils/auth";

const RATE_LIMIT = 10; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export const rateLimitedAction = mutation({
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Check rate limit
    const recentRequests = await ctx.db
      .query("apiRequests")
      .withIndex("by_user_time", q =>
        q.eq("userId", user._id)
          .gte("timestamp", Date.now() - WINDOW_MS)
      )
      .collect();

    if (recentRequests.length >= RATE_LIMIT) {
      throw new Error("Rate limit exceeded");
    }

    // Log request
    await ctx.db.insert("apiRequests", {
      userId: user._id,
      timestamp: Date.now(),
      action: "rateLimitedAction",
    });

    // Perform action
    return { success: true };
  },
});
```

## Security Best Practices

### ✅ DO's
1. **Always verify webhooks** with signature validation
2. **Use Convex auth helpers** (Authenticated, useConvexAuth)
3. **Implement rate limiting** for sensitive actions
4. **Validate permissions** at the database level
5. **Use TypeScript** for type-safe auth flows

### ❌ DON'Ts
1. **Don't trust client-side** auth checks alone
2. **Don't store secrets** in public metadata
3. **Don't skip webhook** signature verification
4. **Don't expose internal** IDs to clients
5. **Don't cache auth** state incorrectly

## Troubleshooting

### Issue: User not syncing to Convex
- Check webhook endpoint URL in Clerk dashboard
- Verify webhook secret is set correctly
- Check Convex logs for errors

### Issue: Auth state mismatch
- Use `useConvexAuth()` instead of `useAuth()`
- Ensure providers are properly wrapped
- Check for hydration errors

→ See [Debugging Guide](../../workflows/debugging/auth-issues.md)

## Related Patterns
- 🔗 [Protected Routes](./protected-routes.md)
- 🔗 [User Permissions](./permissions.md)
- 🔗 [Social Login](../../stack/clerk/social-providers.md)

---

*This pattern ensures secure, synchronized authentication across all layers of your application. Always validate at every level for maximum security.*