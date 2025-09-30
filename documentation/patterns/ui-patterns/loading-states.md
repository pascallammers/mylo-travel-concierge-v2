# ⏳ Loading States & Skeletons Pattern

## Overview
Implement responsive loading states, skeleton screens, and progressive enhancement for optimal perceived performance in Next.js applications.

## Quick Links
- → [ShadCN Skeleton](../../stack/ui-components/shadcn-setup.md)
- → [Next.js Suspense](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- → [React Suspense Patterns](#suspense-patterns)
- → [Convex Loading States](../../stack/convex/README.md)

## Core Pattern

### Basic Loading States

```typescript
// ✅ GOOD: Comprehensive loading states
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function DataDisplay() {
  const data = useQuery(api.items.list);

  // Loading state
  if (data === undefined) {
    return <DataSkeleton />;
  }

  // Empty state
  if (data.length === 0) {
    return <EmptyState />;
  }

  // Error state (handled by error boundary)
  // Data state
  return (
    <div className="space-y-4">
      {data.map(item => (
        <ItemCard key={item._id} item={item} />
      ))}
    </div>
  );
}

// Skeleton component matching actual content structure
function DataSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <Skeleton className="h-6 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">No items found</p>
      <Button className="mt-4">Create your first item</Button>
    </div>
  );
}
```

## Suspense Patterns

### 1. Page-Level Suspense

```typescript
// ✅ GOOD: Suspense boundary with loading UI
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<DashboardSkeleton />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}

// components/dashboard-skeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-6">
            <Skeleton className="h-4 w-[100px] mb-2" />
            <Skeleton className="h-8 w-[80px]" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-[150px]" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px] ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 2. Component-Level Suspense

```typescript
// ✅ GOOD: Granular suspense boundaries
"use client";

import { Suspense, use } from "react";

// Parent component
export function Dashboard() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Suspense fallback={<StatCardSkeleton />}>
          <StatCard type="users" />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <StatCard type="revenue" />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <StatCard type="orders" />
        </Suspense>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  );
}

// Async component
async function StatCard({ type }: { type: string }) {
  const data = await fetchStatData(type);

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground">
        {data.title}
      </h3>
      <p className="text-2xl font-bold mt-2">{data.value}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {data.change > 0 ? '+' : ''}{data.change}% from last month
      </p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="border rounded-lg p-6">
      <Skeleton className="h-4 w-[100px] mb-2" />
      <Skeleton className="h-8 w-[80px]" />
      <Skeleton className="h-3 w-[120px] mt-2" />
    </div>
  );
}
```

### 3. Streaming with Server Components

```typescript
// ✅ GOOD: Progressive data loading
// app/products/page.tsx
import { Suspense } from 'react';

export default function ProductsPage() {
  return (
    <div>
      {/* Critical content loads first */}
      <ProductFilters />

      {/* Stream in product list */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductList />
      </Suspense>

      {/* Low-priority content */}
      <Suspense fallback={<div className="h-20" />}>
        <RecommendedProducts />
      </Suspense>
    </div>
  );
}

async function ProductList() {
  const products = await fetchProducts(); // This can be slow

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

## Advanced Loading Patterns

### 1. Staggered Skeleton Animation

```typescript
// ✅ GOOD: Animated skeleton with stagger effect
export function StaggeredSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

// With Framer Motion
import { motion } from "framer-motion";

export function AnimatedSkeleton() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {[...Array(5)].map((_, i) => (
        <motion.div key={i} variants={item}>
          <Skeleton className="h-20 w-full" />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### 2. Optimistic Loading States

```typescript
// ✅ GOOD: Show immediate feedback
"use client";

import { useState, useTransition } from "react";

export function OptimisticButton() {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleAction() {
    startTransition(async () => {
      try {
        await performAction();
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 2000);
      } catch (error) {
        toast.error("Action failed");
      }
    });
  }

  return (
    <Button
      onClick={handleAction}
      disabled={isPending}
      className="min-w-[120px]"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : isSuccess ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Success!
        </>
      ) : (
        "Perform Action"
      )}
    </Button>
  );
}
```

### 3. Infinite Scroll with Loading

```typescript
// ✅ GOOD: Infinite scroll with loading indicator
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";

export function InfiniteList() {
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
    getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  if (status === "loading") {
    return <ListSkeleton />;
  }

  return (
    <>
      <div className="space-y-4">
        {data?.pages.map((page, i) => (
          <div key={i}>
            {page.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>

      {/* Loading trigger */}
      <div ref={ref} className="py-4">
        {isFetchingNextPage ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : hasNextPage ? (
          <div className="text-center text-muted-foreground">
            Scroll for more
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            No more items
          </div>
        )}
      </div>
    </>
  );
}
```

### 4. Progressive Image Loading

```typescript
// ✅ GOOD: Image with blur placeholder
"use client";

import Image from "next/image";
import { useState } from "react";

export function ProgressiveImage({
  src,
  alt,
  blurDataURL,
}: {
  src: string;
  alt: string;
  blurDataURL?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative overflow-hidden bg-muted">
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10" />
      )}
      <Image
        src={src}
        alt={alt}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
        onLoadingComplete={() => setIsLoading(false)}
        className={`
          duration-700 ease-in-out
          ${isLoading ? "scale-110 blur-lg" : "scale-100 blur-0"}
        `}
      />
    </div>
  );
}
```

## Loading State Variations

### 1. Inline Loading

```typescript
// ✅ GOOD: Non-blocking inline updates
export function InlineEditableField() {
  const [isSaving, setIsSaving] = useState(false);
  const [value, setValue] = useState("Initial value");

  async function handleSave(newValue: string) {
    setIsSaving(true);
    setValue(newValue);

    try {
      await saveValue(newValue);
    } catch (error) {
      setValue(value); // Rollback
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => handleSave(value)}
        disabled={isSaving}
      />
      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  );
}
```

### 2. Backdrop Loading

```typescript
// ✅ GOOD: Loading overlay without blocking UI
export function LoadingOverlay({ isLoading, children }) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
}
```

### 3. Progress Indicators

```typescript
// ✅ GOOD: Show actual progress
export function UploadProgress() {
  const [progress, setProgress] = useState(0);

  async function handleUpload(file: File) {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        setProgress(percentComplete);
      }
    });

    // Upload logic...
  }

  return (
    <div className="space-y-2">
      <Progress value={progress} />
      <p className="text-sm text-muted-foreground">
        Uploading... {Math.round(progress)}%
      </p>
    </div>
  );
}
```

## Performance Optimization

### 1. Lazy Loading Components

```typescript
// ✅ GOOD: Code splitting with lazy loading
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export function OptimizedPage() {
  const [showHeavy, setShowHeavy] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowHeavy(true)}>
        Load Heavy Component
      </Button>

      {showHeavy && (
        <Suspense fallback={<ComponentSkeleton />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
}
```

### 2. Preloading Data

```typescript
// ✅ GOOD: Preload data on hover
export function PreloadLink({ href, children }) {
  const router = useRouter();

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  return (
    <Link href={href} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

## Best Practices

### ✅ DO's
1. **Match skeleton structure** to actual content
2. **Show progress** when possible (uploads, multi-step)
3. **Use transitions** for smooth loading states
4. **Implement error boundaries** for failed loads
5. **Preload critical resources** for faster perceived load

### ❌ DON'Ts
1. **Don't block entire UI** unnecessarily
2. **Don't show spinners** for < 300ms loads
3. **Don't forget empty states** when no data
4. **Don't mix loading patterns** inconsistently
5. **Don't skip error states** in loading flows

## Testing Loading States

```typescript
// Test loading states
describe("LoadingStates", () => {
  it("should show skeleton while loading", () => {
    render(<DataDisplay />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("should show data after loading", async () => {
    render(<DataDisplay />);
    await waitFor(() => {
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });
  });

  it("should handle loading errors", async () => {
    mockApi.mockRejectedValue(new Error("Failed to load"));
    render(<DataDisplay />);
    await waitFor(() => {
      expect(screen.getByText("Error loading data")).toBeInTheDocument();
    });
  });
});
```

## Related Patterns
- 🔗 [Optimistic Updates](../data-management/optimistic-updates.md)
- 🔗 [Error Handling](../error-handling/README.md)
- 🔗 [Data Tables](./data-tables.md)
- 🔗 [Real-time Updates](../data-management/real-time.md)

---

*Great loading states make the difference between a frustrating and delightful user experience. Always provide visual feedback and handle all states gracefully.*