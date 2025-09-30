# 🛠️ Tech Stack Overview

## Core Stack Components

### Frontend Framework
**Next.js 14+ (App Router)**
- Server Components by default
- Client Components for interactivity
- Built-in optimization and caching
- TypeScript-first development

### Backend & Database
**Convex (Primary)**
- Real-time subscriptions
- Type-safe API
- Built-in file storage
- Automatic scaling

**Supabase (Optional)**
- When PostgreSQL is required
- For existing Supabase projects
- Advanced SQL queries needed
- Row-level security requirements

### Authentication
**Clerk**
- Social logins (Google, GitHub, etc.)
- Magic links
- Multi-factor authentication
- Webhook integration with backend

### UI & Styling
**Tailwind CSS**
- Utility-first styling
- Responsive design system
- Dark mode support
- Custom design tokens

**ShadCN UI**
- Radix UI primitives
- Accessible components
- Copy-paste component library
- Customizable with Tailwind

### Deployment
**Vercel**
- Automatic deployments
- Edge functions
- Analytics and monitoring
- Preview deployments

### Development Tools
**Ultracite**
- Project scaffolding
- Quick setup automation

**TypeScript**
- Type safety throughout
- Better IDE support
- Reduced runtime errors

## 🎯 Stack Decision Matrix

### When to Use Convex
```typescript
// ✅ GOOD: Real-time features
const messages = useQuery(api.messages.list);

// ✅ GOOD: File uploads with automatic optimization
const uploadUrl = useMutation(api.files.generateUploadUrl);

// ✅ GOOD: Optimistic updates
const updateTask = useMutation(api.tasks.update);
```

### When to Add Supabase
```typescript
// ✅ GOOD: Complex SQL queries
const { data } = await supabase
  .from('products')
  .select('*, categories(*)')
  .gte('price', 100)
  .order('created_at');

// ✅ GOOD: Existing PostgreSQL data
// ✅ GOOD: Need for database functions/triggers
```

## 📦 Package Versions

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "convex": "^1.0.0",
    "@clerk/nextjs": "^5.0.0",
    "@clerk/themes": "^2.0.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.300.0",
    "@supabase/supabase-js": "^2.39.0" // Optional
  }
}
```

## 🚀 Project Setup Commands

```bash
# Initial setup (complete flow)
npx create-next-app@latest my-app --typescript --tailwind --app
cd my-app
npx ultracite init

# UI Components
npx shadcn@latest init
npx shadcn@latest add --all

# Backend
npm install convex
npx convex dev

# Authentication
npm install @clerk/nextjs

# Optional: Supabase
npm install @supabase/supabase-js
```

## 🏗️ Project Structure

```
my-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── api/               # API routes (if needed)
├── components/            # React components
│   ├── ui/               # ShadCN components
│   └── custom/           # Custom components
├── convex/               # Convex backend
│   ├── schema.ts         # Database schema
│   ├── _generated/       # Generated types
│   └── *.ts             # API functions
├── lib/                  # Utilities
│   └── utils.ts         # Helper functions
├── public/              # Static assets
└── styles/              # Global styles
    └── globals.css      # Tailwind imports
```

## ⚙️ Configuration Files

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "*.convex.cloud",
      },
      {
        hostname: "img.clerk.com",
      },
    ],
  },
};
```

### .env.local
```bash
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 🔗 Integration Points

### Clerk + Convex
→ See [Clerk Integration Guide](./stack/clerk/convex-integration.md)

### Next.js + Convex
→ See [Next.js Convex Patterns](./stack/nextjs-convex/README.md)

### ShadCN + Forms
→ See [Form Patterns](./patterns/ui-patterns/forms.md)

## 🎨 Design System

### Tailwind Config
```javascript
// tailwind.config.ts
{
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ... ShadCN color system
      },
    },
  },
}
```

## 📝 Best Practices

### ✅ DO's
- Use Server Components by default
- Implement optimistic updates for better UX
- Type everything with TypeScript
- Use Convex for real-time features
- Leverage ShadCN for consistent UI

### ❌ DON'Ts
- Don't mix Convex and Supabase unnecessarily
- Avoid client-side data fetching when possible
- Don't bypass Clerk for authentication
- Never commit environment variables
- Avoid custom CSS when Tailwind utilities exist

## 🔍 Common Patterns

1. **Authentication Flow**
   → [Clerk + Convex Auth](./patterns/authentication/clerk-convex.md)

2. **Data Fetching**
   → [Convex Queries & Mutations](./stack/convex/mutations-queries.md)

3. **Form Handling**
   → [ShadCN Forms with Validation](./patterns/ui-patterns/forms.md)

4. **Real-time Updates**
   → [Convex Subscriptions](./stack/convex/real-time.md)

---

*This stack is optimized for rapid development, type safety, and excellent developer experience. Each component is chosen for its specific strengths and seamless integration with the others.*