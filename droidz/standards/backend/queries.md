# Database Queries

## Overview

All database queries are centralized in `lib/db/queries.ts`. Queries use Drizzle ORM with caching via `.$withCache()` for read operations and proper error handling with ChatSDKError.

## When to Apply

- Fetching data from the database
- Creating, updating, or deleting records
- Implementing pagination
- Building complex queries

## Core Principles

1. **Centralized** - All queries in `lib/db/queries.ts`
2. **Cached Reads** - Use `.$withCache()` for read queries
3. **Error Handling** - Wrap with ChatSDKError
4. **Type Safety** - Full TypeScript with inferred types
5. **Transactions** - Use for multi-step operations

## ✅ DO

### DO: Use $withCache() for Read Queries

```typescript
// lib/db/queries.ts
import 'server-only';
import { db } from './index';
import { chat, user, message } from './schema';
import { eq, desc, and, gt } from 'drizzle-orm';
import { ChatSDKError } from '@/lib/errors';

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, id))
      .$withCache();  // Enable caching
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function getMessagesByChatId({
  id,
  limit = 50,
  offset = 0,
}: {
  id: string;
  limit?: number;
  offset?: number;
}) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt))
      .limit(limit)
      .offset(offset)
      .$withCache();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get messages');
  }
}
```

### DO: Wrap All Queries in Try-Catch

```typescript
export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: 'public' | 'private';
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat: ' + error);
  }
}
```

### DO: Use Drizzle Operators for Queries

```typescript
import { eq, and, or, gt, lt, gte, desc, asc, inArray } from 'drizzle-orm';

// Equality
.where(eq(user.id, userId))

// Multiple conditions
.where(and(
  eq(chat.userId, userId),
  eq(chat.visibility, 'public')
))

// Date comparisons
.where(gt(chat.createdAt, startDate))
.where(lt(message.createdAt, endDate))

// In array
.where(inArray(user.role, ['admin', 'moderator']))

// Ordering
.orderBy(desc(chat.createdAt))
.orderBy(asc(message.createdAt))
```

### DO: Implement Pagination Properly

```typescript
export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1; // Fetch one extra to check hasMore

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition 
            ? and(whereCondition, eq(chat.userId, id)) 
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit)
        .$withCache();

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [cursor] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);
      
      if (!cursor) {
        throw new ChatSDKError('not_found:database', `Chat ${startingAfter} not found`);
      }
      
      filteredChats = await query(gt(chat.createdAt, cursor.createdAt));
    } else if (endingBefore) {
      const [cursor] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);
      
      if (!cursor) {
        throw new ChatSDKError('not_found:database', `Chat ${endingBefore} not found`);
      }
      
      filteredChats = await query(lt(chat.createdAt, cursor.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chats');
  }
}
```

### DO: Use Upsert with onConflictDoUpdate

```typescript
export async function upsertSubscription(subscriptionData: SubscriptionData) {
  try {
    await db
      .insert(subscription)
      .values(subscriptionData)
      .onConflictDoUpdate({
        target: subscription.id,
        set: {
          modifiedAt: subscriptionData.modifiedAt || new Date(),
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.currentPeriodStart,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
          userId: subscriptionData.userId,
        },
      });
    console.log('✅ Upserted subscription:', subscriptionData.id);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to upsert subscription');
  }
}
```

### DO: Use Joins for Related Data

```typescript
export async function getChatWithUserById({ id }: { id: string }) {
  try {
    const [result] = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        visibility: chat.visibility,
        userId: chat.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(chat)
      .innerJoin(user, eq(chat.userId, user.id))
      .where(eq(chat.id, id))
      .$withCache();
    return result;
  } catch (error) {
    console.log('Error getting chat with user:', error);
    return null;
  }
}
```

## ❌ DON'T

### DON'T: Skip Error Handling

```typescript
// ❌ Bad - no error handling
export async function getUser(email: string) {
  return await db.select().from(user).where(eq(user.email, email));
}

// ✅ Good - proper error handling
export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .$withCache();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by email');
  }
}
```

### DON'T: Forget $withCache() for Read Queries

```typescript
// ❌ Bad - no caching
export async function getChatById({ id }: { id: string }) {
  const [chat] = await db.select().from(chat).where(eq(chat.id, id));
  return chat;
}

// ✅ Good - cached
export async function getChatById({ id }: { id: string }) {
  const [chat] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, id))
    .$withCache();
  return chat;
}
```

### DON'T: Use Raw SQL Unless Necessary

```typescript
// ❌ Bad - raw SQL with injection risk
const result = await db.execute(`SELECT * FROM user WHERE id = '${userId}'`);

// ✅ Good - Drizzle query builder (parameterized)
const result = await db.select().from(user).where(eq(user.id, userId));
```

### DON'T: Make Multiple Sequential Queries

```typescript
// ❌ Bad - N+1 query problem
const chats = await getChats();
for (const chat of chats) {
  chat.messages = await getMessagesByChatId(chat.id); // N queries!
}

// ✅ Good - single query with join or batch
const chatsWithMessages = await db
  .select()
  .from(chat)
  .leftJoin(message, eq(chat.id, message.chatId))
  .where(eq(chat.userId, userId));
```

## Query Patterns

### Pattern 1: Recording Tool Calls

```typescript
export async function recordToolCall({
  chatId,
  toolName,
  request,
}: {
  chatId: string;
  toolName: string;
  request: unknown;
}) {
  try {
    const [result] = await db
      .insert(toolCalls)
      .values({
        chatId,
        toolName,
        request,
        status: 'queued',
        createdAt: new Date(),
      })
      .returning();
    return result;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to record tool call');
  }
}

export async function updateToolCall(
  id: string,
  updates: {
    status?: ToolCallStatus;
    response?: unknown;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
  }
) {
  try {
    await db
      .update(toolCalls)
      .set(updates)
      .where(eq(toolCalls.id, id));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update tool call');
  }
}
```

### Pattern 2: Session State Management

```typescript
export async function mergeSessionState(
  chatId: string,
  newState: Partial<SessionStateData>
) {
  try {
    const existing = await db
      .select()
      .from(sessionStates)
      .where(eq(sessionStates.chatId, chatId))
      .limit(1);

    const currentState = existing[0]?.state || {};
    const mergedState = { ...currentState, ...newState };

    await db
      .insert(sessionStates)
      .values({
        chatId,
        state: mergedState,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sessionStates.chatId,
        set: {
          state: mergedState,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to merge session state');
  }
}
```

### Pattern 3: Increment Counters

```typescript
export async function incrementMessageUsage({ userId }: { userId: string }) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db
      .insert(messageUsage)
      .values({
        userId,
        messageCount: 1,
        date: today,
        resetAt: tomorrow,
      })
      .onConflictDoUpdate({
        target: [messageUsage.userId, messageUsage.date],
        set: {
          messageCount: sql`${messageUsage.messageCount} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to increment message usage:', error);
    // Don't throw - this is non-critical
  }
}
```

## Testing Standards

```typescript
import { describe, it, expect, beforeEach } from 'node:test';
import { db } from '@/lib/db';
import { getChatById, saveChat, deleteChatById } from './queries';

describe('Database Queries', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(chat).where(eq(chat.id, 'test-chat'));
  });
  
  it('should save and retrieve a chat', async () => {
    await saveChat({
      id: 'test-chat',
      userId: 'test-user',
      title: 'Test Chat',
      visibility: 'private',
    });
    
    const retrieved = await getChatById({ id: 'test-chat' });
    expect(retrieved).toBeDefined();
    expect(retrieved.title).toBe('Test Chat');
  });
  
  it('should throw ChatSDKError on not found', async () => {
    const result = await getChatById({ id: 'nonexistent' });
    expect(result).toBeUndefined();
  });
});
```

## Resources

- [Drizzle ORM Queries](https://orm.drizzle.team/docs/select)
- [Drizzle Filters](https://orm.drizzle.team/docs/operators)
- [lib/db/queries.ts](/lib/db/queries.ts) - Full queries file
