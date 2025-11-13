# Security Standards

**Version:** 1.0.0
**Last Updated:** 2025-11-13

## Overview

Security must be built into every layer of the application. This document outlines essential security practices for authentication, data handling, API security, and preventing common vulnerabilities.

## Authentication & Authorization

### Password Handling

```typescript
// ✅ Use bcrypt for password hashing (already in project)
import bcrypt from 'bcryptjs'

// Hash password before storing
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12) // Use at least 10 rounds
  return bcrypt.hash(password, salt)
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ❌ Never store passwords in plain text
// ❌ Never log passwords
// ❌ Never send passwords in URLs
```

### Session Management

```typescript
// ✅ Use Better Auth (already configured)
import { auth } from '@/lib/auth'

// Server-side auth check
export default async function ProtectedPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return <div>Protected content for {session.user.email}</div>
}

// ✅ Set secure session cookies
// httpOnly: true (prevents XSS)
// secure: true (HTTPS only)
// sameSite: 'lax' (CSRF protection)
```

### Authorization

```typescript
// ✅ Always verify permissions server-side
export async function deletePost(postId: string) {
  const session = await auth()
  if (!session) {
    throw new Error('Unauthorized')
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId)
  })

  if (!post) {
    throw new Error('Post not found')
  }

  // Verify ownership
  if (post.authorId !== session.user.id) {
    throw new Error('Forbidden: You do not own this post')
  }

  await db.delete(posts).where(eq(posts.id, postId))
}

// ❌ Never trust client-side authorization checks
```

## Input Validation

### Validate All Inputs

```typescript
import { z } from 'zod'

// ✅ Use Zod for input validation
const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(100).trim(),
  age: z.number().int().min(0).max(150),
  website: z.string().url().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate and sanitize
    const validated = CreateUserSchema.parse(body)

    // validated data is now safe to use
    await createUser(validated)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    throw error
  }
}
```

### SQL Injection Prevention

```typescript
// ✅ Use Drizzle ORM (prevents SQL injection)
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Safe: parameterized queries
const user = await db.query.users.findFirst({
  where: eq(users.email, userEmail) // Safely parameterized
})

// ❌ Never build SQL strings manually
const query = `SELECT * FROM users WHERE email = '${userEmail}'` // Vulnerable!

// ✅ Even for complex queries, use Drizzle's query builder
const users = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(10)
```

## XSS Prevention

### Output Escaping

```typescript
// ✅ React automatically escapes content
function UserProfile({ user }: { user: User }) {
  // Safe: React escapes this automatically
  return <div>{user.bio}</div>
}

// ⚠️ Dangerous: Using dangerouslySetInnerHTML
function RichContent({ html }: { html: string }) {
  // Only use if you sanitize first!
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

// ✅ Sanitize HTML before rendering
import DOMPurify from 'isomorphic-dompurify'

function RichContent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target']
  })

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### Content Security Policy

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // ✅ Set strict CSP headers
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on needs
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  return response
}
```

## CSRF Protection

```typescript
// ✅ Use SameSite cookies (already configured in Better Auth)
// ✅ Verify Origin header for state-changing requests

export async function POST(request: NextRequest) {
  // Check Origin header matches our domain
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (origin && !origin.includes(host!)) {
    return NextResponse.json(
      { error: 'Invalid origin' },
      { status: 403 }
    )
  }

  // Process request
}
```

## Rate Limiting

```typescript
// ✅ Use Upstash Rate Limiting (already in project)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

// Create rate limiter
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
  analytics: true
})

export async function POST(request: NextRequest) {
  const ip = request.ip ?? 'anonymous'

  const { success, limit, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString()
        }
      }
    )
  }

  // Process request
}

// ✅ Different limits for different endpoints
const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m') // 5 login attempts per 15 min
})

const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m') // 100 API calls per minute
})
```

## Data Protection

### Environment Variables

```typescript
// ✅ Use @t3-oss/env-nextjs for type-safe env vars (already configured)
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    RESEND_API_KEY: z.string(),
    // Never expose these to client
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_ANALYTICS_ID: z.string().optional()
    // Only NEXT_PUBLIC_* vars are exposed to client
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID
  }
})

// ❌ Never commit .env files to git
// ✅ Use .env.example for documentation
// ✅ Validate env vars at startup
```

### Sensitive Data

```typescript
// ✅ Never log sensitive data
function loginUser(email: string, password: string) {
  console.log('User login attempt:', email) // ✅ OK
  // console.log('Password:', password) // ❌ NEVER

  // Process login
}

// ✅ Filter sensitive fields in responses
function sanitizeUser(user: User): PublicUser {
  const { password, resetToken, ...publicUser } = user
  return publicUser
}

export async function GET(request: NextRequest) {
  const user = await getUser(userId)
  return NextResponse.json(sanitizeUser(user))
}
```

## File Upload Security

```typescript
import { put } from '@vercel/blob'

// ✅ Validate file uploads
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large' },
      { status: 400 }
    )
  }

  // Generate safe filename (don't use user input directly)
  const extension = file.type.split('/')[1]
  const filename = `${crypto.randomUUID()}.${extension}`

  // Upload to blob storage
  const blob = await put(filename, file, {
    access: 'public',
    addRandomSuffix: false
  })

  return NextResponse.json({ url: blob.url })
}

// ❌ Never trust file extensions from client
// ❌ Never execute uploaded files
// ✅ Store uploads outside webroot
// ✅ Scan for malware if accepting user files
```

## API Security

### API Keys

```typescript
// ✅ Validate API keys in middleware
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      )
    }

    // Validate key (use timing-safe comparison)
    const isValid = await validateApiKey(apiKey)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

// ✅ Use timing-safe comparison for secrets
import { timingSafeEqual } from 'crypto'

function compareSecrets(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  if (bufA.length !== bufB.length) {
    return false
  }

  return timingSafeEqual(bufA, bufB)
}
```

### CORS

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // ✅ Strict CORS policy
  const allowedOrigins = [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ]

  const origin = request.headers.get('origin')

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
  }

  return response
}

// ❌ Never use '*' for Access-Control-Allow-Origin in production
```

## Error Handling

```typescript
// ✅ Don't leak sensitive info in error messages
export async function GET(request: NextRequest) {
  try {
    const data = await fetchSensitiveData()
    return NextResponse.json(data)
  } catch (error) {
    // ❌ Don't expose internal errors
    // return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ Log internally, return generic message
    console.error('Error fetching data:', error)

    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}

// ✅ Log errors to monitoring service (not to client)
import * as Sentry from '@sentry/nextjs'

try {
  // risky operation
} catch (error) {
  Sentry.captureException(error)
  throw new Error('Operation failed')
}
```

## Dependency Security

```bash
# ✅ Regularly audit dependencies
pnpm audit

# ✅ Keep dependencies updated
pnpm update

# ✅ Use pnpm's built-in security features
# Check pnpm-lock.yaml into git
# Review dependency changes in PRs
```

## Security Checklist

### For Every API Endpoint

- [ ] Authentication required?
- [ ] Authorization checked?
- [ ] Input validated with Zod?
- [ ] Rate limiting applied?
- [ ] Error messages don't leak info?
- [ ] Logging doesn't expose secrets?
- [ ] CORS properly configured?

### For Database Operations

- [ ] Using Drizzle ORM (no raw SQL)?
- [ ] Row-level security considered?
- [ ] Sensitive data encrypted at rest?
- [ ] Audit trail for sensitive operations?

### For File Operations

- [ ] File type validated?
- [ ] File size limited?
- [ ] Filename sanitized?
- [ ] Stored outside webroot?
- [ ] Virus scanning if needed?

### For Authentication

- [ ] Passwords hashed with bcrypt?
- [ ] Sessions use httpOnly cookies?
- [ ] HTTPS enforced?
- [ ] Account lockout after failed attempts?
- [ ] Password reset tokens expire?

## Common Vulnerabilities

### OWASP Top 10 (2021)

1. **Broken Access Control** - Always verify permissions server-side
2. **Cryptographic Failures** - Use bcrypt, HTTPS, secure cookies
3. **Injection** - Use Drizzle ORM, validate inputs with Zod
4. **Insecure Design** - Security requirements from the start
5. **Security Misconfiguration** - Set security headers, CSP
6. **Vulnerable Components** - Regular `pnpm audit`
7. **Authentication Failures** - Use Better Auth, rate limiting
8. **Data Integrity Failures** - Verify data integrity, use HTTPS
9. **Logging Failures** - Log security events, never log secrets
10. **Server-Side Request Forgery** - Validate URLs, whitelist domains

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Web Security Academy](https://portswigger.net/web-security)
- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
