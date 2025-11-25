# Coding Style

## Overview

Consistent coding style ensures readability and maintainability. This project follows TypeScript best practices with specific conventions for Next.js 15 and the AI SDK.

## When to Apply

- All TypeScript/JavaScript files
- React components
- API routes
- AI tools
- Database queries

## Core Principles

1. **Type Safety** - Use TypeScript strictly, avoid `any`
2. **Explicit Over Implicit** - Be clear about intentions
3. **Functional Patterns** - Prefer immutable data and pure functions
4. **Colocation** - Keep related code together
5. **Single Responsibility** - One purpose per file/function

## ✅ DO

### DO: Use Strict TypeScript

```typescript
// ✅ Good - explicit types
interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  cabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  passengers: number;
}

async function searchFlights(params: FlightSearchParams): Promise<FlightResult[]> {
  // Implementation
}
```

### DO: Use Async/Await Consistently

```typescript
// ✅ Good - clean async/await
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const config = await getGroupConfig(group);
  const results = await processSearch(user, config);
  return Response.json(results);
}
```

### DO: Destructure Props and Parameters

```typescript
// ✅ Good - destructured parameters
interface MessageProps {
  message: ChatMessage;
  index: number;
  status: UseChatHelpers['status'];
  onRetry?: () => Promise<void>;
}

export function Message({ message, index, status, onRetry }: MessageProps) {
  // Component
}
```

### DO: Use Early Returns

```typescript
// ✅ Good - early returns reduce nesting
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  if (!user.isProUser && count >= limit) {
    return new ChatSDKError('rate_limit:chat').toResponse();
  }
  
  // Main logic here
  return Response.json(result);
}
```

### DO: Use Const Assertions for Literals

```typescript
// ✅ Good - const assertion
export const toolCallStatus = ['queued', 'running', 'succeeded', 'failed', 'timeout', 'canceled'] as const;
export type ToolCallStatus = (typeof toolCallStatus)[number];

const cabinClasses = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
type CabinClass = (typeof cabinClasses)[number];
```

### DO: Use Template Literals for Logging

```typescript
// ✅ Good - template literals with context
console.log(`[Flight Search] Starting search: ${origin} → ${destination}`);
console.log(`⏱️  [DB] getChatById() took: ${queryTime.toFixed(2)}s`);
console.error(`[Amadeus] Failed to fetch flights:`, error.message);
```

## ❌ DON'T

### DON'T: Use `any` Type

```typescript
// ❌ Bad - any loses type safety
function processData(data: any) {
  return data.items.map((item: any) => item.name);
}

// ✅ Good - explicit types
interface DataItem {
  id: string;
  name: string;
}

interface Data {
  items: DataItem[];
}

function processData(data: Data): string[] {
  return data.items.map(item => item.name);
}
```

### DON'T: Use Dynamic Imports for Regular Modules

```typescript
// ❌ Bad - unnecessary dynamic import
const { db } = await import('@/lib/db');

// ✅ Good - static import
import { db } from '@/lib/db';
```

### DON'T: Mix Async Patterns

```typescript
// ❌ Bad - mixing promises and callbacks
function fetchData() {
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      processData(data, (result) => {
        // Callback hell
      });
    });
}

// ✅ Good - consistent async/await
async function fetchData() {
  const response = await fetch(url);
  const data = await response.json();
  const result = await processData(data);
  return result;
}
```

### DON'T: Use Magic Numbers/Strings

```typescript
// ❌ Bad - magic values
if (count >= 100) { /* ... */ }
if (status === 'active') { /* ... */ }

// ✅ Good - named constants
const DAILY_MESSAGE_LIMIT = 100;
const SubscriptionStatus = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;

if (count >= DAILY_MESSAGE_LIMIT) { /* ... */ }
if (status === SubscriptionStatus.ACTIVE) { /* ... */ }
```

### DON'T: Nest Conditionals Deeply

```typescript
// ❌ Bad - deep nesting
if (user) {
  if (user.isProUser) {
    if (user.subscription) {
      if (user.subscription.status === 'active') {
        // Finally do something
      }
    }
  }
}

// ✅ Good - guard clauses
if (!user) return;
if (!user.isProUser) return;
if (!user.subscription) return;
if (user.subscription.status !== 'active') return;
// Do something
```

## Naming Conventions

### Files
```
components/chat-interface.tsx    # kebab-case for components
lib/utils/flight-search-links.ts # kebab-case for utilities
lib/db/schema.ts                 # lowercase for modules
app/api/search/route.ts          # route.ts for API routes
```

### Variables & Functions
```typescript
const isProUser = true;              // camelCase for variables
const userMessageCount = 10;         // descriptive names
function getCurrentUser() {}         // camelCase for functions
async function fetchFlightData() {}  // prefix async operations
```

### Types & Interfaces
```typescript
interface ChatMessage {}          // PascalCase
type FlightSearchParams = {};     // PascalCase
type ToolCallStatus = string;     // PascalCase
```

### Constants
```typescript
const DAILY_MESSAGE_LIMIT = 100;      // SCREAMING_SNAKE_CASE
const API_ENDPOINTS = { ... };         // SCREAMING_SNAKE_CASE
const DEFAULT_CABIN_CLASS = 'ECONOMY'; // SCREAMING_SNAKE_CASE
```

### React Components
```typescript
// PascalCase for components
export function MessageEditor() {}
export function EnhancedErrorDisplay() {}

// camelCase for hooks
export function useDataStream() {}
export function useChatHelpers() {}
```

## Import Order

```typescript
// 1. React/Next.js
import React, { useState, useCallback } from 'react';
import { after } from 'next/server';

// 2. External packages
import { z } from 'zod';
import { tool, streamText } from 'ai';
import { eq, and } from 'drizzle-orm';

// 3. Internal absolute imports (@/)
import { db } from '@/lib/db';
import { ChatSDKError } from '@/lib/errors';
import { Button } from '@/components/ui/button';

// 4. Relative imports
import { formatResults } from './helpers';
import type { LocalType } from './types';
```

## File Structure

```typescript
// 1. Imports (ordered as above)

// 2. Types/Interfaces
interface Props {}
type Status = 'idle' | 'loading' | 'success';

// 3. Constants
const DEFAULT_LIMIT = 10;

// 4. Helper functions (if small, otherwise separate file)
function formatDate(date: Date): string {}

// 5. Main export
export function Component() {}
// or
export async function handler() {}

// 6. Additional exports
export { helperFunction };
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Next.js TypeScript](https://nextjs.org/docs/app/building-your-application/configuring/typescript)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
