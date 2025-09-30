# 🔧 Next.js Debugging Guide

## Common Next.js Errors & Solutions

### 🔴 Build Errors

#### TypeScript Errors
```bash
# Full type check with detailed output
npx tsc --noEmit --pretty --verbose

# Type check specific file
npx tsc --noEmit src/app/page.tsx

# Show all errors (not just first few)
npx tsc --noEmit --pretty | head -100
```

**Enhanced Logging:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "noEmitOnError": false,
    "extendedDiagnostics": true,
    "listFiles": true,
    "traceResolution": true
  }
}
```

#### Module Resolution Issues
```bash
# Debug module resolution
NODE_OPTIONS='--trace-warnings' npm run build

# Clear module cache
rm -rf node_modules .next
npm cache clean --force
npm install

# Check for duplicate packages
npm ls --depth=0 | grep -E "^\w" | sort | uniq -d
```

### 🟡 Runtime Errors

#### Hydration Mismatch
```typescript
// Add hydration error boundary
// app/components/HydrationDebug.tsx
'use client';

import { useEffect, useState } from 'react';

export function HydrationDebug({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    // Log hydration completion
    console.log('[Hydration] Client hydration complete');

    // Check for mismatches
    if (typeof window !== 'undefined') {
      const serverHTML = document.documentElement.outerHTML;
      console.log('[Hydration] Document length:', serverHTML.length);
    }
  }, []);

  // Show hydration state in development
  if (process.env.NODE_ENV === 'development' && !isHydrated) {
    console.log('[Hydration] Waiting for hydration...');
  }

  return <>{children}</>;
}
```

**Debug Hydration Issues:**
```javascript
// Enable detailed hydration logs
if (typeof window !== 'undefined') {
  // Patch console.error to catch hydration warnings
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes('Hydration')) {
      console.group('🚨 Hydration Error Detected');
      console.log('Error:', args[0]);
      console.log('Component Stack:', args[1]);
      console.trace('Stack Trace');
      console.groupEnd();
    }
    originalError.apply(console, args);
  };
}
```

#### Server Component Errors
```typescript
// Debug server components
// app/debug/server-component-debug.tsx
import { headers } from 'next/headers';

export async function ServerDebug() {
  // Log server-side execution
  console.log('[Server Component] Rendering at:', new Date().toISOString());
  console.log('[Server Component] Headers:', headers());

  try {
    // Your server logic here
    const data = await fetchData();
    console.log('[Server Component] Data fetched:', data);
    return <div>{/* render */}</div>;
  } catch (error) {
    // Detailed error logging
    console.error('[Server Component] Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
```

### 🔵 API Route Debugging

#### Detailed API Logging
```typescript
// app/api/debug/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Middleware for detailed logging
function logRequest(req: NextRequest) {
  console.group(`[API] ${req.method} ${req.url}`);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  console.log('Cookies:', req.cookies.getAll());
  console.log('Search Params:', Object.fromEntries(req.nextUrl.searchParams));
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
}

export async function POST(req: NextRequest) {
  // Enable detailed logging
  if (process.env.DEBUG_API === 'true') {
    logRequest(req);
  }

  try {
    const body = await req.json();
    console.log('[API] Request body:', JSON.stringify(body, null, 2));

    // Your logic here
    const result = await processRequest(body);

    console.log('[API] Response:', JSON.stringify(result, null, 2));
    return NextResponse.json(result);

  } catch (error) {
    console.error('[API] Error:', {
      message: error.message,
      stack: error.stack,
      body: await req.text(),
    });

    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
```

### 🟢 Middleware Debugging

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Enhanced logging for middleware
  if (process.env.DEBUG_MIDDLEWARE === 'true') {
    console.group(`[Middleware] ${request.method} ${request.url}`);
    console.log('Pathname:', request.nextUrl.pathname);
    console.log('User Agent:', request.headers.get('user-agent'));
    console.log('Referer:', request.headers.get('referer'));
    console.log('Cookies:', request.cookies.getAll());
    console.groupEnd();
  }

  // Add debug headers to response
  const response = NextResponse.next();
  response.headers.set('X-Debug-Timestamp', new Date().toISOString());
  response.headers.set('X-Debug-Path', request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: [
    // Add paths to debug
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 📊 Performance Debugging

#### Bundle Analysis
```bash
# Install bundle analyzer
npm install @next/bundle-analyzer

# Run analysis
ANALYZE=true npm run build
```

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

module.exports = withBundleAnalyzer({
  // Enable detailed webpack stats
  webpack: (config, { dev, isServer }) => {
    if (process.env.DEBUG_WEBPACK === 'true') {
      config.stats = 'verbose';
      config.infrastructureLogging = {
        level: 'verbose',
        debug: true,
      };
    }
    return config;
  },
});
```

#### Memory Leaks
```javascript
// Debug memory usage
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const usage = process.memoryUsage();
    console.log('[Memory]', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    });
  }, 10000);
}
```

### 🛠️ Debug Configuration

#### Environment Variables
```bash
# .env.local for debugging
DEBUG=* # Enable all debug output
DEBUG_API=true # API route debugging
DEBUG_MIDDLEWARE=true # Middleware debugging
DEBUG_HYDRATION=true # Hydration debugging
DEBUG_WEBPACK=true # Webpack debugging
NEXT_TELEMETRY_DEBUG=1 # Next.js telemetry
NODE_OPTIONS='--inspect --trace-warnings' # Node.js debugging
```

#### VSCode Debug Config
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "env": {
        "DEBUG": "*",
        "NODE_OPTIONS": "--inspect"
      },
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "- Local:.+(https?://\\S+|[0-9]+)",
        "uriFormat": "http://localhost:3000",
        "action": "openExternally"
      }
    }
  ]
}
```

### 📋 Debug Checklist

#### Build Issues
1. [ ] Run `npm run build` for full error output
2. [ ] Check `tsc --noEmit` for TypeScript errors
3. [ ] Verify all imports are correct
4. [ ] Check for circular dependencies
5. [ ] Ensure environment variables are set

#### Runtime Issues
1. [ ] Check browser console for errors
2. [ ] Verify server logs (`npm run dev`)
3. [ ] Test in production mode (`npm run build && npm start`)
4. [ ] Check Network tab for failed requests
5. [ ] Disable browser extensions

#### Performance Issues
1. [ ] Run Lighthouse audit
2. [ ] Check bundle size with analyzer
3. [ ] Profile with React DevTools
4. [ ] Monitor memory usage
5. [ ] Check for unnecessary re-renders

---

*For Next.js specific issues, always check the [official debugging guide](https://nextjs.org/docs/advanced-features/debugging) and [error reference](https://nextjs.org/docs/messages).*