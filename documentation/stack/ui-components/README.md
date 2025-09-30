# 🎨 ShadCN UI + Tailwind CSS Documentation

## Overview
ShadCN UI provides copy-paste React components built on Radix UI primitives with Tailwind CSS styling. Components are owned by you, not installed as dependencies.

## Quick Links
- 🚀 [Setup & Installation](#setup)
- 🎯 [Component Patterns](./component-patterns.md)
- 📝 [Form Handling](./forms.md)
- 🌙 [Theming & Dark Mode](./theming.md)
- 📱 [Responsive Design](./responsive.md)
- ♿ [Accessibility](./accessibility.md)
- 📚 [Examples](./examples/)

## Setup

### 1. Prerequisites
```bash
# Ensure Next.js and Tailwind are installed
npx create-next-app@latest my-app --typescript --tailwind --app
```

### 2. Initialize ShadCN
```bash
# Initialize ShadCN UI
npx shadcn@latest init

# Answer prompts:
# - Style: Default or New York
# - Base color: Slate, Gray, Zinc, Neutral, Stone
# - CSS variables: Yes (recommended)
```

### 3. Install Components
```bash
# Install individual components
npx shadcn@latest add button
npx shadcn@latest add form
npx shadcn@latest add dialog

# Or install all components
npx shadcn@latest add --all
```

### 4. Project Structure
```
components/
├── ui/                      # ShadCN components (don't edit directly)
│   ├── button.tsx
│   ├── dialog.tsx
│   └── form.tsx
├── forms/                   # Your form components
│   ├── user-form.tsx
│   └── settings-form.tsx
├── layout/                  # Layout components
│   ├── header.tsx
│   ├── sidebar.tsx
│   └── footer.tsx
└── shared/                  # Reusable business components
    ├── user-avatar.tsx
    └── data-table.tsx
```

## Component Patterns

### ✅ GOOD: Server Components First
```tsx
// app/dashboard/page.tsx - Server Component
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import InteractiveSection from "./interactive-section";

export default async function DashboardPage() {
  // Server-side data fetching
  const data = await fetchDashboardData();

  return (
    <div className="container py-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back!</p>

        {/* Static UI with ShadCN components */}
        <Button variant="outline" className="mt-4">
          View Details
        </Button>
      </Card>

      {/* Interactive parts in client component */}
      <InteractiveSection initialData={data} />
    </div>
  );
}
```

### ✅ GOOD: Component Composition
```tsx
// Compose components for reusability
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### ❌ BAD: Anti-Patterns
```tsx
// ❌ BAD: Modifying UI components directly
// Never edit files in components/ui/

// ❌ BAD: Business logic in UI components
export function Button({ onClick }) {
  const handleClick = async () => {
    // Don't put API calls here
    await fetch("/api/data");
    onClick();
  };
  return <button onClick={handleClick}>Click</button>;
}

// ❌ BAD: Inline styles instead of Tailwind
<Button style={{ backgroundColor: "blue", padding: "10px" }}>
  Bad Practice
</Button>

// ❌ BAD: Not using component variants
<Button className="bg-red-500 hover:bg-red-600">
  Use variant="destructive" instead
</Button>
```

## Form Handling with React Hook Form + Zod

### ✅ GOOD: Type-Safe Forms
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// 1. Define schema first
const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  age: z.number().min(18, {
    message: "You must be at least 18 years old.",
  }),
});

// 2. Infer TypeScript type from schema
type FormData = z.infer<typeof formSchema>;

export function ProfileForm() {
  // 3. Initialize form with zodResolver
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      age: 18,
    },
  });

  // 4. Handle submission with type safety
  async function onSubmit(values: FormData) {
    try {
      // Values are fully typed and validated
      const response = await updateProfile(values);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Something went wrong.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
```

## Dark Mode Implementation

### ✅ GOOD: Theme Provider Setup
```tsx
// app/providers.tsx
"use client";

import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

// components/theme-toggle.tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

## Responsive Design Patterns

### ✅ GOOD: Mobile-First Responsive Layout
```tsx
export function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Responsive grid that adapts to screen size */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold">Card 1</h3>
        <p className="text-sm text-muted-foreground">Content</p>
      </Card>
    </div>
  );
}

// Responsive navigation
export function ResponsiveNav() {
  return (
    <nav className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="hidden sm:inline">Company Name</span>
      </div>

      {/* Show/hide based on screen size */}
      <div className="hidden md:flex gap-4">
        <NavLink href="/features">Features</NavLink>
        <NavLink href="/pricing">Pricing</NavLink>
      </div>

      {/* Mobile menu */}
      <Sheet className="md:hidden">
        {/* Mobile navigation */}
      </Sheet>
    </nav>
  );
}
```

## Accessibility Best Practices

### ✅ GOOD: Accessible Components
```tsx
// Always include proper ARIA attributes and keyboard navigation
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AccessibleButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Delete item"
            aria-describedby="delete-description"
          >
            <TrashIcon className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent id="delete-description">
          <p>Delete this item permanently</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

## Performance Optimization

### Bundle Size Management
```tsx
// ✅ GOOD: Import only what you need
import { Button } from "@/components/ui/button";

// ❌ BAD: Don't import entire libraries
import * as AllComponents from "@/components/ui";
```

### Lazy Loading
```tsx
// ✅ GOOD: Lazy load heavy components
import dynamic from "next/dynamic";

const DataTable = dynamic(
  () => import("@/components/shared/data-table"),
  {
    loading: () => <TableSkeleton />,
    ssr: false, // Disable SSR for client-only components
  }
);
```

## Component Library Organization

### Variants and Sizes
```tsx
// Use predefined variants for consistency
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

## Custom Component Extension

### ✅ GOOD: Extending ShadCN Components
```tsx
// Create wrapper components for business logic
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({
  children,
  loading,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={cn(className)}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

## Best Practices Summary

### ✅ DO's
1. **Copy components** - You own the code
2. **Use Server Components** where possible
3. **Follow mobile-first** responsive design
4. **Maintain accessibility** standards
5. **Use TypeScript** for type safety
6. **Compose components** for reusability
7. **Use Tailwind utilities** instead of custom CSS
8. **Test with keyboard** navigation

### ❌ DON'Ts
1. **Don't edit** components/ui files directly
2. **Don't put business logic** in UI components
3. **Don't use inline styles**
4. **Don't skip accessibility** attributes
5. **Don't import unused** components
6. **Don't ignore dark mode** support
7. **Don't create custom** when ShadCN has it

## Related Documentation
- 🔗 [Form Patterns](./forms.md)
- 🔗 [Theme Configuration](./theming.md)
- 🔗 [Component Examples](./examples/)
- 🔗 [Tailwind Config](../../patterns/ui-patterns/)

---

*ShadCN UI gives you complete ownership of your components. Use them as building blocks for your unique design system while maintaining consistency and accessibility.*