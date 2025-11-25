# Component Standards

## Overview

This project uses React 19 with Next.js 15 App Router. Components follow a specific pattern for Server Components, Client Components, and UI primitives from shadcn/ui built on Radix UI.

## When to Apply

- Creating new React components
- Refactoring existing components
- Building UI features
- Implementing interactive elements

## Core Principles

1. **Server First** - Default to Server Components
2. **Client Boundary** - Use 'use client' only when needed
3. **Composition** - Build complex UIs from simple components
4. **Type Safety** - Full TypeScript with explicit props
5. **Accessibility** - Use Radix UI primitives for a11y

## ✅ DO

### DO: Use Server Components by Default

```typescript
// app/pricing/page.tsx - Server Component (no 'use client')
import { getCurrentUser } from '@/app/actions';
import { PricingTable } from './_component/pricing-table';

export default async function PricingPage() {
  const user = await getCurrentUser();
  
  return (
    <main className="container py-8">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <PricingTable user={user} />
    </main>
  );
}
```

### DO: Mark Client Components Explicitly

```typescript
// components/chat-interface.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();
  
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    await sendMessage({ content: input });
    setInput('');
  }, [input, sendMessage]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Component JSX */}
    </div>
  );
}
```

### DO: Define Props Interfaces

```typescript
// components/message.tsx
'use client';

interface MessageProps {
  message: ChatMessage;
  index: number;
  lastUserMessageIndex: number;
  renderPart: (part: ChatMessage['parts'][number], messageIndex: number, partIndex: number) => React.ReactNode;
  status: UseChatHelpers<ChatMessage>['status'];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  user?: ComprehensiveUserData | null;
  selectedVisibilityType?: 'public' | 'private';
  isLastMessage?: boolean;
  error?: any;
  handleRetry?: () => Promise<void>;
  isOwner?: boolean;
  onHighlight?: (text: string) => void;
}

export const Message: React.FC<MessageProps> = ({
  message,
  index,
  status,
  user,
  isOwner = true,
  // ... rest of props
}) => {
  // Component implementation
};

Message.displayName = 'Message';
```

### DO: Use Radix UI Primitives via shadcn/ui

```typescript
// components/ui/dialog.tsx
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
        'bg-background rounded-lg shadow-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogClose };
```

### DO: Use useCallback for Event Handlers

```typescript
'use client';

export function MessageEditor({ message, setMode, regenerate }: MessageEditorProps) {
  const [draftContent, setDraftContent] = useState('');
  
  const handleInput = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
  }, []);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) return;
    
    await regenerate();
    setMode('view');
  }, [draftContent, regenerate, setMode]);
  
  return (
    <form onSubmit={handleSubmit}>
      <Textarea value={draftContent} onChange={handleInput} />
    </form>
  );
}
```

### DO: Use React.memo for Expensive Components

```typescript
'use client';

import React, { memo } from 'react';
import isEqual from 'fast-deep-equal';

interface FlightCardProps {
  flight: FlightResult;
  onSelect: (flight: FlightResult) => void;
}

export const FlightCard = memo<FlightCardProps>(
  ({ flight, onSelect }) => {
    return (
      <div className="border rounded-lg p-4">
        <h3>{flight.airline}</h3>
        <p>{flight.price}</p>
        <Button onClick={() => onSelect(flight)}>Select</Button>
      </div>
    );
  },
  (prevProps, nextProps) => isEqual(prevProps.flight, nextProps.flight)
);

FlightCard.displayName = 'FlightCard';
```

## ❌ DON'T

### DON'T: Use 'use client' Unnecessarily

```typescript
// ❌ Bad - no interactivity, doesn't need 'use client'
'use client';

export function StaticCard({ title, description }: Props) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

// ✅ Good - Server Component
export function StaticCard({ title, description }: Props) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

### DON'T: Fetch Data in Client Components

```typescript
// ❌ Bad - fetching in client component
'use client';

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(res => res.json()).then(setUser);
  }, [userId]);
  
  return <div>{user?.name}</div>;
}

// ✅ Good - fetch in Server Component, pass data down
// app/profile/page.tsx
import { getUserById } from '@/lib/db/queries';
import { UserProfileClient } from './user-profile-client';

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id);
  return <UserProfileClient user={user} />;
}
```

### DON'T: Define Components Inside Components

```typescript
// ❌ Bad - component defined inside component
export function ParentComponent() {
  // This creates a new component on every render
  const ChildComponent = () => <div>Child</div>;
  
  return <ChildComponent />;
}

// ✅ Good - define outside or use inline JSX
const ChildComponent = () => <div>Child</div>;

export function ParentComponent() {
  return <ChildComponent />;
}
```

### DON'T: Use Inline Functions in JSX for Complex Logic

```typescript
// ❌ Bad - complex inline function
<Button
  onClick={() => {
    const data = processData(items);
    saveToDatabase(data);
    showNotification('Saved!');
  }}
>
  Save
</Button>

// ✅ Good - use useCallback
const handleSave = useCallback(async () => {
  const data = processData(items);
  await saveToDatabase(data);
  showNotification('Saved!');
}, [items]);

<Button onClick={handleSave}>Save</Button>
```

## Component File Structure

```
components/
├── ui/                      # shadcn/ui components
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── ...
├── message.tsx              # Feature components
├── chat-interface.tsx
├── settings-dialog.tsx
├── markdown.tsx
├── logos/                   # Logo components
│   ├── mylo-logo.tsx
│   └── ...
└── admin/                   # Admin-specific
    ├── user-table.tsx
    └── stats-card.tsx
```

## Patterns

### Pattern 1: Compound Components

```typescript
// components/ui/card.tsx
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border bg-card', className)} {...props} />
  )
);

const CardHeader = ({ className, ...props }: CardHeaderProps) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);

const CardTitle = ({ className, ...props }: CardTitleProps) => (
  <h3 className={cn('text-2xl font-semibold', className)} {...props} />
);

const CardContent = ({ className, ...props }: CardContentProps) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardContent };

// Usage
<Card>
  <CardHeader>
    <CardTitle>Flight Results</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Pattern 2: Render Props / Children as Function

```typescript
'use client';

interface DataStreamProviderProps {
  children: (data: StreamData) => React.ReactNode;
}

export function DataStreamProvider({ children }: DataStreamProviderProps) {
  const data = useDataStream();
  return <>{children(data)}</>;
}

// Usage
<DataStreamProvider>
  {(data) => (
    <div>
      {data.messages.map(msg => <Message key={msg.id} message={msg} />)}
    </div>
  )}
</DataStreamProvider>
```

### Pattern 3: Conditional Client Components

```typescript
// components/auth-card.tsx
import { getCurrentUser } from '@/app/actions';
import { AuthCardClient } from './auth-card-client';

export async function AuthCard() {
  const user = await getCurrentUser();
  
  // Server-side rendering with user data
  if (!user) {
    return <SignInPrompt />;
  }
  
  // Pass to client component for interactivity
  return <AuthCardClient user={user} />;
}
```

## Testing Standards

```typescript
// components/message.test.tsx
import { describe, it, expect, mock } from 'node:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Message } from './message';

describe('Message', () => {
  const mockMessage = {
    id: '1',
    role: 'user',
    parts: [{ type: 'text', text: 'Hello' }],
  };
  
  it('renders user message correctly', () => {
    render(
      <Message
        message={mockMessage}
        index={0}
        status="ready"
        // ... other required props
      />
    );
    
    expect(screen.getByText('Hello')).toBeDefined();
  });
  
  it('shows edit button for message owner', () => {
    render(
      <Message
        message={mockMessage}
        isOwner={true}
        user={{ id: '1', name: 'Test' }}
        // ... other props
      />
    );
    
    expect(screen.getByRole('button', { name: /edit/i })).toBeDefined();
  });
});
```

## Resources

- [React 19 Docs](https://react.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
