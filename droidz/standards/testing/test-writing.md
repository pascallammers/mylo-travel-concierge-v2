# Testing Standards

## Overview

This project uses Node.js native test runner via `tsx --test`. Tests follow a consistent structure with describe/it blocks and use the Testing Library for React components.

## When to Apply

- Writing unit tests for business logic
- Testing React components
- Testing API clients
- Integration tests for AI tools

## Core Principles

1. **Colocate Tests** - `*.test.ts` next to source files
2. **Native Runner** - Use `tsx --test` (not Jest)
3. **Clear Naming** - Describe what the function should do
4. **Mock Boundaries** - Mock external APIs, not internal logic
5. **Test Behavior** - Test what it does, not how it does it

## ✅ DO

### DO: Use Node.js Test Runner Syntax

```typescript
// lib/api/amadeus-token.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from 'node:test';
import { getValidAmadeusToken, isTokenExpired } from './amadeus-token';

describe('Amadeus Token Management', () => {
  describe('isTokenExpired', () => {
    it('should return true for expired tokens', () => {
      const expiredDate = new Date(Date.now() - 60000); // 1 min ago
      expect(isTokenExpired(expiredDate)).toBe(true);
    });
    
    it('should return false for valid tokens', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 min from now
      expect(isTokenExpired(futureDate)).toBe(false);
    });
    
    it('should return true for tokens expiring within buffer', () => {
      const almostExpired = new Date(Date.now() + 30000); // 30 sec
      expect(isTokenExpired(almostExpired, 60000)).toBe(true); // 60 sec buffer
    });
  });
  
  describe('getValidAmadeusToken', () => {
    beforeEach(() => {
      // Reset mocks before each test
    });
    
    it('should return cached token if valid', async () => {
      const token = await getValidAmadeusToken('test');
      expect(token).toBeDefined();
      expect(token.accessToken).toMatch(/^[A-Za-z0-9]+$/);
    });
  });
});
```

### DO: Test AI Tool Input Validation

```typescript
// lib/tools/flight-search.test.ts
import { describe, it, expect } from 'node:test';
import { flightSearchTool } from './flight-search';

describe('flightSearchTool', () => {
  describe('input validation', () => {
    it('should reject past departure dates', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await expect(
        flightSearchTool.execute({
          origin: 'FRA',
          destination: 'BKK',
          departDate: yesterday.toISOString().split('T')[0],
          cabin: 'ECONOMY',
          passengers: 1,
          awardOnly: false,
          flexibility: 0,
          nonStop: false,
        }, { messages: [], abortSignal: new AbortController().signal })
      ).rejects.toThrow(/past/i);
    });
    
    it('should reject return date before departure', async () => {
      await expect(
        flightSearchTool.execute({
          origin: 'FRA',
          destination: 'BKK',
          departDate: '2025-12-15',
          returnDate: '2025-12-10', // Before departure!
          cabin: 'ECONOMY',
          passengers: 1,
          awardOnly: false,
          flexibility: 0,
          nonStop: false,
        }, { messages: [], abortSignal: new AbortController().signal })
      ).rejects.toThrow(/before.*departure/i);
    });
  });
});
```

### DO: Test React Components with Testing Library

```typescript
// components/message.test.tsx
import { describe, it, expect } from 'node:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Message } from './message';

describe('Message Component', () => {
  const defaultProps = {
    message: {
      id: '1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello, world!' }],
    },
    index: 0,
    lastUserMessageIndex: 0,
    status: 'ready' as const,
    messages: [],
    setMessages: () => {},
    sendMessage: async () => {},
    regenerate: async () => {},
    setSuggestedQuestions: () => {},
    suggestedQuestions: [],
    renderPart: (part: any) => <span>{part.text}</span>,
  };
  
  it('should render user message text', () => {
    render(<Message {...defaultProps} />);
    expect(screen.getByText('Hello, world!')).toBeDefined();
  });
  
  it('should show edit button for message owner', () => {
    render(
      <Message 
        {...defaultProps} 
        isOwner={true}
        user={{ id: '1', name: 'Test User' }}
      />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeDefined();
  });
  
  it('should not show edit button for non-owners', () => {
    render(
      <Message 
        {...defaultProps} 
        isOwner={false}
        user={{ id: '2', name: 'Other User' }}
      />
    );
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });
  
  it('should copy text to clipboard on copy button click', async () => {
    const mockClipboard = { writeText: mock.fn() };
    Object.assign(navigator, { clipboard: mockClipboard });
    
    render(<Message {...defaultProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello, world!');
    });
  });
});
```

### DO: Mock External APIs

```typescript
// lib/api/seats-aero-client.test.ts
import { describe, it, expect, mock, beforeEach } from 'node:test';
import { searchSeatsAero } from './seats-aero-client';

describe('Seats.aero Client', () => {
  beforeEach(() => {
    // Mock fetch for all tests
    global.fetch = mock.fn();
  });
  
  it('should return parsed flight results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: '1',
            airline: 'LH',
            price: '50000 miles',
            cabin: 'Business',
          },
        ],
      }),
    });
    
    const results = await searchSeatsAero({
      origin: 'FRA',
      destination: 'BKK',
      departureDate: '2025-12-01',
      travelClass: 'BUSINESS',
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].airline).toBe('LH');
  });
  
  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    
    const results = await searchSeatsAero({
      origin: 'FRA',
      destination: 'BKK',
      departureDate: '2025-12-01',
      travelClass: 'BUSINESS',
    });
    
    expect(results).toBeNull();
  });
});
```

### DO: Test Database Query Functions

```typescript
// lib/db/queries/tool-calls.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'node:test';
import { db } from '@/lib/db';
import { toolCalls, chat } from '@/lib/db/schema';
import { recordToolCall, updateToolCall, getToolCallById } from './tool-calls';
import { eq } from 'drizzle-orm';

describe('Tool Calls Queries', () => {
  const testChatId = 'test-chat-for-tool-calls';
  
  beforeEach(async () => {
    // Create test chat
    await db.insert(chat).values({
      id: testChatId,
      userId: 'test-user',
      title: 'Test',
      visibility: 'private',
    });
  });
  
  afterEach(async () => {
    // Clean up
    await db.delete(toolCalls).where(eq(toolCalls.chatId, testChatId));
    await db.delete(chat).where(eq(chat.id, testChatId));
  });
  
  it('should record a tool call', async () => {
    const result = await recordToolCall({
      chatId: testChatId,
      toolName: 'search_flights',
      request: { origin: 'FRA', destination: 'BKK' },
    });
    
    expect(result.id).toBeDefined();
    expect(result.status).toBe('queued');
  });
  
  it('should update tool call status', async () => {
    const created = await recordToolCall({
      chatId: testChatId,
      toolName: 'search_flights',
      request: {},
    });
    
    await updateToolCall(created.id, {
      status: 'succeeded',
      response: { flights: [] },
      finishedAt: new Date(),
    });
    
    const updated = await getToolCallById(created.id);
    expect(updated.status).toBe('succeeded');
    expect(updated.response).toEqual({ flights: [] });
  });
});
```

## ❌ DON'T

### DON'T: Test Implementation Details

```typescript
// ❌ Bad - testing internal state
it('should set isLoading to true', () => {
  const component = render(<SearchForm />);
  fireEvent.click(screen.getByText('Search'));
  expect(component.state.isLoading).toBe(true); // Implementation detail!
});

// ✅ Good - test observable behavior
it('should show loading spinner while searching', async () => {
  render(<SearchForm />);
  fireEvent.click(screen.getByText('Search'));
  expect(screen.getByRole('progressbar')).toBeDefined();
});
```

### DON'T: Mock Too Much

```typescript
// ❌ Bad - mocking everything
it('should calculate total', () => {
  const mockAdd = mock.fn(() => 10);
  const mockMultiply = mock.fn(() => 100);
  
  // Testing mocks, not real logic!
  expect(mockAdd(5, 5)).toBe(10);
});

// ✅ Good - mock boundaries only
it('should calculate total with tax', () => {
  // Mock external API, but test real calculation logic
  mock.method(taxService, 'getTaxRate', () => 0.1);
  
  const total = calculateTotalWithTax(100);
  expect(total).toBe(110);
});
```

### DON'T: Write Flaky Tests

```typescript
// ❌ Bad - timing-dependent
it('should update after delay', async () => {
  render(<Notification />);
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(screen.getByText('Updated!')).toBeDefined();
});

// ✅ Good - use waitFor
it('should update after delay', async () => {
  render(<Notification />);
  await waitFor(() => {
    expect(screen.getByText('Updated!')).toBeDefined();
  });
});
```

## Test Commands

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run with watch mode
pnpm test:watch

# Run specific file
npx tsx --test "lib/api/amadeus-client.test.ts"

# Run with pattern
npx tsx --test "lib/**/*.test.ts"
```

## File Organization

```
lib/
├── api/
│   ├── amadeus-client.ts
│   ├── amadeus-client.test.ts      # Unit test next to source
│   ├── seats-aero-client.ts
│   └── seats-aero-client.test.ts
├── db/
│   ├── queries.ts
│   └── queries/
│       ├── tool-calls.ts
│       └── tool-calls.test.ts
├── tools/
│   ├── flight-search.ts
│   └── flight-search.integration.test.ts  # Integration tests
└── utils/
    ├── airport-codes.ts
    └── airport-codes.test.ts

components/
├── message.tsx
├── message.test.tsx               # Component tests
├── settings-dialog.tsx
└── settings-dialog.test.tsx
```

## Testing Utilities

```typescript
// test-setup.ts
import { beforeEach, afterEach } from 'node:test';
import { db } from '@/lib/db';

// Global test setup
export function setupTestDatabase() {
  beforeEach(async () => {
    // Start transaction or setup test data
  });
  
  afterEach(async () => {
    // Rollback or cleanup
  });
}

// Mock factory
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    isProUser: false,
    ...overrides,
  };
}

export function createMockChat(overrides = {}) {
  return {
    id: 'test-chat-id',
    userId: 'test-user-id',
    title: 'Test Chat',
    visibility: 'private',
    createdAt: new Date(),
    ...overrides,
  };
}
```

## Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [tsx](https://tsx.is/)
