# 🚀 Project Setup Workflow

## Overview
Complete step-by-step guide for setting up a new project with our standard tech stack: Next.js, Convex, Clerk, ShadCN UI, and Tailwind CSS.

## Quick Links
- ⚡ [Quick Start](#quick-start)
- 📋 [Detailed Setup](#detailed-setup)
- ✅ [Setup Checklist](./checklist.md)
- 🔧 [Configuration Files](./config-files.md)
- 🐛 [Common Issues](#common-issues)

## Quick Start

### Complete Setup Script
```bash
# 1. Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest my-app \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd my-app

# 2. Initialize project structure
npx ultracite init

# 3. Initialize ShadCN UI
npx shadcn@latest init

# 4. Add all ShadCN components
npx shadcn@latest add --all

# 5. Install Convex
npm install convex

# 6. Install Clerk
npm install @clerk/nextjs

# 7. Additional dependencies
npm install next-themes sonner lucide-react

# 8. Form handling
npm install react-hook-form zod @hookform/resolvers

# 9. Initialize Convex
npx convex dev
```

## Detailed Setup

### Step 1: Create Next.js Application

```bash
npx create-next-app@latest my-app
```

**Choose these options:**
- ✅ TypeScript: Yes
- ✅ ESLint: Yes
- ✅ Tailwind CSS: Yes
- ✅ `src/` directory: No
- ✅ App Router: Yes
- ✅ Import alias: Yes (@/*)

### Step 2: Project Structure Setup

```bash
cd my-app

# Create folder structure
mkdir -p components/{ui,forms,layout,shared}
mkdir -p lib
mkdir -p hooks
mkdir -p types
mkdir -p app/{(auth),(dashboard),api/webhooks}
```

### Step 3: Configure ShadCN UI

```bash
npx shadcn@latest init
```

**Configuration prompts:**
- Style: Default or New York (recommended: New York)
- Base color: Slate (or your preference)
- CSS variables: Yes

**Add essential components:**
```bash
# Core components
npx shadcn@latest add button card dialog form input label

# Navigation
npx shadcn@latest add navigation-menu dropdown-menu

# Feedback
npx shadcn@latest add toast alert alert-dialog

# Data display
npx shadcn@latest add table tabs

# Or add all at once
npx shadcn@latest add --all
```

### Step 4: Setup Convex Backend

```bash
# Install Convex
npm install convex

# Initialize Convex project
npx convex dev
```

**This will:**
1. Create a `convex/` directory
2. Generate TypeScript types
3. Start the development server
4. Open the Convex dashboard

**Create initial schema:**
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_email", ["email"]),
});
```

### Step 5: Configure Clerk Authentication

```bash
# Install Clerk
npm install @clerk/nextjs

# Install Convex-Clerk integration
npm install convex-dev@latest
```

**Setup environment variables:**
```bash
# .env.local
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Convex
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
```

**Configure Clerk in Convex:**
```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
```

### Step 6: Create Provider Components

```typescript
// app/providers.tsx
"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Step 7: Configure Root Layout

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My App",
  description: "Built with Next.js, Convex, and Clerk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Step 8: Setup Middleware

```typescript
// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/api/webhooks(.*)",
    "/sign-in",
    "/sign-up",
  ],
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
```

### Step 9: Create Authentication Pages

```typescript
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}

// app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

### Step 10: Configure Webhooks

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export async function POST(req: Request) {
  // Verify webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
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
    return new Response("Error: Invalid signature", {
      status: 400,
    });
  }

  const eventType = evt.type;

  // Handle user creation/update
  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    await convex.mutation(api.users.upsert, {
      clerkId: id,
      email: email_addresses[0]?.email_address || "",
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      imageUrl: image_url,
    });
  }

  return new Response("", { status: 200 });
}
```

## Configuration Files

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

module.exports = nextConfig;
```

### tailwind.config.ts
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... rest of ShadCN colors
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## Verification Steps

### ✅ Development Server Check
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Convex
npx convex dev

# Both should run without errors
```

### ✅ Authentication Flow Test
1. Navigate to `/sign-up`
2. Create an account
3. Check Convex dashboard for user creation
4. Sign out and sign in again

### ✅ Component Library Test
```typescript
// app/test/page.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TestPage() {
  return (
    <Card className="p-6">
      <h1>Component Test</h1>
      <Button>Test Button</Button>
    </Card>
  );
}
```

## Common Issues

### Issue: Clerk webhook not working
**Solution:** Ensure webhook URL ends with `/api/webhooks/clerk` and webhook secret is set correctly.

### Issue: Convex types not generating
**Solution:** Make sure `npx convex dev` is running and schema.ts is valid.

### Issue: Hydration errors
**Solution:** Add `suppressHydrationWarning` to html tag and check for client-only code in server components.

### Issue: ShadCN components not styled
**Solution:** Ensure `globals.css` imports Tailwind directives and is imported in layout.tsx.

## Project Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "convex": "convex dev",
    "setup": "npm install && npx convex dev"
  }
}
```

## Optional Additions

### Supabase (if needed)
→ See [Supabase Setup](../../stack/supabase/)

### Testing Setup
```bash
npm install -D @testing-library/react @testing-library/jest-dom jest
```

### Analytics
```bash
npm install @vercel/analytics
```

## Next Steps

After setup is complete:
1. ✅ Test authentication flow
2. ✅ Verify Convex connection
3. ✅ Check component rendering
4. ✅ Set up Git repository
5. ✅ Deploy to Vercel

→ Continue to [Feature Development](../feature-development/)

---

*This setup provides a solid foundation for building production-ready applications with our tech stack. Each step is essential for proper integration.*