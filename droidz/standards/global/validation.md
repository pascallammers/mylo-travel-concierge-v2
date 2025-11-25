# Validation

## Overview

This project uses Zod for all validation. Validation should happen at system boundaries: API inputs, form submissions, AI tool parameters, and external API responses.

## When to Apply

- API route request bodies
- AI tool input schemas
- Form submissions
- Environment variables
- External API responses
- Database query parameters

## Core Principles

1. **Validate at Boundaries** - Check data when entering or leaving the system
2. **Use Zod Everywhere** - Consistent validation library across the stack
3. **Type Inference** - Use `z.infer<typeof schema>` for TypeScript types
4. **Meaningful Errors** - Provide clear error messages for validation failures
5. **Coerce When Needed** - Use `z.coerce` for type conversions

## ✅ DO

### DO: Define Schemas with Zod

```typescript
// lib/tools/flight-search.ts
import { z } from 'zod';

const flightSearchSchema = z.object({
  origin: z
    .string()
    .min(3)
    .describe('Origin city or airport code'),
  destination: z
    .string()
    .min(3)
    .describe('Destination city or airport code'),
  departDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Departure date in YYYY-MM-DD format'),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .describe('Return date (optional)'),
  cabin: z
    .enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
    .describe('Cabin class'),
  passengers: z
    .number()
    .int()
    .min(1)
    .max(9)
    .default(1)
    .describe('Number of passengers'),
});

type FlightSearchParams = z.infer<typeof flightSearchSchema>;
```

### DO: Use inputSchema for AI Tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const webSearchTool = tool({
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().min(1).max(500).describe('Search query'),
    maxResults: z.number().int().min(1).max(20).default(10),
    includeImages: z.boolean().default(false),
  }),
  execute: async (params) => {
    // params is fully typed from schema
    const { query, maxResults, includeImages } = params;
    // ...
  },
});
```

### DO: Validate API Request Bodies

```typescript
// app/api/upload/route.ts
import { z } from 'zod';

const uploadSchema = z.object({
  filename: z.string().min(1),
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
  // Continue with validated data...
}
```

### DO: Validate Environment Variables

```typescript
// env/server.ts
import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  POLAR_ACCESS_TOKEN: z.string().min(1),
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const serverEnv = serverEnvSchema.parse(process.env);
```

### DO: Use Coercion for Query Parameters

```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const params = paginationSchema.parse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sort: searchParams.get('sort'),
  });
  // params.page is now a number, not string
}
```

## ❌ DON'T

### DON'T: Skip Validation on External Input

```typescript
// ❌ Bad - trusting external input
export async function POST(req: Request) {
  const { userId, amount } = await req.json();
  await processPayment(userId, amount);
}

// ✅ Good - validate everything
const paymentSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive().max(10000),
});

export async function POST(req: Request) {
  const result = paymentSchema.safeParse(await req.json());
  if (!result.success) {
    return Response.json({ error: result.error.flatten() }, { status: 400 });
  }
  await processPayment(result.data.userId, result.data.amount);
}
```

### DON'T: Use Manual Type Assertions

```typescript
// ❌ Bad - manual type assertion
interface User {
  id: string;
  email: string;
}
const user = data as User;

// ✅ Good - schema validation with type inference
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
type User = z.infer<typeof userSchema>;
const user = userSchema.parse(data);
```

### DON'T: Validate Too Late

```typescript
// ❌ Bad - validation happens deep in the code
async function processOrder(data: unknown) {
  const items = (data as any).items;
  for (const item of items) {
    // Validation should happen before this
    if (!item.productId) throw new Error('Missing productId');
  }
}

// ✅ Good - validate at entry point
const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

async function processOrder(data: unknown) {
  const order = orderSchema.parse(data);
  for (const item of order.items) {
    // item is fully typed and validated
  }
}
```

## Patterns & Examples

### Pattern 1: Form Validation with react-hook-form

```typescript
// components/settings-dialog.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const settingsSchema = z.object({
  displayName: z.string().min(2).max(50),
  email: z.string().email(),
  timezone: z.string(),
  notifications: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsDialog() {
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notifications: true,
    },
  });
  
  const onSubmit = async (data: SettingsForm) => {
    // data is fully validated
    await updateSettings(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

### Pattern 2: API Response Validation

```typescript
// lib/api/amadeus-client.ts
const flightOfferSchema = z.object({
  id: z.string(),
  price: z.object({
    total: z.string(),
    currency: z.string(),
  }),
  itineraries: z.array(z.object({
    duration: z.string(),
    segments: z.array(z.object({
      departure: z.object({
        iataCode: z.string(),
        at: z.string(),
      }),
      arrival: z.object({
        iataCode: z.string(),
        at: z.string(),
      }),
    })),
  })),
});

const amadeusResponseSchema = z.object({
  data: z.array(flightOfferSchema),
});

export async function searchFlights(params: SearchParams) {
  const response = await fetch(AMADEUS_URL, { /* ... */ });
  const json = await response.json();
  
  // Validate external API response
  const result = amadeusResponseSchema.safeParse(json);
  if (!result.success) {
    console.error('Invalid Amadeus response:', result.error);
    throw new Error('Invalid response from flight API');
  }
  
  return result.data.data;
}
```

### Pattern 3: Webhook Payload Validation

```typescript
// Polar webhook validation
const subscriptionEventSchema = z.object({
  type: z.enum([
    'subscription.created',
    'subscription.active',
    'subscription.canceled',
  ]),
  data: z.object({
    id: z.string(),
    status: z.string(),
    customerId: z.string(),
    customer: z.object({
      externalId: z.string().optional(),
      email: z.string().email(),
    }),
    amount: z.number(),
    currency: z.string(),
    currentPeriodStart: z.string(),
    currentPeriodEnd: z.string(),
  }),
});

// In webhook handler
const parsed = subscriptionEventSchema.safeParse(payload);
if (!parsed.success) {
  console.error('Invalid webhook payload:', parsed.error.flatten());
  return Response.json({ error: 'Invalid payload' }, { status: 400 });
}
```

## Testing Standards

```typescript
import { describe, it, expect } from 'node:test';
import { z } from 'zod';

describe('Validation Schemas', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(0).max(150),
  });
  
  it('should validate correct input', () => {
    const result = schema.safeParse({
      email: 'test@example.com',
      age: 25,
    });
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const result = schema.safeParse({
      email: 'invalid',
      age: 25,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['email']);
  });
  
  it('should reject negative age', () => {
    const result = schema.safeParse({
      email: 'test@example.com',
      age: -1,
    });
    expect(result.success).toBe(false);
  });
});
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)
- [AI SDK Tool Schemas](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
