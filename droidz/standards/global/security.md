# Security

## Overview

Security is critical for a travel concierge application handling user data, payments, and external API integrations. This standard defines security practices for the codebase.

## When to Apply

- Authentication and authorization
- API route handlers
- Environment variable handling
- User input processing
- External API integrations
- Database operations
- Payment processing

## Core Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Minimal access needed
3. **Fail Secure** - Default to deny on errors
4. **Input Validation** - Never trust external input
5. **Secret Management** - Never expose credentials

## ✅ DO

### DO: Validate User Authentication

```typescript
// app/api/search/route.ts
import { getCurrentUser } from '@/app/actions';
import { ChatSDKError } from '@/lib/errors';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  
  // Fail secure - require auth by default
  if (!user) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  // Check resource ownership
  const chat = await getChatById({ id: chatId });
  if (chat.userId !== user.id) {
    return new ChatSDKError('forbidden:chat', 'This chat belongs to another user').toResponse();
  }
  
  // Proceed with authorized request
}
```

### DO: Use Environment Variable Schemas

```typescript
// env/server.ts - server-only secrets
import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  POLAR_ACCESS_TOKEN: z.string().min(1),
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_SECRET: z.string().min(1),
});

export const serverEnv = serverEnvSchema.parse(process.env);

// env/client.ts - safe for browser
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STARTER_SLUG: z.string().min(1),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STARTER_SLUG: process.env.NEXT_PUBLIC_STARTER_SLUG,
});
```

### DO: Verify Webhook Signatures

```typescript
// lib/auth.ts - Polar webhook verification
webhooks({
  secret: process.env.POLAR_WEBHOOK_SECRET || (() => {
    throw new Error('POLAR_WEBHOOK_SECRET environment variable is required');
  })(),
  onPayload: async ({ data, type }) => {
    // Signature already verified by better-auth
    if (type === 'subscription.created') {
      // Safe to process
    }
  },
}),

// Dodo Payments webhook verification
dodowebhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    // Signature already verified
    console.log('🔔 Verified Dodo webhook:', payload.type);
  },
}),
```

### DO: Validate Foreign Key References

```typescript
// lib/auth.ts - check user exists before linking
let validUserId = null;
if (userId) {
  try {
    const userExists = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true },
    });
    validUserId = userExists ? userId : null;
    
    if (!userExists) {
      console.warn(`⚠️ User ${userId} not found, proceeding without link`);
    }
  } catch (error) {
    console.error('Error checking user existence:', error);
  }
}

// Only insert with validated userId
await db.insert(subscription).values({
  ...subscriptionData,
  userId: validUserId, // null if not found
});
```

### DO: Hash Passwords Properly

```typescript
// lib/auth.ts
import bcrypt from 'bcryptjs';

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
});
```

### DO: Use Parameterized Queries

```typescript
// lib/db/queries.ts - Drizzle handles parameterization
export async function getChatById({ id }: { id: string }) {
  // Drizzle automatically parameterizes
  const [selectedChat] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, id)); // Safe - parameterized
  return selectedChat;
}

// Never interpolate user input into queries
// ❌ db.execute(`SELECT * FROM chat WHERE id = '${id}'`)
// ✅ db.select().from(chat).where(eq(chat.id, id))
```

### DO: Rate Limit Sensitive Endpoints

```typescript
// lib/auth.ts
export const auth = betterAuth({
  rateLimit: {
    max: 50,      // Max requests
    window: 60,   // Per 60 seconds
  },
  // ...
});

// Custom rate limiting for API routes
const { count } = await getUserMessageCount(user);
if (count >= DAILY_MESSAGE_LIMIT) {
  return new ChatSDKError('rate_limit:chat', 'Daily limit reached').toResponse();
}
```

## ❌ DON'T

### DON'T: Expose Server Secrets to Client

```typescript
// ❌ Bad - server secret in client code
// components/payment.tsx
const apiKey = process.env.DODO_PAYMENTS_API_KEY; // Exposed!

// ✅ Good - use server-only module
// lib/payments.ts
import 'server-only';
import { serverEnv } from '@/env/server';

export const dodoPayments = new DodoPayments({
  bearerToken: serverEnv.DODO_PAYMENTS_API_KEY,
});
```

### DON'T: Log Sensitive Data

```typescript
// ❌ Bad - logging secrets
console.log('User data:', { password, apiKey, token });
console.log('Request:', JSON.stringify(req.headers)); // May contain auth

// ✅ Good - log only safe data
console.log('Processing payment for user:', userId);
console.log('Subscription status:', subscription.status);

// Redact sensitive fields
console.log('Payment data:', {
  id: payment.id,
  status: payment.status,
  cardLastFour: payment.cardLastFour,
  // Don't log: cardNumber, cvv, fullToken
});
```

### DON'T: Trust User Input

```typescript
// ❌ Bad - trusting user-provided ID
export async function DELETE(req: Request) {
  const { chatId } = await req.json();
  await db.delete(chat).where(eq(chat.id, chatId)); // Anyone can delete!
}

// ✅ Good - verify ownership
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new ChatSDKError('unauthorized:auth').toResponse();
  }
  
  const { chatId } = await req.json();
  const existingChat = await getChatById({ id: chatId });
  
  if (!existingChat || existingChat.userId !== user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }
  
  await db.delete(chat).where(eq(chat.id, chatId));
}
```

### DON'T: Return Detailed Error Information

```typescript
// ❌ Bad - exposes internals
catch (error) {
  return Response.json({
    error: error.stack,
    query: sqlQuery,
    connectionString: DATABASE_URL,
  }, { status: 500 });
}

// ✅ Good - generic error to user, detailed to logs
catch (error) {
  console.error('Database error:', error); // Log internally
  return new ChatSDKError('bad_request:database').toResponse();
}
```

### DON'T: Store Tokens in Plain Text URLs

```typescript
// ❌ Bad - token in URL (logged everywhere)
const url = `${baseUrl}/reset-password?token=${token}`;

// ✅ Good - use POST body or short-lived tokens
// Store token in DB, pass only identifier in URL
const resetUrl = buildResetPasswordUrl({
  baseUrl,
  token, // Short-lived, hashed in DB
  email: user.email,
});
```

## Patterns & Examples

### Pattern 1: Trusted Origins Configuration

```typescript
// lib/auth.ts
export const auth = betterAuth({
  trustedOrigins: [
    'http://localhost:3000',
    'https://mylo-travel-concierge-v2.vercel.app',
    'https://mylo-travel-concierge-v2-*.vercel.app', // Preview deployments
  ],
  allowedOrigins: [
    'http://localhost:3000',
    'https://mylo-travel-concierge-v2.vercel.app',
    'https://mylo-travel-concierge-v2-*.vercel.app',
  ],
});
```

### Pattern 2: Secure Session Handling

```typescript
// lib/auth.ts
export const auth = betterAuth({
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60, // 5 minutes cache
  },
  // Session data stored server-side
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, verification, account },
  }),
});
```

### Pattern 3: Input Sanitization for AI Tools

```typescript
// lib/tools/flight-search.ts
execute: async (params) => {
  // Validate dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const departDate = new Date(params.departDate);
  if (departDate < today) {
    throw new Error('Departure date cannot be in the past');
  }
  
  // Sanitize string inputs
  const origin = resolveIATACode(params.origin.trim().toUpperCase());
  const destination = resolveIATACode(params.destination.trim().toUpperCase());
  
  if (!origin || !destination) {
    throw new Error('Invalid airport codes');
  }
  
  // Safe to proceed
}
```

## Security Checklist

- [ ] All API routes check authentication
- [ ] Resource ownership verified before operations
- [ ] Environment variables validated with Zod
- [ ] No secrets in client-accessible code
- [ ] Webhook signatures verified
- [ ] Rate limiting enabled
- [ ] User input validated with Zod
- [ ] Passwords hashed with bcrypt
- [ ] No sensitive data in logs
- [ ] SQL injection prevented (parameterized queries)
- [ ] CORS configured properly
- [ ] Error responses don't leak internals

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/authentication)
- [better-auth Security](https://www.better-auth.com/docs/concepts/security)
