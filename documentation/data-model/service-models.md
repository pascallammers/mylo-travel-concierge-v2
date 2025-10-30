# Service Layer Models

## Overview

This document describes the service layer architecture, including data access patterns, business logic, and service interactions. The service layer is implemented in `lib/db/queries.ts` and provides an abstraction over the database schema.

## Architecture Overview

```mermaid
graph TB
    subgraph "Application Layer"
        UI[UI Components]
        Actions[Server Actions]
        API[API Routes]
    end
    
    subgraph "Service Layer"
        UserService[User Service]
        ChatService[Chat Service]
        MessageService[Message Service]
        SubscriptionService[Subscription Service]
        UsageService[Usage Tracking Service]
        LookoutService[Lookout Service]
        Cache[Performance Cache]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL via Drizzle)]
    end
    
    UI --> Actions
    UI --> API
    Actions --> UserService
    Actions --> ChatService
    Actions --> MessageService
    Actions --> SubscriptionService
    Actions --> UsageService
    Actions --> LookoutService
    API --> UserService
    API --> ChatService
    
    UserService --> Cache
    SubscriptionService --> Cache
    Cache --> DB
    
    UserService --> DB
    ChatService --> DB
    MessageService --> DB
    SubscriptionService --> DB
    UsageService --> DB
    LookoutService --> DB
```

## Service Modules

### 1. User Service

**Purpose**: Manage user authentication, profile data, and user-related queries.

```mermaid
graph LR
    A[User Service] --> B[Get User]
    A --> C[Get User By ID]
    A --> D[User Authentication]
    
    B --> E[Database Query]
    C --> E
    D --> E
    
    E --> F[Return User Data]
```

**Operations**:
- `getUser(email)`: Fetch user by email with caching
- `getUserById(id)`: Fetch user by ID with caching

**Caching**: User queries leverage Drizzle's `$withCache()` for performance.

**Error Handling**: All operations throw `ChatSDKError` with specific error codes.

---

### 2. Chat Service

**Purpose**: Manage chat creation, retrieval, updates, and deletion.

```mermaid
sequenceDiagram
    participant UI
    participant ChatService
    participant DB
    participant Cache
    
    UI->>ChatService: saveChat(data)
    ChatService->>DB: Insert chat record
    DB-->>ChatService: Chat created
    ChatService-->>UI: Return chat
    
    UI->>ChatService: getChatById(id)
    ChatService->>Cache: Check cache
    alt Cache Hit
        Cache-->>ChatService: Return cached data
    else Cache Miss
        ChatService->>DB: Query database
        DB-->>ChatService: Chat data
        ChatService->>Cache: Store in cache
    end
    ChatService-->>UI: Return chat
```

**Operations**:

**CRUD Operations**:
- `saveChat({id, userId, title, visibility})`: Create new chat
- `getChatById({id})`: Retrieve chat with caching
- `getChatWithUserById({id})`: Retrieve chat with user info joined
- `getChatsByUserId({id, limit, startingAfter, endingBefore})`: Paginated chat list
- `updateChatTitleById({chatId, title})`: Update chat title
- `updateChatVisibilityById({chatId, visibility})`: Update visibility (public/private)
- `deleteChatById({id})`: Delete chat and all related messages/streams

**Visibility Options**: `public` | `private`

**Pagination**: Cursor-based pagination using `startingAfter` and `endingBefore`

---

### 3. Message Service

**Purpose**: Handle message creation, retrieval, and deletion within chats.

```mermaid
graph TD
    A[Message Service] --> B[Create Messages]
    A --> C[Get Messages]
    A --> D[Delete Messages]
    
    B --> B1[saveMessages]
    C --> C1[getMessagesByChatId]
    C --> C2[getMessageById]
    D --> D1[deleteMessagesByChatIdAfterTimestamp]
    D --> D2[deleteTrailingMessages]
    
    C1 --> E[Paginated Results]
    D1 --> F[Cascade Delete]
```

**Operations**:

**CRUD Operations**:
- `saveMessages({messages})`: Bulk insert messages
- `getMessagesByChatId({id, limit, offset})`: Paginated message retrieval
- `getMessageById({id})`: Single message retrieval
- `deleteMessagesByChatIdAfterTimestamp({chatId, timestamp})`: Delete messages after a timestamp
- `deleteTrailingMessages({id})`: Delete all messages after a specific message

**Message Structure**:
```typescript
{
  id: string,
  chatId: string,
  role: 'user' | 'assistant' | 'tool',
  parts: JSON,  // Message content parts
  attachments: JSON,
  createdAt: Date,
  model?: string,
  inputTokens?: number,
  outputTokens?: number,
  totalTokens?: number,
  completionTime?: number
}
```

**Pagination**: Offset-based pagination with default limit of 50 messages.

---

### 4. Stream Service

**Purpose**: Track active streaming responses for chats.

```mermaid
graph LR
    A[Stream Service] --> B[createStreamId]
    A --> C[getStreamIdsByChatId]
    
    B --> D[Track Active Stream]
    C --> E[List All Streams for Chat]
```

**Operations**:
- `createStreamId({streamId, chatId})`: Register a new stream
- `getStreamIdsByChatId({chatId})`: Get all stream IDs for a chat

**Use Case**: Track multiple concurrent streaming responses within a single chat.

---

### 5. Subscription Service

**Purpose**: Manage user subscriptions from Polar webhook data.

```mermaid
sequenceDiagram
    participant Webhook
    participant SubscriptionService
    participant DB
    
    Webhook->>SubscriptionService: Polar webhook event
    SubscriptionService->>DB: Upsert subscription
    DB-->>SubscriptionService: Confirmation
    SubscriptionService-->>Webhook: 200 OK
```

**Data Source**: Polar webhooks populate subscription data.

**Subscription States**:
- Active: User has an active subscription
- Canceled: Subscription is canceled but still active until period end
- Expired: Subscription has ended

**Fields Tracked**:
- Billing cycle (recurring interval, current period)
- Cancellation status and reason
- Product/discount information
- Custom metadata

---

### 6. Payment Service

**Purpose**: Process and track payments from Dodo Payments webhooks.

```mermaid
graph TB
    A[Payment Service] --> B[Create/Update Payment]
    A --> C[Get Payments]
    A --> D[Check Pro Status]
    
    C --> C1[getPaymentsByUserId]
    C --> C2[getSuccessfulPaymentsByUserId]
    C --> C3[getTotalPaymentAmountByUserId]
    
    D --> D1[hasSuccessfulDodoPayment]
    D --> D2[isDodoPaymentsProExpired]
    D --> D3[getDodoPaymentsExpirationInfo]
    
    B --> E[Cache Update]
    C1 --> F[Cache Lookup]
```

**Operations**:

**CRUD Operations**:
- `getPaymentsByUserId({userId})`: Get all payments with caching
- `getPaymentById({paymentId})`: Get single payment
- `getSuccessfulPaymentsByUserId({userId})`: Filter by status='succeeded'
- `getTotalPaymentAmountByUserId({userId})`: Sum of successful payments

**Pro Status Checks**:
- `hasSuccessfulDodoPayment({userId})`: Check if user has any successful payment
- `isDodoPaymentsProExpired({userId})`: Check if payment is older than 1 month
- `getDodoPaymentsExpirationInfo({userId})`: Get detailed expiration info

**Caching**:
- Uses `getDodoPayments()` and `setDodoPayments()` from performance cache
- Uses `getDodoProStatus()` and `setDodoProStatus()` for status checks

**Payment Lifecycle**:
```mermaid
stateDiagram-v2
    [*] --> Pending: Payment Initiated
    Pending --> Succeeded: Payment Successful
    Pending --> Failed: Payment Failed
    Succeeded --> Expired: 1 Month Passes
    Expired --> Succeeded: New Payment
```

---

### 7. Usage Tracking Service

**Purpose**: Track and enforce usage limits for messages and extreme searches.

```mermaid
graph TB
    A[Usage Tracking] --> B[Message Usage]
    A --> C[Extreme Search Usage]
    
    B --> B1[Daily Reset]
    B --> B2[getMessageUsageByUserId]
    B --> B3[incrementMessageUsage]
    B --> B4[getMessageCount]
    B --> B5[getHistoricalUsageData]
    
    C --> C1[Monthly Reset]
    C --> C2[getExtremeSearchUsageByUserId]
    C --> C3[incrementExtremeSearchUsage]
    C --> C4[getExtremeSearchCount]
```

**Message Usage**:
- **Reset Frequency**: Daily at midnight
- **Cleanup**: Previous day entries auto-deleted on increment
- Operations:
  - `getMessageUsageByUserId({userId})`: Current day usage
  - `incrementMessageUsage({userId})`: Increment counter
  - `getMessageCount({userId})`: Get count for rate limiting
  - `getHistoricalUsageData({userId, months})`: Chart data from actual messages

**Extreme Search Usage**:
- **Reset Frequency**: Monthly (first day of next month)
- Operations:
  - `getExtremeSearchUsageByUserId({userId})`: Current month usage
  - `incrementExtremeSearchUsage({userId})`: Increment counter
  - `getExtremeSearchCount({userId})`: Get count for rate limiting

**Usage Flow**:
```mermaid
sequenceDiagram
    participant User
    participant UsageService
    participant DB
    
    User->>UsageService: Send message
    UsageService->>DB: Get current usage
    DB-->>UsageService: Usage count
    UsageService->>UsageService: Check limits
    alt Under limit
        UsageService->>DB: Increment usage
        UsageService-->>User: Process request
    else Over limit
        UsageService-->>User: 429 Rate Limited
    end
```

---

### 8. Lookout Service

**Purpose**: Manage scheduled automated searches and their execution history.

```mermaid
graph TB
    A[Lookout Service] --> B[CRUD Operations]
    A --> C[Status Management]
    A --> D[Execution Tracking]
    
    B --> B1[createLookout]
    B --> B2[getLookoutsByUserId]
    B --> B3[getLookoutById]
    B --> B4[updateLookout]
    B --> B5[deleteLookout]
    
    C --> C1[updateLookoutStatus]
    C --> C2[Status: active/paused/archived/running]
    
    D --> D1[updateLookoutLastRun]
    D --> D2[getLookoutRunStats]
    D --> D3[Track run history - JSON]
```

**Operations**:

**CRUD**:
- `createLookout({...})`: Create scheduled search
- `getLookoutsByUserId({userId})`: Get all user lookouts
- `getLookoutById({id})`: Get single lookout
- `updateLookout({id, ...})`: Update lookout configuration
- `deleteLookout({id})`: Remove lookout

**Status Management**:
- `updateLookoutStatus({id, status})`: Change status
- **Status Values**: `active`, `paused`, `archived`, `running`

**Execution Tracking**:
- `updateLookoutLastRun({id, lastRunAt, lastRunChatId, nextRunAt, ...})`: Log run completion
- `getLookoutRunStats({id})`: Get aggregated statistics

**Run History Structure**:
```typescript
{
  runAt: string,        // ISO date
  chatId: string,       // Generated chat ID
  status: 'success' | 'error' | 'timeout',
  error?: string,
  duration?: number,    // milliseconds
  tokensUsed?: number,
  searchesPerformed?: number
}
```

**Scheduling Flow**:
```mermaid
sequenceDiagram
    participant User
    participant LookoutService
    participant QStash
    participant Chat
    
    User->>LookoutService: Create Lookout
    LookoutService->>QStash: Schedule cron job
    QStash-->>LookoutService: Schedule ID
    LookoutService->>LookoutService: Save lookout
    
    loop On Schedule
        QStash->>LookoutService: Trigger execution
        LookoutService->>Chat: Create new chat
        LookoutService->>LookoutService: Update status to 'running'
        Chat-->>LookoutService: Chat created
        LookoutService->>LookoutService: Update lastRun + runHistory
        LookoutService->>LookoutService: Calculate next run
    end
```

---

### 9. Custom Instructions Service

**Purpose**: Manage user-specific AI customization preferences.

```mermaid
graph LR
    A[Custom Instructions Service] --> B[getCustomInstructionsByUserId]
    A --> C[createCustomInstructions]
    A --> D[updateCustomInstructions]
    A --> E[deleteCustomInstructions]
```

**Operations**:
- `getCustomInstructionsByUserId({userId})`: Get user's custom instructions (limit 1)
- `createCustomInstructions({userId, content})`: Create new instructions
- `updateCustomInstructions({userId, content})`: Update existing instructions
- `deleteCustomInstructions({userId})`: Remove instructions

**Use Case**: Users can provide persistent instructions that are included in every chat context.

---

## Error Handling

All service operations use a centralized error handling pattern:

```typescript
throw new ChatSDKError('bad_request:database', 'Descriptive error message')
```

**Error Types**:
- `bad_request:database`: Database query failures
- `not_found:database`: Resource not found
- Custom error codes for specific scenarios

## Caching Strategy

### 1. Drizzle Built-in Caching
- Uses `$withCache()` for frequently accessed queries
- Applied to: user lookups, chat retrieval, message fetching

### 2. Performance Cache Layer
Located in `lib/performance-cache.ts`:

**Payment Caching**:
- `getDodoPayments(userId)`: Get cached payments
- `setDodoPayments(userId, payments)`: Store payments
- `getDodoProStatus(userId)`: Get cached pro status
- `setDodoProStatus(userId, status)`: Store pro status

**Purpose**: Reduce database load for subscription/payment checks

### 3. React Query Caching
UI layer uses React Query for client-side caching (see UI Data Models doc)

## Service Data Flow

### Example: Message Creation Flow

```mermaid
sequenceDiagram
    participant UI
    participant Actions
    participant MessageService
    participant UsageService
    participant ChatService
    participant DB
    
    UI->>Actions: Submit message
    Actions->>UsageService: Check rate limits
    UsageService->>DB: Get usage count
    DB-->>UsageService: Current count
    
    alt Under limit
        Actions->>MessageService: Save message
        MessageService->>DB: Insert message
        Actions->>UsageService: Increment usage
        UsageService->>DB: Update count
        Actions->>ChatService: Update chat timestamp
        Actions-->>UI: Message sent
    else Over limit
        Actions-->>UI: Rate limit error
    end
```

### Example: Subscription Check Flow

```mermaid
sequenceDiagram
    participant UI
    participant Actions
    participant Cache
    participant SubscriptionService
    participant PaymentService
    participant DB
    
    UI->>Actions: Check pro status
    Actions->>Cache: Get cached status
    
    alt Cache hit
        Cache-->>Actions: Return status
    else Cache miss
        Actions->>SubscriptionService: Get Polar subscription
        Actions->>PaymentService: Get Dodo payments
        par Parallel queries
            SubscriptionService->>DB: Query subscriptions
            PaymentService->>DB: Query payments
        end
        DB-->>SubscriptionService: Subscription data
        DB-->>PaymentService: Payment data
        Actions->>Cache: Store combined status
    end
    
    Actions-->>UI: Pro status result
```

## Testing Considerations

- All service functions should be unit-testable
- Mock database layer using Drizzle mock utilities
- Test error handling paths
- Verify caching behavior
- Test cascade deletes
- Validate pagination logic

## Related Documentation

- [Database Schema ERD](./database-schema.md)
- [UI Data Models](./ui-data-models.md)
- [Performance Cache](../../lib/performance-cache.ts)
- [Error Handling](../../lib/errors.ts)
