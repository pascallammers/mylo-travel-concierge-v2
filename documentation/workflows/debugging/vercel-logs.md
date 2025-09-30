# 🚀 Vercel Logs Analysis Guide

## Vercel Dashboard Logging

### 🔍 Accessing Logs

#### Via Dashboard
```bash
# Navigate to Vercel Dashboard
# Project → Functions → Logs

# Filter options:
- Last 24 hours
- Last 7 days
- Custom range
- Live tail (real-time)
```

#### Via CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# View logs (last 100 entries)
vercel logs

# Follow logs in real-time
vercel logs --follow

# Filter by function
vercel logs --filter="api/users"

# Specific deployment
vercel logs [deployment-url]

# Last N entries
vercel logs -n 50

# Output format
vercel logs --output json
```

### 📊 Log Levels & Structure

#### Structured Logging for Vercel
```typescript
// lib/vercel-logger.ts
export class VercelLogger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = {
      environment: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      deployment: process.env.VERCEL_URL,
      ...context
    };
  }

  private format(level: string, message: string, data?: any) {
    // Structured JSON for better parsing in Vercel
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(data || {})
    };

    // Vercel automatically captures console outputs
    console.log(JSON.stringify(log));
  }

  info(message: string, data?: any) {
    this.format('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.format('WARN', message, data);
  }

  error(message: string, error?: Error, data?: any) {
    this.format('ERROR', message, {
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      ...data
    });
  }

  metric(name: string, value: number, unit?: string) {
    this.format('METRIC', name, {
      value,
      unit,
      metric: true
    });
  }

  // Track API performance
  async trackAPI<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.metric(`api.${operation}.duration`, duration, 'ms');
      this.info(`API operation completed: ${operation}`, {
        duration,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.metric(`api.${operation}.error`, 1, 'count');
      this.error(`API operation failed: ${operation}`, error as Error, {
        duration,
        success: false
      });

      throw error;
    }
  }
}
```

### 🔧 Edge Function Debugging

#### Edge Runtime Logging
```typescript
// app/api/edge-debug/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  // Log request details
  console.log({
    type: 'EDGE_REQUEST',
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    geo: request.geo,
    ip: request.ip,
    // Edge-specific context
    cf: request.cf, // Cloudflare properties if available
  });

  // Performance timing
  const startTime = Date.now();

  try {
    // Your edge function logic
    const result = await processEdgeRequest(request);

    // Log success metrics
    console.log({
      type: 'EDGE_RESPONSE',
      duration: Date.now() - startTime,
      status: 'success',
    });

    return NextResponse.json(result);
  } catch (error) {
    // Log errors with context
    console.error({
      type: 'EDGE_ERROR',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
      url: request.url,
    });

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

### 📈 Performance Monitoring

#### Function Analytics
```typescript
// Track function performance
export function withMetrics(handler: Function) {
  return async (req: any, res: any) => {
    const start = Date.now();
    const logger = new VercelLogger({
      function: handler.name,
      path: req.url,
    });

    // Log incoming request
    logger.info('Function invoked', {
      method: req.method,
      query: req.query,
      headers: req.headers,
    });

    // Track memory usage
    const initialMemory = process.memoryUsage();

    try {
      const result = await handler(req, res);

      const duration = Date.now() - start;
      const memoryDelta = process.memoryUsage().heapUsed - initialMemory.heapUsed;

      // Log performance metrics
      logger.info('Function completed', {
        duration,
        memoryDelta: Math.round(memoryDelta / 1024 / 1024) + 'MB',
        statusCode: res.statusCode,
      });

      // Alert on slow functions
      if (duration > 3000) {
        logger.warn('Slow function detected', {
          duration,
          threshold: 3000,
        });
      }

      return result;
    } catch (error) {
      logger.error('Function failed', error as Error, {
        duration: Date.now() - start,
      });
      throw error;
    }
  };
}
```

### 🔍 Error Tracking

#### Comprehensive Error Reporting
```typescript
// lib/vercel-error-handler.ts
export class VercelErrorHandler {
  private logger: VercelLogger;

  constructor() {
    this.logger = new VercelLogger({ component: 'ErrorHandler' });
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Catch unhandled errors in Node.js
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        this.logger.error('Uncaught Exception', error, {
          type: 'uncaughtException',
          fatal: true,
        });
        process.exit(1);
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('Unhandled Rejection', reason as Error, {
          type: 'unhandledRejection',
          promise: promise.toString(),
        });
      });
    }
  }

  captureError(error: Error, context?: any) {
    // Enhanced error logging
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),

      // Vercel specific
      environment: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      deployment: process.env.VERCEL_URL,
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA,

      // Additional context
      ...context,
    };

    this.logger.error('Application Error', error, errorInfo);

    // Send to external service if configured
    if (process.env.SENTRY_DSN) {
      this.sendToSentry(errorInfo);
    }
  }

  private sendToSentry(errorInfo: any) {
    // Integration with error tracking service
    // Implementation depends on your service
  }
}
```

### 📊 Custom Metrics

#### Tracking Business Metrics
```typescript
// lib/vercel-metrics.ts
export class VercelMetrics {
  private logger: VercelLogger;

  constructor() {
    this.logger = new VercelLogger({ component: 'Metrics' });
  }

  // Track custom events
  trackEvent(event: string, properties?: any) {
    this.logger.info('Event tracked', {
      event,
      properties,
      timestamp: Date.now(),
    });
  }

  // Track API usage
  trackAPIUsage(endpoint: string, userId?: string) {
    this.logger.info('API usage', {
      endpoint,
      userId,
      timestamp: Date.now(),
      metric: 'api_usage',
    });
  }

  // Track conversion metrics
  trackConversion(type: string, value?: number) {
    this.logger.info('Conversion tracked', {
      type,
      value,
      timestamp: Date.now(),
      metric: 'conversion',
    });
  }

  // Performance metrics
  trackPerformance(metric: string, value: number) {
    this.logger.metric(metric, value, 'ms');
  }
}
```

### 🔄 Real-time Log Streaming

#### WebSocket Log Streaming
```typescript
// api/logs/stream/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Set up log streaming
      const sendLog = (log: any) => {
        const data = `data: ${JSON.stringify(log)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Intercept console methods
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog(...args);
        sendLog({
          type: 'log',
          message: args.join(' '),
          timestamp: new Date().toISOString(),
        });
      };

      // Keep connection alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(':keep-alive\n\n'));
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        console.log = originalLog;
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 📋 Log Analysis Scripts

#### Parse and Analyze Logs
```bash
#!/bin/bash
# analyze-vercel-logs.sh

# Export logs to file
vercel logs -n 1000 --output json > logs.json

# Count errors
echo "Error count:"
jq '[.[] | select(.level == "ERROR")] | length' logs.json

# Top errors
echo "Top errors:"
jq '[.[] | select(.level == "ERROR")] | group_by(.message) | map({message: .[0].message, count: length}) | sort_by(.count) | reverse | .[0:5]' logs.json

# Performance analysis
echo "Slow requests (>1000ms):"
jq '[.[] | select(.duration > 1000)] | sort_by(.duration) | reverse | .[0:10] | .[] | {path: .path, duration: .duration}' logs.json

# Memory usage
echo "High memory usage:"
jq '[.[] | select(.memoryDelta) | select(.memoryDelta > 50)] | .[] | {function: .function, memory: .memoryDelta}' logs.json
```

### 🛠️ Debug Environment Variables

```typescript
// Debug configuration for Vercel
export const vercelDebugConfig = {
  // Log levels based on environment
  logLevel: process.env.VERCEL_ENV === 'production' ? 'error' : 'debug',

  // Feature flags for debugging
  enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
  enablePerformanceTracking: process.env.ENABLE_PERF_TRACKING === 'true',
  enableErrorReporting: process.env.ENABLE_ERROR_REPORTING === 'true',

  // Vercel environment info
  environment: {
    env: process.env.VERCEL_ENV,
    region: process.env.VERCEL_REGION,
    url: process.env.VERCEL_URL,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA,
  },
};

// Log configuration on startup
console.log('Vercel Debug Configuration:', vercelDebugConfig);
```

### 📚 Best Practices

1. **Use Structured Logging**: Always log in JSON format for better parsing
2. **Include Context**: Add request IDs, user IDs, and operation names
3. **Log Metrics**: Track duration, memory usage, and custom metrics
4. **Handle Errors Properly**: Log full error details including stack traces
5. **Use Log Levels**: Differentiate between INFO, WARN, and ERROR
6. **Clean Sensitive Data**: Never log passwords, tokens, or PII
7. **Set Up Alerts**: Configure alerts for errors and performance issues

### 🔗 Useful Commands

```bash
# View function logs
vercel logs --filter="api/*"

# Export logs for analysis
vercel logs -n 1000 --output json > analysis.json

# Monitor specific deployment
vercel logs [deployment-url] --follow

# Check function status
vercel inspect [deployment-url]

# List all deployments
vercel list

# Get deployment details
vercel inspect [deployment-url]
```

---

*Vercel logs are crucial for production debugging. Set up proper logging infrastructure and monitoring to quickly identify and resolve issues.*