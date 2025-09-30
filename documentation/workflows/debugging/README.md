# 🔍 Debugging Workflows

## 🎯 Overview
Comprehensive debugging strategies for full-stack applications using Next.js, Convex, and modern web technologies. Each guide provides detailed steps, tools, and log analysis techniques.

## 📁 Directory Structure

```
debugging/
├── README.md               # This file
├── frontend-debugging.md   # Client-side debugging
├── backend-debugging.md    # Server-side debugging
├── nextjs-errors.md       # Next.js specific issues
├── convex-errors.md       # Convex database/functions
├── browser-logs.md        # Browser console analysis
├── vercel-logs.md         # Vercel deployment logs
├── performance-debug.md   # Performance profiling
└── network-debug.md       # API & network issues
```

## 🚀 Quick Start Debugging

### 1. Identify Error Location
```bash
# Check build errors
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Check runtime logs
npm run dev
```

### 2. Gather Information
- **Browser Console**: F12 → Console tab
- **Network Tab**: F12 → Network tab
- **React DevTools**: Component tree & props
- **Vercel Logs**: Dashboard → Functions → Logs
- **Convex Logs**: `npx convex logs --watch`

### 3. Select Debug Guide
| Issue Type | Guide | Key Tools |
|------------|-------|-----------|
| UI not rendering | [Frontend Debugging](./frontend-debugging.md) | React DevTools, Console |
| API errors | [Backend Debugging](./backend-debugging.md) | Network tab, Server logs |
| Build failures | [Next.js Errors](./nextjs-errors.md) | Build output, TypeScript |
| Database issues | [Convex Errors](./convex-errors.md) | Convex dashboard, Logs |
| Slow performance | [Performance Debug](./performance-debug.md) | Lighthouse, Profiler |

## 🛠️ Essential Debug Commands

### Development Environment
```bash
# Verbose logging in development
DEBUG=* npm run dev

# Next.js debug mode
NODE_OPTIONS='--inspect' npm run dev

# Convex real-time logs
npx convex logs --watch

# Clear caches
rm -rf .next node_modules/.cache
```

### Production Debugging
```bash
# Vercel logs (requires CLI)
vercel logs --follow

# Source maps for production
NEXT_PUBLIC_ENABLE_SOURCE_MAPS=true npm run build

# Analyze bundle size
npm run analyze
```

## 📊 Log Levels & Verbosity

### Setting Log Levels
```javascript
// Frontend (browser console)
localStorage.setItem('DEBUG', '*'); // Enable all logs
localStorage.setItem('DEBUG', 'app:*'); // App-specific logs
localStorage.setItem('DEBUG', 'api:*,db:*'); // Multiple namespaces

// Backend (Node.js)
process.env.DEBUG = '*'; // All logs
process.env.DEBUG = 'app:*,api:*'; // Specific modules
process.env.LOG_LEVEL = 'debug'; // Common pattern
```

### Custom Logging
```typescript
// utils/logger.ts
const DEBUG = process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: any[]) => DEBUG && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => console.info('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),

  // Detailed logging with context
  detailed: (context: string, data: any) => {
    if (DEBUG) {
      console.group(`[${context}]`);
      console.log('Timestamp:', new Date().toISOString());
      console.log('Data:', JSON.stringify(data, null, 2));
      console.trace('Stack trace');
      console.groupEnd();
    }
  }
};
```

## 🔍 Debug Workflow Process

### Step 1: Reproduce
1. Document exact steps to reproduce
2. Note environment (browser, OS, user type)
3. Capture screenshots/videos
4. Save console output

### Step 2: Isolate
1. Simplify the reproduction case
2. Remove unrelated code
3. Test in different environments
4. Check recent changes (git log)

### Step 3: Investigate
1. Add strategic console.logs
2. Use breakpoints in DevTools
3. Check network requests
4. Review error stack traces

### Step 4: Fix & Verify
1. Implement minimal fix
2. Test the specific case
3. Check for regressions
4. Add preventive tests

## 🎯 Common Debugging Patterns

### Frontend Issues
- **Hydration Errors**: Check server/client rendering mismatch
- **State Issues**: Verify React state updates and effects
- **Style Problems**: Inspect CSS specificity and Tailwind classes

### Backend Issues
- **API Failures**: Check request/response payloads
- **Auth Problems**: Verify tokens and permissions
- **Database Errors**: Check schema and migrations

### Build/Deploy Issues
- **Type Errors**: Run `tsc --noEmit`
- **Module Issues**: Clear node_modules and reinstall
- **Env Variables**: Verify all required vars are set

## 📚 Debug Resources

### Browser DevTools
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Firefox Developer Tools](https://firefox-source-docs.mozilla.org/devtools-user/)
- [Safari Web Inspector](https://webkit.org/web-inspector/)

### Framework-Specific
- [Next.js Debugging](https://nextjs.org/docs/advanced-features/debugging)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Convex Dashboard](https://docs.convex.dev/dashboard)

### Performance Tools
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)
- [WebPageTest](https://www.webpagetest.org/)
- [Bundle Analyzer](https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer)

## 🚨 Emergency Debug Checklist

When everything is broken:
1. [ ] Clear all caches (browser, Next.js, node_modules)
2. [ ] Check git status for uncommitted changes
3. [ ] Verify all environment variables
4. [ ] Test in incognito/private mode
5. [ ] Try different browser
6. [ ] Check server status (Vercel, Convex)
7. [ ] Review recent deployments
8. [ ] Rollback if necessary

## 🔗 Cross-References
- → [Bugfix Management](../bugfix-management/) - Systematic bug tracking
- → [Feature Development](../feature-development/) - Prevent bugs during development
- → [Stack Documentation](../../stack/) - Technology-specific issues
- → [Pattern Library](../../patterns/) - Common solutions

---

*Effective debugging requires systematic approach, proper tooling, and detailed logging. Always document findings for future reference.*