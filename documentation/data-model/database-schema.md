# Database Schema - Entity Relationship Diagram

## Overview

This document provides a comprehensive view of the database schema for the Mylo Travel Concierge application. The schema is managed using Drizzle ORM with PostgreSQL as the underlying database.

## Core Entities

### Authentication & User Management

```mermaid
erDiagram
    USER ||--o{ SESSION : has
    USER ||--o{ ACCOUNT : has
    USER ||--o{ CHAT : creates
    USER ||--o{ SUBSCRIPTION : has
    USER ||--o{ PAYMENT : makes
    USER ||--o{ EXTREME_SEARCH_USAGE : tracks
    USER ||--o{ MESSAGE_USAGE : tracks
    USER ||--o{ CUSTOM_INSTRUCTIONS : has
    USER ||--o{ LOOKOUT : schedules

    USER {
        text id PK
        text name
        text email UK
        boolean email_verified
        text image
        timestamp created_at
        timestamp updated_at
    }

    SESSION {
        text id PK
        text user_id FK
        timestamp expires_at
        text token UK
        timestamp created_at
        timestamp updated_at
        text ip_address
        text user_agent
    }

    ACCOUNT {
        text id PK
        text user_id FK
        text account_id
        text provider_id
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text password
        timestamp created_at
        timestamp updated_at
    }

    VERIFICATION {
        text id PK
        text identifier
        text value
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }
```

### Core Application Data

```mermaid
erDiagram
    CHAT ||--o{ MESSAGE : contains
    CHAT ||--o{ STREAM : has
    CHAT }o--|| USER : "belongs to"

    CHAT {
        text id PK
        text user_id FK
        text title
        timestamp created_at
        timestamp updated_at
        varchar visibility "enum: public, private"
    }

    MESSAGE {
        text id PK
        text chat_id FK
        text role "user, assistant, or tool"
        json parts "message parts"
        json attachments
        timestamp created_at
        text model
        integer input_tokens
        integer output_tokens
        integer total_tokens
        real completion_time
    }

    STREAM {
        text id PK
        text chat_id FK
        timestamp created_at
    }
```

### Subscription & Payment Management

```mermaid
erDiagram
    USER ||--o{ SUBSCRIPTION : has
    USER ||--o{ PAYMENT : makes

    SUBSCRIPTION {
        text id PK
        text user_id FK
        timestamp created_at
        timestamp modified_at
        integer amount
        text currency
        text recurring_interval
        text status
        timestamp current_period_start
        timestamp current_period_end
        boolean cancel_at_period_end
        timestamp canceled_at
        timestamp started_at
        timestamp ends_at
        timestamp ended_at
        text customer_id
        text product_id
        text discount_id
        text checkout_id
        text customer_cancellation_reason
        text customer_cancellation_comment
        text metadata "JSON string"
        text custom_field_data "JSON string"
    }

    PAYMENT {
        text id PK
        text user_id FK
        timestamp created_at
        timestamp updated_at
        text brand_id
        text business_id
        text card_issuing_country
        text card_last_four
        text card_network
        text card_type
        text currency
        boolean digital_products_delivered
        text discount_id
        text error_code
        text error_message
        text payment_link
        text payment_method
        text payment_method_type
        integer settlement_amount
        text settlement_currency
        integer settlement_tax
        text status
        text subscription_id
        integer tax
        integer total_amount
        json billing "Billing address object"
        json customer "Customer data object"
        json disputes "Disputes array"
        json metadata "Metadata object"
        json product_cart "Product cart array"
        json refunds "Refunds array"
    }
```

### Usage Tracking

```mermaid
erDiagram
    USER ||--o{ EXTREME_SEARCH_USAGE : tracks
    USER ||--o{ MESSAGE_USAGE : tracks

    EXTREME_SEARCH_USAGE {
        text id PK
        text user_id FK
        integer search_count
        timestamp date
        timestamp reset_at
        timestamp created_at
        timestamp updated_at
    }

    MESSAGE_USAGE {
        text id PK
        text user_id FK
        integer message_count
        timestamp date
        timestamp reset_at
        timestamp created_at
        timestamp updated_at
    }
```

### Features

```mermaid
erDiagram
    USER ||--o{ CUSTOM_INSTRUCTIONS : has
    USER ||--o{ LOOKOUT : schedules
    LOOKOUT ||--o{ CHAT : "generates"

    CUSTOM_INSTRUCTIONS {
        text id PK
        text user_id FK
        text content
        timestamp created_at
        timestamp updated_at
    }

    LOOKOUT {
        text id PK
        text user_id FK
        text title
        text prompt
        text frequency "once, daily, weekly, monthly, yearly"
        text cron_schedule
        text timezone
        timestamp next_run_at
        text qstash_schedule_id
        text status "active, paused, archived, running"
        timestamp last_run_at
        text last_run_chat_id
        json run_history "Array of run records"
        timestamp created_at
        timestamp updated_at
    }
```

## Complete Schema Overview

```mermaid
erDiagram
    USER ||--o{ SESSION : has
    USER ||--o{ ACCOUNT : has
    USER ||--o{ CHAT : creates
    USER ||--o{ SUBSCRIPTION : has
    USER ||--o{ PAYMENT : makes
    USER ||--o{ EXTREME_SEARCH_USAGE : tracks
    USER ||--o{ MESSAGE_USAGE : tracks
    USER ||--o{ CUSTOM_INSTRUCTIONS : has
    USER ||--o{ LOOKOUT : schedules
    
    CHAT ||--o{ MESSAGE : contains
    CHAT ||--o{ STREAM : has
    
    LOOKOUT ||--o{ CHAT : "generates (last_run_chat_id)"

    USER {
        text id PK "Primary Key"
        text name
        text email UK "Unique"
        boolean email_verified
        text image
        timestamp created_at
        timestamp updated_at
    }

    SESSION {
        text id PK
        text user_id FK "CASCADE DELETE"
        timestamp expires_at
        text token UK
        timestamp created_at
        timestamp updated_at
        text ip_address
        text user_agent
    }

    ACCOUNT {
        text id PK
        text user_id FK "CASCADE DELETE"
        text account_id
        text provider_id
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text password
        timestamp created_at
        timestamp updated_at
    }

    CHAT {
        text id PK
        text user_id FK
        text title
        timestamp created_at
        timestamp updated_at
        varchar visibility "enum: public, private"
    }

    MESSAGE {
        text id PK
        text chat_id FK "CASCADE DELETE"
        text role
        json parts
        json attachments
        timestamp created_at
        text model
        integer input_tokens
        integer output_tokens
        integer total_tokens
        real completion_time
    }

    STREAM {
        text id PK
        text chat_id FK "CASCADE DELETE"
        timestamp created_at
    }

    SUBSCRIPTION {
        text id PK
        text user_id FK
        timestamp created_at
        timestamp modified_at
        integer amount
        text currency
        text recurring_interval
        text status
        timestamp current_period_start
        timestamp current_period_end
        boolean cancel_at_period_end
        timestamp canceled_at
        timestamp started_at
        timestamp ends_at
        timestamp ended_at
        text customer_id
        text product_id
        text discount_id
        text checkout_id
        text customer_cancellation_reason
        text customer_cancellation_comment
        text metadata
        text custom_field_data
    }

    PAYMENT {
        text id PK
        text user_id FK
        timestamp created_at
        timestamp updated_at
        text brand_id
        text business_id
        text card_issuing_country
        text card_last_four
        text card_network
        text card_type
        text currency
        boolean digital_products_delivered
        text discount_id
        text error_code
        text error_message
        text payment_link
        text payment_method
        text payment_method_type
        integer settlement_amount
        text settlement_currency
        integer settlement_tax
        text status
        text subscription_id
        integer tax
        integer total_amount
        json billing
        json customer
        json disputes
        json metadata
        json product_cart
        json refunds
    }

    EXTREME_SEARCH_USAGE {
        text id PK
        text user_id FK "CASCADE DELETE"
        integer search_count
        timestamp date
        timestamp reset_at
        timestamp created_at
        timestamp updated_at
    }

    MESSAGE_USAGE {
        text id PK
        text user_id FK "CASCADE DELETE"
        integer message_count
        timestamp date
        timestamp reset_at
        timestamp created_at
        timestamp updated_at
    }

    CUSTOM_INSTRUCTIONS {
        text id PK
        text user_id FK "CASCADE DELETE"
        text content
        timestamp created_at
        timestamp updated_at
    }

    LOOKOUT {
        text id PK
        text user_id FK "CASCADE DELETE"
        text title
        text prompt
        text frequency
        text cron_schedule
        text timezone
        timestamp next_run_at
        text qstash_schedule_id
        text status
        timestamp last_run_at
        text last_run_chat_id
        json run_history
        timestamp created_at
        timestamp updated_at
    }

    VERIFICATION {
        text id PK
        text identifier
        text value
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }
```

## Key Relationships

### Authentication Flow
- **USER** → **SESSION**: One-to-many relationship with cascade delete
- **USER** → **ACCOUNT**: One-to-many relationship for multiple OAuth providers with cascade delete
- **VERIFICATION**: Standalone table for email/phone verification tokens

### Core Application
- **USER** → **CHAT**: Users can create multiple chats
- **CHAT** → **MESSAGE**: Chats contain multiple messages with cascade delete
- **CHAT** → **STREAM**: Chats track active streams with cascade delete

### Subscription & Billing
- **USER** → **SUBSCRIPTION**: Users can have subscriptions (Polar webhooks)
- **USER** → **PAYMENT**: Users can make payments (Dodo Payments webhooks)

### Usage Tracking
- **USER** → **EXTREME_SEARCH_USAGE**: Monthly search usage tracking with cascade delete
- **USER** → **MESSAGE_USAGE**: Daily message usage tracking with cascade delete

### Features
- **USER** → **CUSTOM_INSTRUCTIONS**: One-to-one relationship for custom AI instructions with cascade delete
- **USER** → **LOOKOUT**: Users can schedule multiple automated searches with cascade delete
- **LOOKOUT** → **CHAT**: Lookouts reference the last chat they generated

## Data Types Reference

### Primary Types
- **text**: Variable-length text field
- **timestamp**: PostgreSQL timestamp with time zone
- **boolean**: True/false values
- **integer**: 4-byte integer
- **real**: Single-precision floating point
- **json**: JSON data type for complex objects
- **varchar(enum)**: Enumerated text values

### Constraints
- **PK**: Primary Key
- **FK**: Foreign Key
- **UK**: Unique Key
- **CASCADE DELETE**: Foreign key with cascade delete on parent deletion

## Indexes

Indexes are defined in `create_indexes.sql` to optimize common queries:

1. **User lookups**: `user.email`
2. **Session validation**: `session.token`
3. **Chat queries**: `chat.user_id`, `chat.created_at`
4. **Message queries**: `message.chat_id`, `message.created_at`
5. **Usage tracking**: `message_usage.user_id + date`, `extreme_search_usage.user_id + date`
6. **Lookout queries**: `lookout.user_id`, `lookout.status`, `lookout.next_run_at`

## Data Retention & Cleanup

### Automatic Cleanup
- **Message Usage**: Previous day entries cleaned on daily reset
- **Sessions**: Expired sessions should be cleaned periodically
- **Lookout History**: Limited to last 100 runs per lookout

### Cascade Deletes
When a user is deleted:
- All sessions are deleted
- All accounts are deleted
- All extreme search usage records are deleted
- All message usage records are deleted
- All custom instructions are deleted
- All lookouts are deleted

When a chat is deleted:
- All messages in the chat are deleted
- All streams for the chat are deleted

## Schema File Locations

- **Schema Definition**: `lib/db/schema.ts`
- **Migrations**: `drizzle/migrations/`
- **Queries**: `lib/db/queries.ts`
- **Configuration**: `drizzle.config.ts`
- **Type Exports**: All tables export TypeScript types via `InferSelectModel`
