# Database Models

## Overview

This project uses Drizzle ORM with PostgreSQL (Neon serverless). All database schemas are defined in `lib/db/schema.ts` using Drizzle's type-safe schema builder.

## When to Apply

- Creating new database tables
- Adding columns to existing tables
- Defining relationships
- Creating type exports

## Core Principles

1. **Type Safety** - Use Drizzle's typed schema definitions
2. **Inferred Types** - Export types using `InferSelectModel`
3. **Consistent Naming** - snake_case for columns, camelCase for TypeScript
4. **Default Values** - Use `$defaultFn` for generated values
5. **Cascading** - Define cascade behavior for foreign keys

## ✅ DO

### DO: Define Tables with Proper Types

```typescript
// lib/db/schema.ts
import { 
  pgTable, 
  text, 
  timestamp, 
  boolean, 
  json, 
  varchar, 
  integer, 
  uuid, 
  real 
} from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
import { generateId } from 'ai';
import { v4 as uuidv4 } from 'uuid';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
});

export type User = InferSelectModel<typeof user>;
```

### DO: Use $defaultFn for Generated Values

```typescript
export const chat = pgTable('chat', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => uuidv4()),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export const message = pgTable('message', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId()), // AI SDK generateId
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### DO: Define Foreign Key Relationships

```typescript
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Cascades: when user is deleted, sessions are deleted
});

export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  userId: text('userId').references(() => user.id),
  // No cascade: subscription survives user deletion
});
```

### DO: Use Enums for Constrained Values

```typescript
// Define enum values as const array
export const toolCallStatus = [
  'queued', 
  'running', 
  'succeeded', 
  'failed', 
  'timeout', 
  'canceled'
] as const;

export type ToolCallStatus = (typeof toolCallStatus)[number];

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolName: text('tool_name').notNull(),
  status: text('status').$type<ToolCallStatus>().default('queued').notNull(),
  // ...
});
```

### DO: Use JSON for Complex Nested Data

```typescript
// Define the JSON structure as an interface
export interface SessionStateData {
  last_flight_request?: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string | null;
    cabin: string;
    passengers?: number;
  };
  pending_flight_request?: {
    origin?: string;
    destination?: string;
  } | null;
  preferences?: Record<string, unknown>;
}

export const sessionStates = pgTable('session_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' })
    .unique(),
  state: json('state').$type<SessionStateData>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### DO: Export Type Aliases

```typescript
// At the bottom of schema.ts
export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Chat = InferSelectModel<typeof chat>;
export type Message = InferSelectModel<typeof message>;
export type Subscription = InferSelectModel<typeof subscription>;
export type ToolCall = InferSelectModel<typeof toolCalls>;
export type SessionState = InferSelectModel<typeof sessionStates>;
```

## ❌ DON'T

### DON'T: Use Raw SQL Types Without Enums

```typescript
// ❌ Bad - no type safety
export const user = pgTable('user', {
  role: text('role').default('user'), // Any string allowed
  status: text('status'),              // No constraints
});

// ✅ Good - typed enums
export const user = pgTable('user', {
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  status: text('status', { 
    enum: ['active', 'inactive', 'suspended'] 
  }).default('active'),
});
```

### DON'T: Skip notNull for Required Fields

```typescript
// ❌ Bad - nullable when it shouldn't be
export const message = pgTable('message', {
  chatId: text('chat_id'),  // Can be null!
  role: text('role'),        // Can be null!
});

// ✅ Good - explicit not null
export const message = pgTable('message', {
  chatId: text('chat_id').notNull(),
  role: text('role').notNull(),
});
```

### DON'T: Forget Cascade Behavior

```typescript
// ❌ Bad - orphaned records when parent deleted
export const message = pgTable('message', {
  chatId: text('chat_id').references(() => chat.id), // No cascade
});

// ✅ Good - cleanup on delete
export const message = pgTable('message', {
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
});
```

### DON'T: Store Sensitive Data Unencrypted

```typescript
// ❌ Bad - plain text secrets
export const account = pgTable('account', {
  accessToken: text('access_token'),
  apiKey: text('api_key'),
});

// ✅ Good - use auth framework or encrypt
// Better-auth handles token storage securely
// For custom secrets, encrypt before storing
```

## Table Naming Conventions

| Pattern | Example | Notes |
|---------|---------|-------|
| Singular noun | `user`, `chat`, `message` | Table names |
| snake_case | `created_at`, `user_id` | Column names |
| camelCase | `userId`, `createdAt` | TypeScript fields |
| Junction tables | `user_roles`, `chat_tags` | Many-to-many |

## Common Patterns

### Pattern 1: Usage Tracking Tables

```typescript
export const messageUsage = pgTable('message_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  messageCount: integer('message_count').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Pattern 2: Webhook Data Tables

```typescript
export const payment = pgTable('payment', {
  id: text('id').primaryKey(), // External ID from webhook
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at'),
  status: text('status'),
  totalAmount: integer('total_amount').notNull(),
  currency: text('currency').notNull(),
  // JSON for complex webhook data
  billing: json('billing'),
  customer: json('customer'),
  metadata: json('metadata'),
  // Link to internal user (nullable - may not exist yet)
  userId: text('user_id').references(() => user.id),
});
```

### Pattern 3: Token/Secret Storage

```typescript
export const amadeusTokens = pgTable('amadeus_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: text('environment', { enum: ['test', 'prod'] }).notNull(),
  accessToken: text('access_token').notNull(),
  tokenType: text('token_type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Drizzle + Neon](https://orm.drizzle.team/docs/get-started-postgresql#neon)
- [lib/db/schema.ts](/lib/db/schema.ts) - Full schema
