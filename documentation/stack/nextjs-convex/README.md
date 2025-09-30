# 🔗 Next.js + Convex Integration Guide

## Overview
Complete guide for integrating Next.js App Router with Convex, including server/client components, data fetching patterns, and real-time subscriptions.

## Quick Links
- 🚀 [Setup & Configuration](#setup)
- 🎯 [Server vs Client Components](#server-vs-client-components)
- 📊 [Data Fetching Patterns](./data-fetching.md)
- ⚡ [Real-time Updates](./real-time-updates.md)
- 🔐 [Authentication Flow](#authentication-flow)
- 📚 [Examples](./examples/)

## Setup

### 1. Install Dependencies
```bash
npm install convex @clerk/nextjs
```

### 2. Configure Providers
```typescript
// app/providers.tsx
"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### 3. Root Layout Setup
```typescript
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Server vs Client Components

### Decision Matrix
```typescript
// ✅ Server Component (default)
// When to use:
// - Static content
// - SEO-critical pages
// - Initial data loading
// - Secret API calls

// app/posts/page.tsx
import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";
import PostList from "./PostList";

export default async function PostsPage() {
  // Preload data on server
  const preloadedPosts = await preloadQuery(api.posts.list);

  return (
    <div>
      <h1>Posts</h1>
      <PostList preloadedPosts={preloadedPosts} />
    </div>
  );
}

// ✅ Client Component
// When to use:
// - Interactive UI
// - Real-time updates
// - User events
// - Browser APIs

// app/posts/PostList.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Preloaded } from "convex/nextjs";

export default function PostList({
  preloadedPosts,
}: {
  preloadedPosts: Preloaded<typeof api.posts.list>;
}) {
  // Use preloaded data, subscribe to updates
  const posts = useQuery(api.posts.list, {}, {
    preloadedData: preloadedPosts
  });

  return (
    <ul>
      {posts?.map(post => (
        <li key={post._id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### ❌ Common Mistakes
```typescript
// ❌ BAD: Using hooks in server components
// app/page.tsx
import { useQuery } from "convex/react"; // ERROR!

export default function Page() {
  const data = useQuery(api.data.get); // Won't work
  return <div>{data}</div>;
}

// ❌ BAD: Async client component
"use client";
// Client components can't be async
export default async function Component() { // ERROR!
  const data = await fetch("/api/data");
  return <div>{data}</div>;
}

// ❌ BAD: Not using Suspense with async components
// Missing loading states
export default async function Page() {
  const data = await loadData(); // No Suspense boundary
  return <div>{data}</div>;
}
```

## Data Fetching Patterns

### 1. Server-Side Preloading
```typescript
// ✅ GOOD: Preload + Subscribe pattern
// app/dashboard/page.tsx
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const preloadedData = await preloadQuery(
    api.users.getDashboard,
    { userId }
  );

  return <Dashboard preloadedData={preloadedData} />;
}

// app/dashboard/Dashboard.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Dashboard({ preloadedData }) {
  // Hydrate with preloaded, subscribe to updates
  const data = useQuery(
    api.users.getDashboard,
    { userId },
    { preloadedData }
  );

  return <div>{/* Dashboard UI */}</div>;
}
```

### 2. Optimistic Updates
```typescript
// ✅ GOOD: Optimistic UI updates
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useOptimistic } from "react";

export function TodoList({ todos }) {
  const addTodo = useMutation(api.todos.add);
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, newTodo]
  );

  async function handleAdd(text: string) {
    const tempTodo = {
      _id: `temp-${Date.now()}`,
      text,
      completed: false,
    };

    // Update UI immediately
    addOptimisticTodo(tempTodo);

    // Then sync with backend
    await addTodo({ text });
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo._id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

### 3. Parallel Data Loading
```typescript
// ✅ GOOD: Load multiple queries in parallel
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function ProfilePage({ params }) {
  // Parallel loading
  const [user, posts, followers] = await Promise.all([
    preloadQuery(api.users.get, { id: params.id }),
    preloadQuery(api.posts.byUser, { userId: params.id }),
    preloadQuery(api.followers.list, { userId: params.id }),
  ]);

  return (
    <Profile
      user={user}
      posts={posts}
      followers={followers}
    />
  );
}
```

## Authentication Flow

### Protected Pages
```typescript
// ✅ GOOD: Server-side auth check
// app/protected/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch user-specific data
  const data = await preloadQuery(
    api.users.private,
    { userId }
  );

  return <ProtectedContent data={data} />;
}
```

### Middleware Protection
```typescript
// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/about", "/api/webhooks(.*)"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## File Structure Best Practices

```
app/
├── (auth)/                  # Auth group
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/             # Protected group
│   ├── layout.tsx          # Auth wrapper
│   ├── dashboard/
│   └── settings/
├── api/
│   └── webhooks/
│       └── clerk/          # Clerk webhooks
└── _components/            # Shared components
    ├── providers.tsx       # Convex + Clerk
    └── ui/                # UI components

convex/
├── users/
│   ├── queries.ts
│   └── mutations.ts
├── posts/
│   ├── queries.ts
│   ├── mutations.ts
│   └── actions.ts
└── _utils/
    └── auth.ts            # Auth helpers
```

## Common Patterns

### Loading States
```typescript
// ✅ GOOD: Proper loading states
"use client";

import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";

export function DataDisplay() {
  const data = useQuery(api.data.get);

  // Convex returns undefined while loading
  if (data === undefined) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (data === null) {
    return <div>No data found</div>;
  }

  return <div>{data.content}</div>;
}
```

### Error Boundaries
```typescript
// ✅ GOOD: Error handling
"use client";

import { useQuery } from "convex/react";
import { ErrorBoundary } from "react-error-boundary";

function DataComponent() {
  const data = useQuery(api.data.get);

  if (data?.error) {
    throw new Error(data.error);
  }

  return <div>{data?.content}</div>;
}

export function SafeDataDisplay() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <DataComponent />
    </ErrorBoundary>
  );
}
```

## Performance Optimization

### 1. Streaming & Suspense
```typescript
// ✅ GOOD: Progressive loading
import { Suspense } from "react";

export default function Layout({ children }) {
  return (
    <div>
      <Header /> {/* Loads immediately */}
      <Suspense fallback={<Loading />}>
        {children} {/* Streams when ready */}
      </Suspense>
    </div>
  );
}
```

### 2. Static Generation
```typescript
// ✅ GOOD: Static pages where possible
export const revalidate = 3600; // Revalidate every hour

export default async function BlogPost({ params }) {
  const post = await preloadQuery(
    api.posts.getPublished,
    { slug: params.slug }
  );

  return <Article post={post} />;
}
```

## Troubleshooting

### Common Issues
- **Hydration Errors**: Check server/client component boundaries
- **Missing Updates**: Ensure ConvexProvider wraps components
- **Auth Issues**: Verify Clerk + Convex integration

→ See [Debugging Guide](../../workflows/debugging/)

## Related Documentation
- 🔗 [Convex Setup](../convex/README.md)
- 🔗 [Clerk Integration](../clerk/README.md)
- 🔗 [Data Fetching Patterns](./data-fetching.md)
- 🔗 [Real-time Features](./real-time-updates.md)

---

*This integration provides the foundation for type-safe, real-time applications. Always consider server vs client trade-offs and optimize for user experience.*