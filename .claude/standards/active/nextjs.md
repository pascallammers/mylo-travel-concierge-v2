# Next.js Development Standards

**Version:** 1.0.0
**Last Updated:** 2025-11-13
**Framework:** Next.js 15.6.0-canary.25
**React:** 19.1.1

## Overview

This document defines the development standards for Next.js applications in this project. Following these standards ensures consistency, performance, and maintainability.

## App Router Architecture

### File Structure

```
app/
├── (auth)/              # Route group for auth pages
│   ├── login/
│   └── signup/
├── (dashboard)/         # Route group for dashboard
│   ├── layout.tsx       # Dashboard layout
│   └── page.tsx
├── api/                 # API routes
│   └── [...]/route.ts
├── layout.tsx           # Root layout
├── page.tsx             # Home page
└── globals.css          # Global styles
```

### Routing Conventions

**Route Groups:** Use parentheses for logical grouping without affecting URL structure
```typescript
// app/(dashboard)/settings/page.tsx
// URL: /settings (not /dashboard/settings)
```

**Dynamic Routes:** Use square brackets
```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <article>{params.slug}</article>
}
```

**Catch-all Routes:** Use spread syntax
```typescript
// app/docs/[...slug]/page.tsx
// Matches: /docs/a, /docs/a/b, /docs/a/b/c
```

## Server vs Client Components

### Default to Server Components

**Always use Server Components by default** - they are the default in Next.js 15 App Router.

```typescript
// ✅ Server Component (default)
// app/products/page.tsx
import { db } from '@/lib/db'

export default async function ProductsPage() {
  const products = await db.query.products.findMany()
  return <ProductList products={products} />
}
```

### When to Use Client Components

Add `'use client'` directive ONLY when you need:

1. **Interactivity:** Event handlers, state, effects
2. **Browser APIs:** window, localStorage, geolocation
3. **Hooks:** useState, useEffect, useContext
4. **Third-party libraries** that use client-only features

```typescript
// ✅ Client Component (when needed)
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### Component Composition Pattern

**Keep Client Components at the leaves of your component tree:**

```typescript
// ✅ Good: Server wrapper with Client leaf
// app/products/page.tsx (Server)
import { ProductFilters } from './product-filters'

export default async function ProductsPage() {
  const products = await db.query.products.findMany()

  return (
    <div>
      <h1>Products</h1>
      <ProductFilters /> {/* Client component */}
      <ProductList products={products} /> {/* Server component */}
    </div>
  )
}

// ❌ Bad: Entire page is client
'use client'
export default function ProductsPage() { ... }
```

## Data Fetching

### Server Components (Preferred)

**Fetch data directly in Server Components:**

```typescript
// ✅ Direct database queries in Server Components
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  })

  return <Profile user={user} />
}
```

### Parallel Data Fetching

```typescript
// ✅ Fetch data in parallel
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id)
])
```

### Client-Side Data Fetching (Tanstack Query)

**For client components, use Tanstack Query:**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

export function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then(r => r.json())
  })

  if (isLoading) return <UserSkeleton />
  return <div>{user.name}</div>
}
```

## API Routes

### Route Handlers

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive()
})

// GET /api/products
export async function GET(request: NextRequest) {
  try {
    const products = await db.query.products.findMany()
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = productSchema.parse(body)

    const product = await db.insert(products).values(validated).returning()

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route Handlers

```typescript
// app/api/products/[id]/route.ts
type Params = { params: { id: string } }

export async function GET(request: NextRequest, { params }: Params) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, params.id)
  })

  if (!product) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}
```

## Loading and Error States

### Loading UI

```typescript
// app/products/loading.tsx
export default function Loading() {
  return <ProductsSkeleton />
}
```

### Error Boundaries

```typescript
// app/products/error.tsx
'use client'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Not Found

```typescript
// app/products/[id]/not-found.tsx
import { notFound } from 'next/navigation'

export default function NotFound() {
  return <div>Product not found</div>
}

// Usage in page
export default async function ProductPage({ params }) {
  const product = await getProduct(params.id)
  if (!product) notFound()
  return <Product {...product} />
}
```

## Metadata & SEO

### Static Metadata

```typescript
// app/about/page.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about our company',
  openGraph: {
    title: 'About Us',
    description: 'Learn about our company',
    images: ['/og-about.jpg']
  }
}
```

### Dynamic Metadata

```typescript
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [post.coverImage]
    }
  }
}
```

## Performance Optimization

### Image Optimization

```typescript
import Image from 'next/image'

// ✅ Always use Next.js Image component
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={800}
  height={600}
  priority // For above-the-fold images
  placeholder="blur"
  blurDataURL="data:image/..."
/>
```

### Font Optimization

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono'
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### Streaming & Suspense

```typescript
import { Suspense } from 'react'

export default function ProductPage() {
  return (
    <div>
      <h1>Product Details</h1>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews /> {/* Slow component streams in */}
      </Suspense>
    </div>
  )
}
```

## Caching & Revalidation

### Static Generation (Default)

```typescript
// ✅ Default: Static at build time
export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}
```

### Revalidation

```typescript
// ✅ Revalidate every hour
export const revalidate = 3600

export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}
```

### Dynamic Rendering

```typescript
// ✅ Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function Page() {
  // Always fresh data
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store'
  })
  return <div>{data}</div>
}
```

### On-Demand Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')

  if (path) {
    revalidatePath(path)
    return NextResponse.json({ revalidated: true })
  }

  return NextResponse.json({ error: 'Missing path' }, { status: 400 })
}
```

## Server Actions (Experimental)

```typescript
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  const title = formData.get('title') as string
  const content = formData.get('content') as string

  await db.insert(posts).values({
    title,
    content,
    authorId: session.user.id
  })

  revalidatePath('/posts')
}
```

```typescript
// app/posts/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Environment Variables

```typescript
// lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    RESEND_API_KEY: z.string().min(1)
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url()
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  }
})
```

## Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check authentication
  const token = request.cookies.get('session')

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
```

## Best Practices

### 1. Use TypeScript Strictly

```typescript
// ✅ Type props properly
interface PageProps {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Page({ params, searchParams }: PageProps) {
  // ...
}
```

### 2. Colocate Related Files

```
app/products/
├── page.tsx           # Route
├── loading.tsx        # Loading UI
├── error.tsx          # Error UI
├── product-card.tsx   # Component
├── product-filters.tsx
└── actions.ts         # Server actions
```

### 3. Use Layouts for Shared UI

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### 4. Handle Loading States

```typescript
// ✅ Always show loading states
'use client'

export function ProductList() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts
  })

  if (isLoading) return <ProductsSkeleton />
  if (!data) return <EmptyState />

  return <div>{/* render products */}</div>
}
```

### 5. Validate All Inputs

```typescript
// ✅ Use Zod for validation
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = schema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten() },
      { status: 400 }
    )
  }

  // Process validated data
}
```

## Common Patterns

### Protected Routes

```typescript
// lib/auth-helpers.ts
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
  return session
}

// Usage in page
export default async function DashboardPage() {
  const session = await requireAuth()
  // ... rest of page
}
```

### Pagination

```typescript
export default async function PostsPage({
  searchParams
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1')
  const limit = 10

  const posts = await db.query.posts.findMany({
    limit,
    offset: (page - 1) * limit
  })

  return (
    <>
      <PostList posts={posts} />
      <Pagination page={page} />
    </>
  )
}
```

## Anti-Patterns

### ❌ Don't Use useEffect for Data Fetching in Server Components

```typescript
// ❌ Bad
'use client'
export default function Page() {
  const [data, setData] = useState()

  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData)
  }, [])
}

// ✅ Good: Server Component
export default async function Page() {
  const data = await fetch('/api/data').then(r => r.json())
  return <div>{data}</div>
}
```

### ❌ Don't Make Entire Pages Client Components

```typescript
// ❌ Bad: Unnecessary 'use client'
'use client'
export default function Page() {
  return <div>Static content</div>
}

// ✅ Good: Server Component by default
export default function Page() {
  return <div>Static content</div>
}
```

### ❌ Don't Import Server Code in Client Components

```typescript
// ❌ Bad: Importing server code
'use client'
import { db } from '@/lib/db' // Error: Cannot import server code

// ✅ Good: Use API route or pass as prop
'use client'
export function ClientComponent({ data }: { data: Data }) {
  return <div>{data}</div>
}
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [React 19 Documentation](https://react.dev)
- [Vercel Deployment Guide](https://vercel.com/docs)
