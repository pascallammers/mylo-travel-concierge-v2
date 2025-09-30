# 🌐 Browser Logs Analysis Guide

## Console Log Mastery

### 🔍 Filtering & Searching

#### Browser Console Filters
```javascript
// Chrome/Edge DevTools Console Settings

// Filter by log level
console.log('Info message');     // Verbose
console.warn('Warning message'); // Warnings
console.error('Error message');  // Errors only

// Custom filters using regex
// In console filter box: /api|fetch|xhr/i
// This shows only logs containing 'api', 'fetch', or 'xhr'

// Negative filters (exclude patterns)
// -/debug|trace/i
// This hides logs containing 'debug' or 'trace'
```

#### Advanced Console Commands
```javascript
// Chrome DevTools Commands

// Clear console with timestamp
console.clear();
console.log(`Console cleared at ${new Date().toISOString()}`);

// Monitor function calls
monitor(functionName); // Logs when function is called
unmonitor(functionName); // Stop monitoring

// Get event listeners
getEventListeners(document.body); // See all listeners

// Copy to clipboard
copy(variableOrObject); // Copies value to clipboard

// Last evaluated expression
$_; // Returns last evaluated expression

// Query selectors shortcuts
$('selector'); // document.querySelector
$$('selector'); // document.querySelectorAll

// XPath query
$x('//div[@class="example"]');
```

### 📊 Structured Logging

#### Log Formatting System
```javascript
// Create structured logging system
class BrowserLogger {
  constructor(namespace) {
    this.namespace = namespace;
    this.colors = {
      debug: '#888',
      info: '#2196F3',
      warn: '#FF9800',
      error: '#F44336',
      success: '#4CAF50'
    };
  }

  format(level, message, data) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || '#000';

    // Styled console output
    console.log(
      `%c[${timestamp}] %c[${this.namespace}] %c${level.toUpperCase()}`,
      'color: #666; font-size: 10px',
      'color: #333; font-weight: bold',
      `color: ${color}; font-weight: bold`,
      message
    );

    if (data) {
      console.group('Details');
      if (typeof data === 'object') {
        console.table(data);
      } else {
        console.log(data);
      }
      console.trace('Call Stack');
      console.groupEnd();
    }
  }

  debug(message, data) {
    if (localStorage.getItem('DEBUG_LEVEL') === 'debug') {
      this.format('debug', message, data);
    }
  }

  info(message, data) {
    this.format('info', message, data);
  }

  warn(message, data) {
    this.format('warn', message, data);
  }

  error(message, error) {
    this.format('error', message, {
      message: error.message,
      stack: error.stack,
      ...error
    });
  }

  group(title, fn) {
    console.group(`📁 ${this.namespace}: ${title}`);
    fn();
    console.groupEnd();
  }

  time(label, fn) {
    console.time(`⏱️ ${this.namespace}: ${label}`);
    const result = fn();
    console.timeEnd(`⏱️ ${this.namespace}: ${label}`);
    return result;
  }
}

// Usage
const logger = new BrowserLogger('MyApp');
logger.info('Application started', { version: '1.0.0' });
```

### 🎯 Error Tracking

#### Global Error Handler
```javascript
// Comprehensive error tracking
window.addEventListener('error', (event) => {
  console.group('🔴 Global Error Caught');
  console.error('Message:', event.message);
  console.error('Source:', event.filename);
  console.error('Line:', event.lineno, 'Column:', event.colno);
  console.error('Error Object:', event.error);

  // Parse stack trace
  if (event.error?.stack) {
    const stackLines = event.error.stack.split('\n');
    console.group('Stack Trace Analysis');
    stackLines.forEach((line, i) => {
      if (line.includes('.js') || line.includes('.ts')) {
        console.log(`${i}: ${line.trim()}`);
      }
    });
    console.groupEnd();
  }

  // Send to error tracking service
  if (window.errorTracker) {
    window.errorTracker.capture(event.error);
  }

  console.groupEnd();
});

// Promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.group('🔴 Unhandled Promise Rejection');
  console.error('Promise:', event.promise);
  console.error('Reason:', event.reason);

  if (event.reason instanceof Error) {
    console.error('Stack:', event.reason.stack);
  }

  console.groupEnd();
});
```

### 🌐 Network Logging

#### XHR/Fetch Interceptor
```javascript
// Log all network requests
class NetworkLogger {
  constructor() {
    this.requests = new Map();
    this.interceptXHR();
    this.interceptFetch();
  }

  interceptXHR() {
    const original = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(...args) {
      const [method, url] = args;
      const requestId = Date.now();

      this.addEventListener('loadstart', () => {
        console.group(`📡 XHR: ${method} ${url}`);
        console.log('Request ID:', requestId);
        console.time(`Request ${requestId}`);
      });

      this.addEventListener('load', () => {
        console.log('Status:', this.status);
        console.log('Response:', this.responseText?.substring(0, 200));
        console.timeEnd(`Request ${requestId}`);
        console.groupEnd();
      });

      this.addEventListener('error', () => {
        console.error('Request failed');
        console.timeEnd(`Request ${requestId}`);
        console.groupEnd();
      });

      return original.apply(this, args);
    };
  }

  interceptFetch() {
    const original = window.fetch;

    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      const requestId = Date.now();

      console.group(`📡 Fetch: ${options.method || 'GET'} ${url}`);
      console.log('Request ID:', requestId);
      console.log('Options:', options);
      console.time(`Request ${requestId}`);

      try {
        const response = await original(...args);
        const clone = response.clone();

        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers));

        // Log response preview
        if (response.headers.get('content-type')?.includes('json')) {
          const body = await clone.json();
          console.log('Response:', body);
        }

        console.timeEnd(`Request ${requestId}`);
        console.groupEnd();

        return response;
      } catch (error) {
        console.error('Request failed:', error);
        console.timeEnd(`Request ${requestId}`);
        console.groupEnd();
        throw error;
      }
    };
  }

  showStats() {
    console.table({
      'Total Requests': this.requests.size,
      'Pending': Array.from(this.requests.values()).filter(r => r.pending).length,
      'Failed': Array.from(this.requests.values()).filter(r => r.failed).length,
    });
  }
}

// Enable network logging
const networkLogger = new NetworkLogger();
```

### 📈 Performance Logging

#### Performance Observer
```javascript
// Monitor performance metrics
class PerformanceLogger {
  constructor() {
    this.setupObservers();
    this.logInitialMetrics();
  }

  setupObservers() {
    // Observe long tasks
    if ('PerformanceObserver' in window) {
      // Long tasks (blocking main thread)
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`, {
                name: entry.name,
                startTime: entry.startTime,
                attribution: entry.attribution
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long task observer not supported
      }

      // Layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.value > 0.1) {
              console.warn('⚠️ Layout shift detected:', {
                value: entry.value,
                sources: entry.sources
              });
            }
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Layout shift observer not supported
      }

      // Paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`🎨 Paint: ${entry.name} at ${entry.startTime.toFixed(2)}ms`);
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
    }
  }

  logInitialMetrics() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paintEntries = performance.getEntriesByType('paint');

        console.group('📊 Page Load Metrics');
        console.table({
          'DNS Lookup': `${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`,
          'TCP Connection': `${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`,
          'Request Time': `${(navigation.responseStart - navigation.requestStart).toFixed(2)}ms`,
          'Response Time': `${(navigation.responseEnd - navigation.responseStart).toFixed(2)}ms`,
          'DOM Processing': `${(navigation.domComplete - navigation.domInteractive).toFixed(2)}ms`,
          'Load Complete': `${navigation.loadEventEnd.toFixed(2)}ms`,
        });

        // Core Web Vitals
        if (paintEntries.length) {
          console.log('Core Web Vitals:', {
            FCP: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime,
            LCP: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime,
          });
        }

        console.groupEnd();
      }, 1000);
    });
  }

  mark(label) {
    performance.mark(label);
    console.log(`📍 Performance mark: ${label}`);
  }

  measure(label, startMark, endMark) {
    performance.measure(label, startMark, endMark);
    const measure = performance.getEntriesByName(label)[0];
    console.log(`📏 Performance measure: ${label} = ${measure.duration.toFixed(2)}ms`);
  }
}

// Initialize performance logging
const perfLogger = new PerformanceLogger();
```

### 🔍 Local Storage Debugging

```javascript
// Monitor storage changes
class StorageDebugger {
  constructor() {
    this.interceptStorage();
    this.monitorChanges();
  }

  interceptStorage() {
    // Intercept localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      console.log(`💾 LocalStorage SET: ${key} = ${value?.substring(0, 100)}`);
      return originalSetItem.call(this, key, value);
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      console.log(`💾 LocalStorage REMOVE: ${key}`);
      return originalRemoveItem.call(this, key);
    };
  }

  monitorChanges() {
    window.addEventListener('storage', (e) => {
      console.group('💾 Storage Event');
      console.log('Key:', e.key);
      console.log('Old Value:', e.oldValue);
      console.log('New Value:', e.newValue);
      console.log('URL:', e.url);
      console.groupEnd();
    });
  }

  showStats() {
    const stats = {
      'LocalStorage Items': localStorage.length,
      'SessionStorage Items': sessionStorage.length,
      'LocalStorage Size': new Blob(Object.values(localStorage)).size,
      'SessionStorage Size': new Blob(Object.values(sessionStorage)).size,
    };

    console.table(stats);

    // Show all items
    console.group('LocalStorage Contents');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`${key}:`, localStorage.getItem(key));
    }
    console.groupEnd();
  }

  clear() {
    console.warn('🗑️ Clearing all storage...');
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Storage cleared');
  }
}

// Initialize storage debugger
const storageDebugger = new StorageDebugger();
```

### 📋 Debug Console Helpers

```javascript
// Add useful debug commands to window
window.debug = {
  // Enable verbose logging
  enableVerbose: () => {
    localStorage.setItem('DEBUG', '*');
    localStorage.setItem('DEBUG_LEVEL', 'debug');
    console.log('✅ Verbose logging enabled');
  },

  // Disable logging
  disableLogging: () => {
    localStorage.removeItem('DEBUG');
    localStorage.removeItem('DEBUG_LEVEL');
    console.log('🔇 Logging disabled');
  },

  // Show all event listeners
  showListeners: (element = document.body) => {
    const listeners = getEventListeners(element);
    console.table(listeners);
  },

  // Monitor element changes
  observeElement: (selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      console.error('Element not found');
      return;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log('Element changed:', mutation);
      });
    });

    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log(`Observing element: ${selector}`);
  },

  // Export logs
  exportLogs: () => {
    const logs = console.logs || [];
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${Date.now()}.json`;
    a.click();
  },

  // Performance report
  perfReport: () => {
    console.group('📊 Performance Report');
    console.log('Memory:', performance.memory);
    console.log('Navigation:', performance.getEntriesByType('navigation')[0]);
    console.log('Resources:', performance.getEntriesByType('resource').length);
    console.table(performance.getEntriesByType('measure'));
    console.groupEnd();
  },
};

console.log('🛠️ Debug helpers loaded. Use window.debug.* commands');
```

---

*Browser console is your primary debugging tool. Master its features and create custom logging utilities for efficient debugging.*