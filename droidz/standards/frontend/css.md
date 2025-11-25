# CSS & Styling

## Overview

This project uses Tailwind CSS v4 for styling. All styles use utility classes with design tokens defined in CSS variables. The `cn()` utility handles class merging.

## When to Apply

- Styling components
- Creating responsive layouts
- Implementing dark mode
- Building animations

## Core Principles

1. **Utility First** - Use Tailwind classes directly
2. **Design Tokens** - Use CSS variables for theming
3. **Responsive** - Mobile-first approach
4. **Dark Mode** - Support both themes via CSS variables
5. **Class Merging** - Use `cn()` for conditional classes

## ✅ DO

### DO: Use the cn() Utility for Conditional Classes

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage in components
import { cn } from '@/lib/utils';

<div className={cn(
  'rounded-lg border p-4',
  isActive && 'bg-primary text-primary-foreground',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className // Allow override from props
)} />
```

### DO: Use Semantic Color Variables

```typescript
// ✅ Good - semantic variables that adapt to theme
<div className="bg-background text-foreground">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Action
  </button>
</div>

// CSS variables are defined in globals.css
// --background, --foreground, --primary, --muted, etc.
```

### DO: Use Mobile-First Responsive Design

```typescript
// ✅ Good - mobile first, then larger screens
<div className="
  p-2 text-sm                    // Mobile (base)
  sm:p-4 sm:text-base            // Small screens (640px+)
  md:p-6 md:text-lg              // Medium screens (768px+)
  lg:p-8 lg:text-xl              // Large screens (1024px+)
">
  Content
</div>

// Grid example
<div className="
  grid grid-cols-1               // 1 column on mobile
  sm:grid-cols-2                 // 2 columns on tablet
  lg:grid-cols-3                 // 3 columns on desktop
  gap-4
">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### DO: Use Consistent Spacing Scale

```typescript
// ✅ Good - use Tailwind spacing scale
<div className="space-y-4">           // Vertical gap between children
  <div className="p-4">               // Padding
  <div className="mt-2 mb-4">         // Margin top/bottom
  <div className="gap-2">             // Flexbox/Grid gap
</div>

// Common spacing:
// 0.5 = 2px, 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px
// 6 = 24px, 8 = 32px, 10 = 40px, 12 = 48px
```

### DO: Handle Dark Mode with CSS Variables

```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
}
```

```typescript
// Components automatically adapt
<div className="bg-background text-foreground">
  {/* Light mode: white bg, dark text */}
  {/* Dark mode: dark bg, light text */}
</div>
```

### DO: Use Tailwind Animation Classes

```typescript
// Built-in animations
<div className="animate-spin" />      // Spinning loader
<div className="animate-pulse" />     // Pulsing skeleton
<div className="animate-bounce" />    // Bouncing element

// Transitions
<button className="
  transition-colors duration-200
  hover:bg-primary/90
">
  Hover me
</button>

// Transform on hover
<div className="
  transition-transform duration-200
  hover:scale-105
  hover:-translate-y-1
">
  Card
</div>
```

## ❌ DON'T

### DON'T: Use Hardcoded Colors

```typescript
// ❌ Bad - hardcoded colors
<div className="bg-[#1a1a1a] text-[#ffffff]">
  Content
</div>

// ✅ Good - semantic variables
<div className="bg-background text-foreground">
  Content
</div>
```

### DON'T: Mix CSS Modules with Tailwind

```typescript
// ❌ Bad - mixing approaches
import styles from './component.module.css';

<div className={`${styles.container} p-4`}>

// ✅ Good - Tailwind only
<div className="container mx-auto p-4">
```

### DON'T: Use Arbitrary Values Unless Necessary

```typescript
// ❌ Bad - arbitrary values
<div className="w-[347px] h-[89px] mt-[23px]">

// ✅ Good - use design scale
<div className="w-80 h-24 mt-6">

// Only use arbitrary for exact requirements
<div className="max-h-[85vh]">  // OK - viewport-based
```

### DON'T: Duplicate Responsive Patterns

```typescript
// ❌ Bad - repeated responsive patterns
<h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
<h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
<h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">

// ✅ Good - use prose or custom classes
<article className="prose prose-sm sm:prose-base lg:prose-lg">
  <h1>Title</h1>
  <h2>Subtitle</h2>
</article>
```

## Common Patterns

### Pattern 1: Button Variants with CVA

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
```

### Pattern 2: Responsive Dialog/Drawer

```typescript
// Mobile: Drawer from bottom, Desktop: Centered dialog
<Dialog>
  <DialogContent className="
    sm:max-w-md
    max-h-[85vh]
    overflow-hidden
    
    // Mobile drawer behavior
    fixed bottom-0 left-0 right-0 rounded-t-lg
    sm:static sm:rounded-lg
    
    // Animation
    data-[state=open]:animate-in
    data-[state=closed]:animate-out
    data-[state=closed]:fade-out-0
    data-[state=open]:fade-in-0
  ">
    {children}
  </DialogContent>
</Dialog>
```

### Pattern 3: Skeleton Loading States

```typescript
// components/ui/skeleton.tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// Usage
<div className="space-y-4">
  <Skeleton className="h-12 w-full" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>
```

### Pattern 4: Prose for Markdown Content

```typescript
// components/markdown.tsx
<div className="
  prose prose-sm sm:prose-base
  prose-neutral dark:prose-invert
  prose-p:my-1 sm:prose-p:my-2
  prose-pre:my-1 sm:prose-pre:my-2
  prose-code:before:hidden prose-code:after:hidden
  max-w-none
">
  {children}
</div>
```

## Tailwind CSS v4 Specifics

```css
/* Tailwind v4 uses CSS-first configuration */
@import "tailwindcss";

/* Custom utilities */
@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
  }
}

/* Theme extension via CSS variables */
@theme {
  --color-brand: oklch(0.7 0.15 200);
}
```

## Resources

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Class Variance Authority](https://cva.style/docs)
- [tailwind-merge](https://github.com/dcastil/tailwind-merge)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
