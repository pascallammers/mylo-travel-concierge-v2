# API Design

## Overview

This project uses Next.js 15 App Router for API routes. All routes follow REST conventions with typed request/response handling using Zod validation and ChatSDKError for errors.

## When to Apply

- Creating new API endpoints
- Handling HTTP requests
- Processing webhooks
- Implementing streaming responses

## Core Principles

1. **Route Handlers** - Use Next.js 15 route.ts files
2. **Typed Validation** - Zod schemas for all inputs
3. **Error Consistency** - ChatSDKError for all errors
4. **Auth First** - Check authentication before processing
5. **Streaming** - Use AI SDK for streaming responses

## ✅ DO

### DO: Use Next.js 15 Route Handlers

```typescript
// app/api/users/[id]/route.ts
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/app/actions';
import { ChatSDKError } from '@/lib/errors';
import { getUserById } from '@/lib/db/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  const user = await getUserById(id);
  if (!user) {
    return new ChatSDKError('not_found:api', `User ${id} not found`).toResponse();
  }
  
  return Response.json(user);
}
```

### DO: Validate Request Bodies with Zod

```typescript
// app/api/upload/route.ts
import { z } from 'zod';

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^(image|application)\//),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
});

export async function POST(req: Request) {
  const body = await req.json();
  
  const result = uploadSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    );
  }
  
  const { filename, contentType, size } = result.data;
  // Process validated data...
}
```

### DO: Use after() for Background Operations

```typescript
// app/api/search/route.ts
import { after } from 'next/server';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  
  // Create chat immediately
  await saveChat({ id, userId: user.id, title: 'New Chat' });
  
  // Generate title in background
  after(async () => {
    try {
      const title = await generateTitleFromUserMessage({ message });
      await updateChatTitleById({ chatId: id, title });
      console.log('✅ Background title generation completed');
    } catch (error) {
      console.error('Background title generation failed:', error);
    }
  });
  
  // Return response immediately
  return Response.json({ id, status: 'processing' });
}
```

### DO: Implement Streaming with AI SDK

```typescript
// app/api/search/route.ts
import { createUIMessageStream, streamText, JsonToSseTransformStream } from 'ai';

export async function POST(req: Request) {
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      const result = streamText({
        model: languageModel,
        messages: convertToModelMessages(messages),
        tools: toolRegistry,
        onFinish: async (event) => {
          console.log('Stream finished:', event.finishReason);
        },
      });
      
      result.consumeStream();
      dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));
    },
    onError(error) {
      if (error.message.includes('Rate Limit')) {
        return 'Rate limit reached. Please try again later.';
      }
      return 'An error occurred. Please try again.';
    },
    onFinish: async ({ messages }) => {
      if (user) {
        await saveMessages({ messages });
      }
    },
  });
  
  return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}
```

### DO: Handle Webhooks Securely

```typescript
// Webhook handling via better-auth plugins
webhooks({
  secret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async ({ data, type }) => {
    console.log('🔔 Received webhook:', type);
    
    if (type === 'subscription.created' || type === 'subscription.active') {
      try {
        // Validate user exists before linking
        const userExists = await db.query.user.findFirst({
          where: eq(user.id, data.customer?.externalId),
        });
        
        if (!userExists) {
          console.warn('User not found, will link on signup');
        }
        
        // Upsert subscription
        await db.insert(subscription)
          .values(subscriptionData)
          .onConflictDoUpdate({
            target: subscription.id,
            set: updateFields,
          });
        
        // Invalidate caches
        if (userExists) {
          invalidateUserCaches(data.customer.externalId);
        }
      } catch (error) {
        console.error('Webhook processing failed:', error);
        // Don't throw - let webhook succeed
      }
    }
  },
}),
```

### DO: Use Proper Status Codes

```typescript
// Success responses
return Response.json(data);                    // 200 OK (default)
return Response.json(created, { status: 201 }); // 201 Created
return new Response(null, { status: 204 });    // 204 No Content

// Error responses via ChatSDKError
return new ChatSDKError('bad_request:api').toResponse();      // 400
return new ChatSDKError('unauthorized:auth').toResponse();    // 401
return new ChatSDKError('forbidden:chat').toResponse();       // 403
return new ChatSDKError('not_found:api').toResponse();        // 404
return new ChatSDKError('rate_limit:chat').toResponse();      // 429
return new ChatSDKError('upgrade_required:chat').toResponse(); // 402
```

## ❌ DON'T

### DON'T: Skip Authentication Checks

```typescript
// ❌ Bad - no auth check
export async function DELETE(req: Request) {
  const { chatId } = await req.json();
  await deleteChatById({ id: chatId });  // Anyone can delete!
  return Response.json({ success: true });
}

// ✅ Good - verify auth and ownership
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  const { chatId } = await req.json();
  const chat = await getChatById({ id: chatId });
  
  if (!chat || chat.userId !== user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }
  
  await deleteChatById({ id: chatId });
  return Response.json({ success: true });
}
```

### DON'T: Return Inconsistent Error Formats

```typescript
// ❌ Bad - inconsistent errors
return Response.json({ error: 'Not found' }, { status: 404 });
return Response.json({ message: 'Bad request' }, { status: 400 });
return new Response('Unauthorized', { status: 401 });

// ✅ Good - always use ChatSDKError
return new ChatSDKError('not_found:api', 'Resource not found').toResponse();
return new ChatSDKError('bad_request:api', 'Invalid input').toResponse();
return new ChatSDKError('unauthorized:auth').toResponse();
```

### DON'T: Block Response for Background Tasks

```typescript
// ❌ Bad - waiting for title generation
export async function POST(req: Request) {
  const chat = await saveChat({ id, userId, title: 'New Chat' });
  const title = await generateTitle(message); // Blocks response!
  await updateChatTitle({ chatId: id, title });
  return Response.json(chat);
}

// ✅ Good - use after() for background tasks
export async function POST(req: Request) {
  const chat = await saveChat({ id, userId, title: 'New Chat' });
  
  after(async () => {
    const title = await generateTitle(message);
    await updateChatTitle({ chatId: id, title });
  });
  
  return Response.json(chat); // Returns immediately
}
```

### DON'T: Expose Internal Errors

```typescript
// ❌ Bad - exposes internals
catch (error) {
  return Response.json({
    stack: error.stack,
    query: sqlQuery,
  }, { status: 500 });
}

// ✅ Good - log internally, return safe message
catch (error) {
  console.error('Database error:', error);
  return new ChatSDKError('bad_request:database').toResponse();
}
```

## Route File Structure

```
app/api/
├── auth/
│   ├── [...all]/route.ts        # Better-auth catch-all
│   ├── forget-password/route.ts
│   └── reset-password/route.ts
├── search/
│   ├── route.ts                 # POST /api/search
│   └── [id]/
│       └── stream/route.ts      # GET /api/search/[id]/stream
├── admin/
│   ├── stats/route.ts
│   ├── users/route.ts
│   └── users/[id]/
│       ├── route.ts             # GET/PATCH /api/admin/users/[id]
│       ├── reset-password/route.ts
│       └── subscription/route.ts
└── webhooks/
    └── create-user/route.ts
```

## Patterns

### Pattern 1: Paginated List Endpoint

```typescript
// app/api/admin/users/route.ts
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return new ChatSDKError('forbidden:api').toResponse();
  }
  
  const { searchParams } = new URL(req.url);
  const params = querySchema.parse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    role: searchParams.get('role'),
  });
  
  const { users, total } = await getUsers(params);
  
  return Response.json({
    data: users,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
}
```

### Pattern 2: Rate Limited Endpoint

```typescript
// Check rate limits for non-pro users
const { count } = await getUserMessageCount(user);
const dailyLimit = 100;

if (!user.isProUser && count >= dailyLimit) {
  return new ChatSDKError('rate_limit:chat', 'Daily search limit reached').toResponse();
}

// Track usage after successful response
after(async () => {
  if (!shouldBypassRateLimits(model, user)) {
    await incrementMessageUsage({ userId: user.id });
  }
});
```

### Pattern 3: Dynamic Route Parameters

```typescript
// app/api/admin/users/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // Next.js 15 - params is async
  
  const user = await getUserById(id);
  if (!user) {
    return new ChatSDKError('not_found:api', `User ${id} not found`).toResponse();
  }
  
  return Response.json(user);
}
```

## Testing Standards

```typescript
import { describe, it, expect, mock } from 'node:test';

describe('POST /api/search', () => {
  it('should require authentication', async () => {
    mock.method(auth, 'getCurrentUser', () => null);
    
    const response = await POST(new Request('http://test/api/search', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    }));
    
    expect(response.status).toBe(401);
  });
  
  it('should enforce rate limits for free users', async () => {
    mock.method(auth, 'getCurrentUser', () => ({ id: '1', isProUser: false }));
    mock.method(db, 'getUserMessageCount', () => ({ count: 100 }));
    
    const response = await POST(new Request('http://test/api/search', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    }));
    
    expect(response.status).toBe(429);
  });
});
```

## Resources

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Vercel AI SDK Streaming](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming-data)
- [better-auth Webhooks](https://www.better-auth.com/docs/concepts/webhooks)
