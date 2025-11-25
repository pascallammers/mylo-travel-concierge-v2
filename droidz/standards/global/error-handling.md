# Error Handling

## Overview

This project uses a structured error handling system based on `ChatSDKError` for consistent error responses across the application. All errors follow a typed error code format: `{type}:{surface}`.

## When to Apply

- All API route handlers
- Database operations
- External API calls (Amadeus, Seats.aero, etc.)
- AI tool executions
- Authentication flows
- User input validation

## Core Principles

1. **Use ChatSDKError** - All application errors should use the typed error system
2. **Fail Fast** - Validate inputs at entry points before processing
3. **Non-Blocking Logging** - Don't let logging failures stop execution
4. **Graceful Degradation** - Continue with partial results when possible
5. **User-Friendly Messages** - Show helpful messages without exposing internals

## Error Types & Surfaces

### Error Types
```typescript
type ErrorType =
  | 'bad_request'      // 400 - Invalid input
  | 'unauthorized'     // 401 - Not signed in
  | 'forbidden'        // 403 - No permission
  | 'not_found'        // 404 - Resource missing
  | 'rate_limit'       // 429 - Too many requests
  | 'upgrade_required' // 402 - Needs Pro subscription
  | 'model_restricted' // 403 - Model access denied
  | 'offline';         // 503 - Service unavailable
```

### Surfaces
```typescript
type Surface = 
  | 'chat'     // Chat operations
  | 'auth'     // Authentication
  | 'api'      // External APIs
  | 'stream'   // Streaming
  | 'database' // DB operations
  | 'history'  // Chat history
  | 'model';   // AI model access
```

## ✅ DO

### DO: Use ChatSDKError for API Routes

```typescript
// app/api/search/route.ts
import { ChatSDKError } from '@/lib/errors';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  
  if (!user) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  if (!user.isProUser && messageCount >= dailyLimit) {
    return new ChatSDKError('rate_limit:chat', 'Daily search limit reached').toResponse();
  }
  
  // Continue with request...
}
```

### DO: Use ChatSDKError for Database Operations

```typescript
// lib/db/queries.ts
export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, id))
      .$withCache();
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}
```

### DO: Handle Non-Critical Failures Gracefully

```typescript
// lib/tools/flight-search.ts
execute: async (params) => {
  // Record tool call (non-blocking)
  let toolCallId: string | null = null;
  try {
    const result = await recordToolCall({ chatId, toolName: 'search_flights', request: params });
    toolCallId = result.id;
  } catch (dbError) {
    console.warn('[Flight Search] DB logging failed (continuing):', dbError);
    // Continue execution even if DB fails
  }
  
  // Main execution continues...
}
```

### DO: Provide Context in Error Causes

```typescript
throw new ChatSDKError(
  'bad_request:api',
  `Failed to fetch user ${userId}: ${error.message}`
);
```

### DO: Use Error Helper Functions

```typescript
import { 
  isSignInRequired, 
  isProRequired, 
  isRateLimited,
  getErrorActions,
  getErrorIcon 
} from '@/lib/errors';

// In component
if (isSignInRequired(error)) {
  return <SignInPrompt />;
}

if (isProRequired(error)) {
  return <UpgradePrompt actions={getErrorActions(error)} />;
}
```

## ❌ DON'T

### DON'T: Use Generic Error Messages

```typescript
// ❌ Bad
throw new Error('Something went wrong');
throw new ChatSDKError('bad_request:api');

// ✅ Good
throw new ChatSDKError('bad_request:api', 'Invalid date format in departDate');
```

### DON'T: Expose Internal Details

```typescript
// ❌ Bad
return Response.json({
  error: error.stack,
  query: sqlQuery
}, { status: 500 });

// ✅ Good
return new ChatSDKError('bad_request:database', 'Query failed').toResponse();
```

### DON'T: Let Logging Failures Stop Execution

```typescript
// ❌ Bad - logging failure stops the tool
await recordToolCall(toolData);  // If this fails, tool stops

// ✅ Good - graceful handling
try {
  await recordToolCall(toolData);
} catch (dbError) {
  console.warn('DB logging failed (continuing):', dbError);
}
```

### DON'T: Silently Swallow Errors

```typescript
// ❌ Bad
try {
  await saveData(data);
} catch (error) {
  // Silent failure!
}

// ✅ Good
try {
  await saveData(data);
} catch (error) {
  console.error('Failed to save data:', error);
  throw new ChatSDKError('bad_request:database', 'Failed to save data');
}
```

## Patterns & Examples

### Pattern 1: API Route Error Handling

```typescript
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    // Auth check
    if (!user) {
      return new ChatSDKError('unauthorized:auth').toResponse();
    }
    
    // Rate limit check
    const { count } = await getUserMessageCount(user);
    if (count >= DAILY_LIMIT) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }
    
    // Main logic
    const result = await processRequest(req);
    return Response.json(result);
    
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error('Unexpected error:', error);
    return new ChatSDKError('bad_request:api', 'Request failed').toResponse();
  }
}
```

### Pattern 2: AI Tool Error Handling

```typescript
export const flightSearchTool = tool({
  execute: async (params, { abortSignal }) => {
    // Validate dates
    if (new Date(params.departDate) < new Date()) {
      throw new Error('Departure date is in the past');
    }
    
    // Parallel API calls with individual error handling
    const [seatsResult, amadeusResult] = await Promise.all([
      searchSeatsAero(params).catch((err) => {
        console.error('[Seats.aero] Failed:', err.message);
        return null;
      }),
      searchAmadeus(params).catch((err) => {
        console.error('[Amadeus] Failed:', err.message);
        return null;
      }),
    ]);
    
    // Check if we have any results
    if (!seatsResult && !amadeusResult) {
      throw new Error('No flights found. Try different dates or routes.');
    }
    
    return formatResults({ seatsResult, amadeusResult });
  },
});
```

### Pattern 3: Component Error Display

```typescript
// components/message.tsx
const EnhancedErrorDisplay: React.FC<Props> = ({ error, handleRetry }) => {
  const parsedError = parseError(error);
  const errorIcon = getErrorIcon(parsedError);
  const actions = getErrorActions(parsedError);
  const colors = getColorScheme(errorIcon);
  
  return (
    <div className={`rounded-lg border ${colors.border} bg-background`}>
      <div className="flex items-start gap-3">
        <ErrorIcon type={errorIcon} />
        <div>
          <h3 className={colors.title}>{getErrorTitle(parsedError)}</h3>
          <p className={colors.text}>{parsedError.message}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {actions.secondary && (
          <Button onClick={() => handleAction(actions.secondary.action)}>
            {actions.secondary.label}
          </Button>
        )}
        {actions.primary && (
          <Button onClick={() => handleAction(actions.primary.action)}>
            {actions.primary.label}
          </Button>
        )}
      </div>
    </div>
  );
};
```

## Testing Standards

```typescript
import { describe, it, expect } from 'node:test';
import { ChatSDKError, isSignInRequired, isProRequired } from '@/lib/errors';

describe('ChatSDKError', () => {
  it('should create error with correct type and surface', () => {
    const error = new ChatSDKError('unauthorized:auth');
    expect(error.type).toBe('unauthorized');
    expect(error.surface).toBe('auth');
    expect(error.statusCode).toBe(401);
  });
  
  it('should include cause in error', () => {
    const error = new ChatSDKError('bad_request:api', 'Invalid input');
    expect(error.cause).toBe('Invalid input');
  });
  
  it('isSignInRequired returns true for auth errors', () => {
    const error = new ChatSDKError('unauthorized:auth');
    expect(isSignInRequired(error)).toBe(true);
  });
  
  it('isProRequired returns true for upgrade errors', () => {
    const error = new ChatSDKError('upgrade_required:chat');
    expect(isProRequired(error)).toBe(true);
  });
});
```

## Resources

- [lib/errors.ts](/lib/errors.ts) - Error class and helpers
- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [Vercel AI SDK Error Handling](https://sdk.vercel.ai/docs/ai-sdk-core/error-handling)
