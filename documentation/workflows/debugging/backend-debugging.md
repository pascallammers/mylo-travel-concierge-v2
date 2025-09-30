# 🔧 Backend Debugging Guide

## Server-Side Debugging Techniques

### 🚀 Node.js Debugging

#### Inspector Mode
```bash
# Start Node.js with inspector
node --inspect server.js

# With specific port
node --inspect=9229 server.js

# Break on first line
node --inspect-brk server.js

# For Next.js
NODE_OPTIONS='--inspect' npm run dev
```

#### Advanced Logging Setup
```typescript
// lib/logger/server-logger.ts
import winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

// Custom format for detailed logs
const detailedFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += '\nMetadata: ' + JSON.stringify(metadata, null, 2);
  }

  // Add stack trace for errors
  if (stack) {
    msg += '\nStack: ' + stack;
  }

  return msg;
});

// Create logger with multiple transports
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    detailedFormat
  ),
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: combine(colorize(), detailedFormat),
    }),
    // File output for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Add request logging
export function logRequest(req: any, res: any, next: any) {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}
```

### 📊 Database Debugging

#### SQL Query Logging
```typescript
// Enhanced database debugging
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Add query logging
pool.on('connect', (client) => {
  console.log('[DB] New client connected');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err);
});

// Wrap queries with logging
const originalQuery = pool.query.bind(pool);
pool.query = async function(...args: any[]) {
  const start = performance.now();
  const [query, params] = args;

  console.group('[DB Query]');
  console.log('SQL:', typeof query === 'string' ? query : query.text);
  console.log('Params:', params);

  try {
    const result = await originalQuery(...args);
    const duration = performance.now() - start;

    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log('Rows affected:', result.rowCount);
    console.groupEnd();

    // Slow query warning
    if (duration > 100) {
      console.warn(`⚠️ Slow query detected (${duration.toFixed(2)}ms)`);
    }

    return result;
  } catch (error) {
    console.error('Query failed:', error);
    console.groupEnd();
    throw error;
  }
};

export const db = drizzle(pool, {
  logger: true, // Enable Drizzle logging
});
```

#### Prisma Debugging
```typescript
// Enable Prisma query logging
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
});

// Log all queries with timing
prisma.$on('query', (e) => {
  console.group('[Prisma Query]');
  console.log('Query:', e.query);
  console.log('Params:', e.params);
  console.log('Duration:', e.duration + 'ms');
  console.groupEnd();

  // Alert on slow queries
  if (e.duration > 100) {
    console.error(`⚠️ Slow query: ${e.duration}ms`);
  }
});

export { prisma };
```

### 🔐 Authentication Debugging

#### JWT Token Debugging
```typescript
// Debug JWT tokens
import jwt from 'jsonwebtoken';

export function debugToken(token: string, secret: string) {
  console.group('🔐 JWT Debug');

  try {
    // Decode without verifying
    const decoded = jwt.decode(token, { complete: true });
    console.log('Header:', decoded?.header);
    console.log('Payload:', decoded?.payload);

    // Verify and get details
    const verified = jwt.verify(token, secret, { complete: true });
    console.log('✅ Token is valid');
    console.log('Issued at:', new Date((verified.payload as any).iat * 1000));
    console.log('Expires at:', new Date((verified.payload as any).exp * 1000));

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if ((verified.payload as any).exp < now) {
      console.warn('⚠️ Token is expired');
    }

  } catch (error) {
    console.error('❌ Token validation failed:', error.message);
  }

  console.groupEnd();
}

// Middleware for auth debugging
export function debugAuthMiddleware(req: any, res: any, next: any) {
  console.group('[Auth Debug]');
  console.log('Headers:', {
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
  });

  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];
    debugToken(token, process.env.JWT_SECRET!);
  }

  console.groupEnd();
  next();
}
```

### 🌐 API Debugging

#### Request/Response Interceptor
```typescript
// Comprehensive API debugging middleware
export function apiDebugMiddleware(req: any, res: any, next: any) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  // Capture request body
  let requestBody = '';
  req.on('data', (chunk: any) => {
    requestBody += chunk;
  });

  req.on('end', () => {
    console.group(`[API] ${requestId} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    console.log('Body:', requestBody || 'Empty');
    console.groupEnd();
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;

    console.group(`[API Response] ${requestId}`);
    console.log('Status:', res.statusCode);
    console.log('Duration:', `${duration}ms`);
    console.log('Response:', typeof data === 'string' ? data.substring(0, 500) : data);
    console.groupEnd();

    originalSend.call(this, data);
  };

  next();
}
```

#### Error Tracking
```typescript
// Comprehensive error handler
export function errorHandler(err: any, req: any, res: any, next: any) {
  const errorId = Date.now().toString(36);

  console.group(`🔴 [Error] ${errorId}`);
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    user: req.user,
  });

  // Log to file in production
  if (process.env.NODE_ENV === 'production') {
    logger.error('API Error', {
      errorId,
      error: err.message,
      stack: err.stack,
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
      },
    });
  }

  console.groupEnd();

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message,
    errorId,
  });
}
```

### 🔄 Async Operations Debugging

#### Promise Tracking
```typescript
// Track unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);

  // Log stack trace
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
});

// Track long-running operations
class AsyncTracker {
  private operations = new Map();

  track(name: string, promise: Promise<any>) {
    const id = Date.now();
    const start = performance.now();

    this.operations.set(id, { name, start });

    // Warn if operation takes too long
    const timeout = setTimeout(() => {
      console.warn(`⚠️ Long-running operation: ${name} (>${5000}ms)`);
    }, 5000);

    promise
      .then(() => {
        const duration = performance.now() - start;
        console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
      })
      .catch((error) => {
        const duration = performance.now() - start;
        console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
      })
      .finally(() => {
        clearTimeout(timeout);
        this.operations.delete(id);
      });

    return promise;
  }

  showPending() {
    console.table(Array.from(this.operations.values()));
  }
}

export const asyncTracker = new AsyncTracker();
```

### 📈 Performance Monitoring

#### CPU Profiling
```typescript
// Monitor CPU usage
import os from 'os';

class CPUMonitor {
  private lastCPUUsage: any;

  constructor() {
    this.lastCPUUsage = process.cpuUsage();
    this.monitor();
  }

  monitor() {
    setInterval(() => {
      const currentCPUUsage = process.cpuUsage(this.lastCPUUsage);
      const userCPUTime = currentCPUUsage.user / 1000; // Convert to ms
      const systemCPUTime = currentCPUUsage.system / 1000;

      console.log('[CPU Usage]', {
        user: `${userCPUTime.toFixed(2)}ms`,
        system: `${systemCPUTime.toFixed(2)}ms`,
        loadAvg: os.loadavg(),
      });

      this.lastCPUUsage = process.cpuUsage();
    }, 10000); // Every 10 seconds
  }
}

if (process.env.MONITOR_CPU === 'true') {
  new CPUMonitor();
}
```

#### Memory Profiling
```typescript
// Detailed memory monitoring
class MemoryProfiler {
  private baseline: NodeJS.MemoryUsage;

  constructor() {
    this.baseline = process.memoryUsage();
    this.startProfiling();
  }

  startProfiling() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

      console.group('[Memory Profile]');
      console.log('RSS:', mb(usage.rss), 'MB');
      console.log('Heap Total:', mb(usage.heapTotal), 'MB');
      console.log('Heap Used:', mb(usage.heapUsed), 'MB');
      console.log('External:', mb(usage.external), 'MB');
      console.log('Array Buffers:', mb(usage.arrayBuffers), 'MB');

      // Check for memory leaks
      const heapGrowth = usage.heapUsed - this.baseline.heapUsed;
      if (heapGrowth > 100 * 1024 * 1024) { // 100MB growth
        console.warn('⚠️ Possible memory leak detected!');
        console.warn('Heap growth:', mb(heapGrowth), 'MB');
      }

      console.groupEnd();
    }, 30000); // Every 30 seconds
  }

  takeSnapshot() {
    if (global.gc) {
      global.gc(); // Force garbage collection
      console.log('Garbage collection forced');
    }

    const usage = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      memory: usage,
    };
  }
}
```

### 🔌 WebSocket Debugging

```typescript
// Debug WebSocket connections
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);

  console.log(`[WS] Client connected: ${clientId}`);
  console.log(`[WS] Origin: ${req.headers.origin}`);

  ws.on('message', (data) => {
    console.log(`[WS] Message from ${clientId}:`, data.toString());
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Client disconnected: ${clientId}`);
    console.log(`[WS] Close code: ${code}, reason: ${reason}`);
  });

  ws.on('error', (error) => {
    console.error(`[WS] Error from ${clientId}:`, error);
  });
});
```

### 📝 Debug Configuration

```typescript
// config/debug.config.ts
export const debugConfig = {
  // Enable various debug features
  database: {
    logQueries: process.env.DEBUG_DB === 'true',
    slowQueryThreshold: 100, // ms
  },
  api: {
    logRequests: process.env.DEBUG_API === 'true',
    logResponses: process.env.DEBUG_API === 'true',
    includeStackTraces: process.env.NODE_ENV !== 'production',
  },
  auth: {
    logTokens: process.env.DEBUG_AUTH === 'true',
    logSessions: process.env.DEBUG_AUTH === 'true',
  },
  performance: {
    monitorCPU: process.env.MONITOR_CPU === 'true',
    monitorMemory: process.env.MONITOR_MEMORY === 'true',
    profileRequests: process.env.PROFILE_REQUESTS === 'true',
  },
};
```

---

*Backend debugging requires systematic logging, performance monitoring, and proper error tracking. Always ensure sensitive data is not logged in production environments.*