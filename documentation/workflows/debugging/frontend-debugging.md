# 🎨 Frontend Debugging Guide

## Browser DevTools Mastery

### 🔍 Console Debugging

#### Enhanced Console Logging
```javascript
// Advanced console methods for better debugging

// Group related logs
console.group('User Authentication Flow');
console.log('Step 1: Check token');
console.log('Step 2: Validate permissions');
console.groupEnd();

// Table format for arrays/objects
const users = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
];
console.table(users);

// Timing operations
console.time('API Call');
await fetchData();
console.timeEnd('API Call');

// Conditional logging
console.assert(user.isAdmin, 'User is not admin', user);

// Stack traces
console.trace('Function execution path');

// Styled console output
console.log(
  '%c Debug Info %c Important ',
  'background: #222; color: #bada55; padding: 3px',
  'background: #f00; color: #fff; padding: 3px'
);
```

#### Custom Debug Logger
```typescript
// utils/debug-logger.ts
class DebugLogger {
  private enabled: boolean;
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.enabled = this.shouldLog();
  }

  private shouldLog(): boolean {
    if (typeof window === 'undefined') return false;
    const debug = localStorage.getItem('DEBUG') || '';
    return debug === '*' || debug.includes(this.namespace);
  }

  log(...args: any[]) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.namespace}]`;

    console.group(prefix);
    args.forEach(arg => {
      if (typeof arg === 'object') {
        console.dir(arg, { depth: null });
      } else {
        console.log(arg);
      }
    });
    console.trace('Stack trace');
    console.groupEnd();
  }

  error(error: Error, context?: any) {
    console.group(`🔴 [${this.namespace}] ERROR`);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    if (context) {
      console.error('Context:', context);
    }
    console.groupEnd();
  }

  performance(label: string, fn: () => void) {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`⚡ [${this.namespace}] ${label}: ${(end - start).toFixed(2)}ms`);
  }
}

// Usage
const logger = new DebugLogger('auth');
logger.log('User login attempt', { email: 'user@example.com' });
```

### 🎯 React DevTools Debugging

#### Component Profiling
```javascript
// Enable React Profiler in development
import { Profiler } from 'react';

function onRenderCallback(
  id, // Profiler tree "id"
  phase, // "mount" or "update"
  actualDuration, // Time spent rendering
  baseDuration, // Estimated time without memoization
  startTime, // When rendering began
  commitTime, // When rendering committed
  interactions // Set of interactions
) {
  console.group(`⚛️ React Profiler: ${id}`);
  console.log('Phase:', phase);
  console.log('Actual duration:', actualDuration);
  console.log('Base duration:', baseDuration);
  console.log('Start time:', startTime);
  console.log('Commit time:', commitTime);
  console.groupEnd();
}

export function ProfiledComponent() {
  return (
    <Profiler id="MyComponent" onRender={onRenderCallback}>
      <YourComponent />
    </Profiler>
  );
}
```

#### Hook Debugging
```javascript
// Debug hooks with custom DevTools
import { useDebugValue, useEffect, useState } from 'react';

function useDebugState(initialValue, label) {
  const [value, setValue] = useState(initialValue);

  // Show in React DevTools
  useDebugValue(`${label}: ${JSON.stringify(value)}`);

  // Log state changes
  useEffect(() => {
    console.log(`[State Change] ${label}:`, value);
  }, [value, label]);

  return [value, setValue];
}

// Debug render reasons
function useWhyDidYouUpdate(name, props) {
  const previousProps = useRef();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps = {};

      allKeys.forEach(key => {
        if (previousProps.current[key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current[key],
            to: props[key]
          };
        }
      });

      if (Object.keys(changedProps).length) {
        console.group(`[Why Did You Update] ${name}`);
        console.log('Changed props:', changedProps);
        console.groupEnd();
      }
    }

    previousProps.current = props;
  });
}
```

### 🌐 Network Debugging

#### Request Interceptor
```javascript
// Intercept and log all fetch requests
const originalFetch = window.fetch;

window.fetch = async function(...args) {
  const [url, options = {}] = args;

  console.group(`📡 Fetch: ${options.method || 'GET'} ${url}`);
  console.log('Request Headers:', options.headers);
  console.log('Request Body:', options.body);
  console.time('Duration');

  try {
    const response = await originalFetch.apply(this, args);
    const clone = response.clone();

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers));

    // Log response body (be careful with large responses)
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await clone.json();
      console.log('Response Body:', body);
    }

    console.timeEnd('Duration');
    console.groupEnd();

    return response;
  } catch (error) {
    console.error('Request failed:', error);
    console.timeEnd('Duration');
    console.groupEnd();
    throw error;
  }
};
```

#### GraphQL Debugging
```javascript
// Debug GraphQL requests
function debugGraphQL(query, variables) {
  console.group('📊 GraphQL Request');
  console.log('Query:', query);
  console.log('Variables:', variables);

  // Parse and display operation name
  const match = query.match(/^(query|mutation|subscription)\s+(\w+)/);
  if (match) {
    console.log('Operation:', match[1], match[2]);
  }

  console.groupEnd();
}
```

### 🎨 UI/CSS Debugging

#### Visual Debugging Helpers
```css
/* debug.css - Visual debugging utilities */

/* Show all element boundaries */
.debug * {
  outline: 1px solid red !important;
}

/* Show specific element types */
.debug-layout {
  outline: 2px solid blue !important;
  background: rgba(0, 0, 255, 0.1) !important;
}

.debug-spacing {
  outline: 2px solid green !important;
}

/* Show responsive breakpoints */
.debug-breakpoint::before {
  content: 'xs';
  position: fixed;
  top: 0;
  right: 0;
  background: black;
  color: white;
  padding: 5px;
  z-index: 9999;
}

@media (min-width: 640px) {
  .debug-breakpoint::before { content: 'sm'; }
}

@media (min-width: 768px) {
  .debug-breakpoint::before { content: 'md'; }
}

@media (min-width: 1024px) {
  .debug-breakpoint::before { content: 'lg'; }
}
```

#### Layout Debugging Component
```typescript
// components/DebugOverlay.tsx
export function DebugOverlay() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState({});

  useEffect(() => {
    const updateInfo = () => {
      setInfo({
        viewport: `${window.innerWidth} x ${window.innerHeight}`,
        scroll: `${window.scrollX}, ${window.scrollY}`,
        screen: `${screen.width} x ${screen.height}`,
        pixelRatio: window.devicePixelRatio,
      });
    };

    updateInfo();
    window.addEventListener('resize', updateInfo);
    window.addEventListener('scroll', updateInfo);

    return () => {
      window.removeEventListener('resize', updateInfo);
      window.removeEventListener('scroll', updateInfo);
    };
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 bg-black text-white p-2 rounded z-50"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 bg-black text-white p-4 z-50 font-mono text-xs">
      <button onClick={() => setShow(false)} className="float-right">×</button>
      <div>Viewport: {info.viewport}</div>
      <div>Scroll: {info.scroll}</div>
      <div>Screen: {info.screen}</div>
      <div>Pixel Ratio: {info.pixelRatio}</div>
    </div>
  );
}
```

### 🔧 State Management Debugging

#### Redux DevTools Integration
```javascript
// Enhanced Redux debugging
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Log non-serializable values
        warnAfter: 128,
        ignoredActions: ['persist/PERSIST'],
      },
    }).concat(
      // Custom logging middleware
      (store) => (next) => (action) => {
        console.group(`Redux: ${action.type}`);
        console.log('Previous State:', store.getState());
        console.log('Action:', action);
        const result = next(action);
        console.log('Next State:', store.getState());
        console.groupEnd();
        return result;
      }
    ),
  devTools: {
    trace: true,
    traceLimit: 25,
  },
});
```

#### Zustand Debugging
```javascript
// Debug Zustand stores
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set, get) => ({
      // Your store
    }),
    {
      name: 'app-store',
      trace: true,
    }
  )
);

// Log all state changes
useStore.subscribe(
  (state) => console.log('[Zustand] State updated:', state)
);
```

### 📊 Performance Debugging

#### FPS Monitor
```javascript
// Monitor frame rate
class FPSMonitor {
  constructor() {
    this.fps = 0;
    this.frames = 0;
    this.lastTime = performance.now();
    this.monitor();
  }

  monitor() {
    this.frames++;
    const currentTime = performance.now();

    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
      console.log(`📊 FPS: ${this.fps}`);

      if (this.fps < 30) {
        console.warn('⚠️ Low FPS detected!');
      }

      this.frames = 0;
      this.lastTime = currentTime;
    }

    requestAnimationFrame(() => this.monitor());
  }
}

// Start monitoring
if (process.env.NODE_ENV === 'development') {
  new FPSMonitor();
}
```

### 🔍 Memory Debugging

```javascript
// Memory leak detection
class MemoryMonitor {
  constructor(interval = 5000) {
    this.checkMemory(interval);
  }

  checkMemory(interval) {
    setInterval(() => {
      if (performance.memory) {
        const mb = (bytes) => Math.round(bytes / 1048576);

        console.group('💾 Memory Usage');
        console.log('Used:', mb(performance.memory.usedJSHeapSize), 'MB');
        console.log('Total:', mb(performance.memory.totalJSHeapSize), 'MB');
        console.log('Limit:', mb(performance.memory.jsHeapSizeLimit), 'MB');

        const usage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
        if (usage > 90) {
          console.error('⚠️ High memory usage!', usage.toFixed(2) + '%');
        }

        console.groupEnd();
      }
    }, interval);
  }
}
```

### 📋 Debug Shortcuts

```javascript
// Add debug shortcuts to window
if (process.env.NODE_ENV === 'development') {
  window.debug = {
    // Clear all storage
    clearAll: () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('✅ Storage cleared');
    },

    // Show all event listeners
    showListeners: (element = document) => {
      const listeners = getEventListeners(element);
      console.table(listeners);
    },

    // Enable verbose logging
    verbose: () => {
      localStorage.setItem('DEBUG', '*');
      console.log('✅ Verbose logging enabled');
    },

    // Performance report
    performance: () => {
      const entries = performance.getEntriesByType('navigation')[0];
      console.table({
        'DOM Content Loaded': entries.domContentLoadedEventEnd - entries.domContentLoadedEventStart,
        'Load Complete': entries.loadEventEnd - entries.loadEventStart,
        'Full Load Time': entries.loadEventEnd - entries.fetchStart,
      });
    }
  };
}
```

---

*Effective frontend debugging combines browser DevTools, framework-specific tools, and custom logging utilities. Always remove or disable debug code before production deployment.*