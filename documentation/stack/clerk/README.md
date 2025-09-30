# 🔐 Clerk Authentication Documentation

## Overview
Clerk provides complete user management and authentication for our applications, with seamless integration into Next.js and Convex.

## Quick Links
- 🚀 [Setup & Configuration](#setup)
- 🔗 [Convex Integration](./convex-integration.md)
- 🛡️ [Middleware & Protection](./middleware.md)
- 👥 [User Management](./user-management.md)
- 🔑 [Social Providers](./social-providers.md)
- 📚 [Examples](./examples/)

## Setup

### 1. Installation
```bash
npm install @clerk/nextjs
```

### 2. Environment Variables
```bash
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs (customize as needed)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### 3. Middleware Setup
```typescript
// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    "/",
    "/about",
    "/pricing",
    "/api/webhooks(.*)",
  ],

  // Routes that should be ignored by Clerk
  ignoredRoutes: [
    "/api/health",
    "/api/metrics",
  ],

  // Custom redirect logic
  afterAuth(auth, req) {
    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // Redirect users to onboarding if needed
    if (auth.userId && !auth.sessionClaims?.onboarded) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## Integration Patterns

### ✅ GOOD: Provider Setup with Convex
```typescript
// app/providers.tsx
"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#6B46C1",
          borderRadius: "0.5rem",
        },
        elements: {
          formButtonPrimary: "bg-primary hover:bg-primary/90",
          card: "shadow-none",
        },
      }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### ❌ BAD: Common Mistakes
```typescript
// ❌ BAD: Not wrapping with ClerkProvider
export function App() {
  const { userId } = useAuth(); // ERROR: No ClerkProvider
  return <div>...</div>;
}

// ❌ BAD: Using Clerk in server components incorrectly
"use client"; // Should be server component
import { currentUser } from "@clerk/nextjs/server";

// ❌ BAD: Not handling loading states
export function Profile() {
  const { user } = useUser();
  return <div>{user.firstName}</div>; // user might be undefined
}
```

## Authentication Flows

### 1. Server-Side Authentication
```typescript
// ✅ GOOD: Server component auth
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <p>Email: {user?.primaryEmailAddress?.emailAddress}</p>
    </div>
  );
}
```

### 2. Client-Side Authentication
```typescript
// ✅ GOOD: Client component with hooks
"use client";

import { useUser, useAuth, SignInButton, UserButton } from "@clerk/nextjs";

export function Navigation() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <nav>
        <SignInButton mode="modal">
          <button className="btn-primary">Sign In</button>
        </SignInButton>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-4">
      <span>Hello, {user.firstName}</span>
      <UserButton afterSignOutUrl="/" />
    </nav>
  );
}
```

### 3. Custom Sign In/Up Pages
```typescript
// ✅ GOOD: Custom auth pages
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-white shadow-xl",
          },
        }}
        redirectUrl="/dashboard"
      />
    </div>
  );
}

// app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-white shadow-xl",
          },
        }}
        redirectUrl="/onboarding"
      />
    </div>
  );
}
```

## User Management

### Syncing with Database
```typescript
// ✅ GOOD: Webhook to sync users with Convex
// app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  // Get headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id!,
      "svix-timestamp": svix_timestamp!,
      "svix-signature": svix_signature!,
    }) as WebhookEvent;
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  // Handle events
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    await convex.mutation(api.users.upsert, {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url,
    });
  }

  if (eventType === "user.deleted") {
    await convex.mutation(api.users.remove, {
      clerkId: evt.data.id!,
    });
  }

  return new Response("", { status: 200 });
}
```

### User Profile Management
```typescript
// ✅ GOOD: Update user profile
"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";

export function ProfileForm() {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");

  if (!isLoaded || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await user.update({
        firstName,
        lastName,
      });

      toast.success("Profile updated!");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
      />
      <input
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Last name"
      />
      <button type="submit">Save</button>
    </form>
  );
}
```

## Protected API Routes

### Route Handlers
```typescript
// ✅ GOOD: Protected API route
// app/api/protected/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Your protected logic here
  return NextResponse.json({ message: "Protected data" });
}
```

### Server Actions
```typescript
// ✅ GOOD: Protected server action
"use server";

import { auth } from "@clerk/nextjs/server";

export async function deleteAccount() {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Delete user data
  await deleteUserData(userId);

  // Delete Clerk account
  await clerkClient.users.deleteUser(userId);
}
```

## Social Login Configuration

### OAuth Providers
```typescript
// ✅ GOOD: Social login buttons
"use client";

import { useSignIn } from "@clerk/nextjs";

export function SocialLogin() {
  const { signIn, isLoaded } = useSignIn();

  if (!isLoaded) return null;

  async function signInWith(strategy: "oauth_google" | "oauth_github") {
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (error) {
      console.error("OAuth error:", error);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => signInWith("oauth_google")}
        className="btn-oauth"
      >
        <GoogleIcon />
        Continue with Google
      </button>
      <button
        onClick={() => signInWith("oauth_github")}
        className="btn-oauth"
      >
        <GithubIcon />
        Continue with GitHub
      </button>
    </div>
  );
}
```

## Session Management

### Custom Session Claims
```typescript
// ✅ GOOD: Add custom claims
// In Clerk Dashboard → Sessions → Edit

{
  "metadata": {
    "role": "{{user.public_metadata.role}}",
    "plan": "{{user.public_metadata.plan}}",
    "onboarded": "{{user.public_metadata.onboarded}}"
  }
}

// Access in your app
const { sessionClaims } = auth();
const role = sessionClaims?.metadata?.role;
```

## Best Practices

### ✅ DO's
1. **Always handle loading states** for user data
2. **Use middleware** for route protection
3. **Implement webhooks** to sync user data
4. **Customize appearance** to match your brand
5. **Use TypeScript** for better type safety

### ❌ DON'Ts
1. **Don't store sensitive data** in public metadata
2. **Don't skip webhook verification**
3. **Don't use client-side auth** for sensitive operations
4. **Don't hardcode** Clerk URLs
5. **Don't ignore** error states

## Troubleshooting

### Common Issues
- **"useAuth must be wrapped in ClerkProvider"**: Add ClerkProvider to layout
- **Middleware not working**: Check matcher configuration
- **Webhooks failing**: Verify endpoint URL and secret
- **Social login errors**: Check OAuth app configuration

→ See [Debugging Guide](../../workflows/debugging/clerk-issues.md)

## Related Documentation
- 🔗 [Convex Integration](./convex-integration.md)
- 🔗 [Next.js Setup](../nextjs-convex/README.md)
- 🔗 [Authentication Patterns](../../patterns/authentication/)
- 🔗 [User Management](./user-management.md)

---

*Clerk provides robust authentication with minimal setup. Always prioritize security, handle edge cases, and provide smooth user experiences.*