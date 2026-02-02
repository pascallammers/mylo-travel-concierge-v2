# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Unimplemented File Upload & Moderation:**
- Issue: File upload and image moderation are stubbed with TODOs returning hardcoded safe responses
- Files: `components/ui/form-component.tsx` (lines 2371-2383)
- Impact: Users can upload files but they're only stored as data URLs in memory, no actual file persistence. Image moderation check is bypassed (returns 'safe' unconditionally)
- Fix approach: Implement actual file upload to S3 (AWS SDK already available), integrate OpenAI Vision API or similar for moderation. Update `uploadFile` and `checkImageModeration` functions to persist and validate

**Hardcoded Email Domain Configuration:**
- Issue: Email domain is hardcoded to "never-economy-again.com" with TODO note about updating after deployment
- Files: `lib/email.ts` (line 4)
- Impact: Email domain is tightly coupled to specific domain, makes it hard to deploy to different environments or change email provider
- Fix approach: Move FROM_EMAIL to environment variable `EMAIL_FROM_ADDRESS` or similar, make it configurable per environment

**Stale Better-Auth Dependency:**
- Issue: Using a GitHub PR fork of better-auth (`better-auth@https://pkg.pr.new/better-auth/better-auth@8e825ad`) instead of stable package
- Files: `package.json` (line 87)
- Impact: Depends on unreleased code with no version stability, risk of unexpected breaking changes, difficult to update or rollback
- Fix approach: Migrate to official better-auth release when v1 stable is available, or switch to @polar-sh/better-auth (already in use alongside)

## Known Bugs

**Inconsistent Auth Client Configuration:**
- Issue: Two different auth clients created (`betterauthClient` with DodoPayments and `authClient` with Polar) but mostly uses Polar one
- Files: `lib/auth-client.ts` (lines 17-25)
- Symptoms: Potential confusion about which client is used, DodoPayments client appears unused in exports
- Trigger: Check what's actually exported and used across the app
- Workaround: Both clients have same base setup, fallback to Polar generally works

**Incomplete Database Migration from Supabase:**
- Issue: User table contains Supabase-specific fields (`supabaseUserId`, `rawUserMetaData`) still mapped but migration may not be complete
- Files: `lib/db/schema.ts` (lines 22-23)
- Trigger: User data from old Supabase system still partially referenced
- Impact: Dead code paths possible if both old and new auth systems try to coexist
- Workaround: Supabase fields appear to be for backward compatibility mapping only

**Function Role Check Type Safety:**
- Issue: `activationStatus` enum uses 'active', 'inactive', 'grace_period', 'suspended' but subscription status uses different values ('active', 'inactive', 'cancelled', 'none')
- Files: `lib/db/schema.ts` (lines 14-19), `app/api/admin/users/route.ts` (line 10)
- Impact: Type mismatch can cause silent bugs if status values get confused
- Trigger: API combining activationStatus and subscription status without clear distinction

## Security Considerations

**Overly Permissive Image Remote Patterns:**
- Risk: next.config.ts allows remote images from virtually any domain with `hostname: '**'` pattern
- Files: `next.config.ts` (lines 93-105)
- Current mitigation: Firewall/CDN level protection may exist, but application-level validation is missing
- Recommendations: Remove wildcard `**` patterns, whitelist only necessary domains explicitly. Specifically allow only `www.google.com`, `maps.googleapis.com`, etc. instead of catch-all patterns

**Dangerous SVG Allow & SVG XSS Risk:**
- Risk: `dangerouslyAllowSVG: true` enabled in image configuration
- Files: `next.config.ts` (line 92)
- Current mitigation: SVG files are processed but not explicitly sanitized
- Recommendations: Keep SVG allowed but implement SVG sanitization on upload, never allow user-uploaded SVGs without sanitization. Use libraries like `svg-sanitize` on any user-provided SVG content

**API Keys Exposed in Console Logs:**
- Risk: Sensitive API keys logged to console (e.g., Resend API key check, reset URLs with tokens)
- Files: `lib/email.ts` (lines 160-161, 216-217), `lib/auth.ts` (lines 92-95)
- Current mitigation: Log filters apply in production (`removeConsole: { exclude: ['error'] }`)
- Recommendations: Remove sensitive logging completely, use debug flags instead. Never log tokens, API keys, or URLs containing secrets even in development

**Missing CSRF Protection on Form Actions:**
- Risk: Form submissions in `components/ui/form-component.tsx` use server actions but CSRF tokens not visible
- Files: `components/ui/form-component.tsx` (line 22 imports `enhancePrompt`)
- Current mitigation: Better-Auth may provide automatic protection
- Recommendations: Verify Better-Auth CSRF handling is enabled, add explicit CSRF token validation to sensitive actions

**Weak Password Validation:**
- Risk: Better-Auth emailAndPassword uses custom bcrypt hash but no visible password complexity requirements
- Files: `lib/auth.ts` (lines 83-90)
- Current mitigation: bcrypt is used for hashing (good), but validation rules unknown
- Recommendations: Implement password policy (min length 12, require special chars), enforce at registration time

**Environment Variable Exposure Risk:**
- Risk: Many sensitive environment variables have hardcoded fallbacks (e.g., localhost URLs)
- Files: `lib/auth-client.ts` (line 14), `lib/email.ts` (lines 46-48)
- Current mitigation: NEXT_PUBLIC_APP_URL is available but fallbacks don't validate
- Recommendations: Validate all environment variables at startup, fail fast if required vars missing. Never use hardcoded URLs as fallback to production domains

## Performance Bottlenecks

**Massive Component Size (form-component.tsx):**
- Problem: Single React component is 3,323 lines long
- Files: `components/ui/form-component.tsx`
- Cause: Multiple features bundled together (model selection, file upload, search groups, tool invocations, etc.)
- Impact: Long compile times, hard to optimize rendering, increased bundle size
- Improvement path: Break into smaller components: `ModelSelector`, `FormFileUpload`, `SearchGroupToggle`, `ToolInvocationDisplay`. Use React.memo on parts that don't need frequent re-renders

**Large Intermediate Components (2000+ lines):**
- Problem: extremeSearchTool has 2,433 lines, message-parts has 2,321 lines, chat-interface has 661 lines
- Files: `components/extreme-search.tsx`, `components/message-parts/index.tsx`, `components/chat-interface.tsx`
- Cause: Multiple rendering modes and complex nested logic
- Impact: Slow re-renders when props change, difficult to optimize memoization
- Improvement path: Extract view components, create separate display modules for different content types

**N+1 Subscription Query Pattern Mitigated but Needs Verification:**
- Problem: Admin users list endpoint claims optimization but still needs verification
- Files: `app/api/admin/users/route.ts` (lines 40-51)
- Cause: Aggregating stats across users and subscriptions
- Impact: Slow admin page loads with many users
- Improvement path: Document the batch query approach more clearly, add database indexes for subscription queries, consider caching user stats

**Missing Database Indexes:**
- Problem: Schema defined but no indication of indexes on frequently queried columns
- Files: `lib/db/schema.ts`
- Cause: No index definitions visible in schema
- Impact: Slow queries on email searches, role filters, status filters
- Improvement path: Add indexes on `user.email`, `user.role`, `subscription.status`, `chat.userId`

## Fragile Areas

**File Search Store Migration (Knowledge Base):**
- Files: `lib/db/queries/kb-documents.ts`, `app/api/admin/knowledge-base/*`
- Why fragile: Multiple integration tests reference Gemini file search stores migration. Code appears partially refactored with legacy patterns
- Safe modification: All KB changes must update corresponding integration tests. Add migration rollback procedures before modifying storage layer
- Test coverage: KB integration tests exist but coverage gaps likely in edge cases (empty stores, concurrent uploads)

**Email Delivery System:**
- Files: `lib/email.ts`, `lib/auth.ts`
- Why fragile: Depends on Resend API being available. No retry logic visible. Password reset tokens logged but not regenerated on failure
- Safe modification: Test all email sending paths with Resend sandbox. Add retry logic for transient failures. Remove token logging
- Test coverage: Email functions not unit tested, only console.log for debugging

**Authentication State Management:**
- Files: `lib/auth.ts`, `lib/auth-client.ts`, `app/actions.ts`
- Why fragile: Multiple auth systems coexist (Better-Auth, Polar, DodoPayments). User activation status separate from subscription status
- Safe modification: Never add new auth flow without updating both server and client. Test payment webhook flows carefully
- Test coverage: Auth flow tests missing, only API routes have basic tests

**Webhook Processing (Payments & Auth):**
- Files: `app/api/*` webhook routes, `lib/email.ts` (payment alerts)
- Why fragile: Multiple webhook sources (Polar, DodoPayments, AwardWallet) but consistent error handling not visible
- Safe modification: Add comprehensive logging to webhook handlers. Implement idempotency checking. Never assume webhook data format matches docs
- Test coverage: Individual webhook tests exist but integration scenarios missing

## Scaling Limits

**Message Storage (JSON parts):**
- Current capacity: All message content stored as JSON in database, no streaming/chunking
- Files: `lib/db/schema.ts` (line 91)
- Limit: Postgres JSONB column has theoretical 1GB limit but practical query speed degrades significantly after 100KB per message
- Scaling path: Implement message chunking for long conversations, archive old messages to cold storage, implement full-text search instead of JSON scanning

**Chat History Sidebar (Unbounded List):**
- Current capacity: Component likely loads all chat records for user
- Files: `components/chat-sidebar.tsx` (if exists), `components/chat-history-dialog.tsx`
- Limit: Users with 1000+ chats will experience slow page loads
- Scaling path: Implement pagination/virtual scrolling in chat list, add search filter, implement lazy loading

**File Storage Via Data URLs:**
- Current capacity: Files stored as base64 data URLs in memory and JSONB fields
- Files: `components/ui/form-component.tsx` (line 2378)
- Limit: Extremely inefficient, memory bloat, can't handle files >10MB
- Scaling path: Move to S3 bucket (AWS SDK ready), implement resumable uploads for large files, keep only file metadata in database

**Knowledge Base Document Limits:**
- Current capacity: KB batch upload file limits defined but actual enforced limits unknown
- Limit: KB_MAX_FILE_SIZE_MB and KB_MAX_BULK_UPLOAD_FILES environment variables exist but need verification
- Scaling path: Add explicit rate limiting per user, implement background job queue for processing, add document version management

## Dependencies at Risk

**Custom better-auth Fork (GitHub PR):**
- Risk: No official stable version, depends on unreleased code
- Impact: Can't easily update, future breaking changes likely
- Migration plan:
  1. Wait for better-auth v1 stable release
  2. Verify Polar integration still works with stable version
  3. Migrate package.json to official version, run full test suite
  4. Or switch entirely to @polar-sh/better-auth which is actively maintained

**Partially Integrated Payment Systems:**
- Risk: Both Polar and DodoPayments integrated but feature parity uncertain
- Impact: Different code paths for different users, inconsistent billing
- Migration plan:
  1. Audit which customers use which system
  2. Standardize on single payment provider
  3. Migrate legacy customers with minimal disruption
  4. Remove unused payment provider code

**Multiple AI SDK Providers:**
- Risk: Dependencies on 8+ different AI provider SDKs (@ai-sdk/anthropic, openai, groq, google, mistral, xai, etc.) increases attack surface
- Impact: Security updates need coordination across all providers, larger bundle
- Migration plan: Consolidate to 1-2 primary providers, use fallback system for others. Consider using bedrock or other provider-agnostic gateway

## Missing Critical Features

**Audit Logging:**
- Problem: No visible audit trail for user actions (login, data access, modifications)
- Blocks: Compliance requirements (GDPR, SOC2), security investigation, fraud detection
- Files: Not found in codebase
- Recommendation: Implement audit table, log all sensitive operations (auth, payments, admin actions)

**Request Rate Limiting (User-Level):**
- Problem: Better-Auth has rate limiting (50 requests/60s) but no user-level API rate limiting visible
- Blocks: Preventing abuse, ensuring fair resource allocation
- Files: API route handlers don't show rate limit checks
- Recommendation: Implement Redis-backed rate limiter per user, different limits for different endpoints

**Graceful Error Recovery:**
- Problem: Many try-catch blocks just return null/error, no automatic retry logic
- Blocks: Resilience to transient failures, user experience during outages
- Files: `lib/db/queries.ts`, `lib/api/*.ts`
- Recommendation: Implement retry with exponential backoff for transient errors, circuit breaker for persistent failures

**Input Validation Framework:**
- Problem: API routes validate params but no centralized validation schema
- Blocks: Preventing injection attacks, type safety, consistent error messages
- Files: Individual route handlers do manual validation
- Recommendation: Use Zod (already in deps) for all input validation, middleware for shared patterns

## Test Coverage Gaps

**Form Component Interactions:**
- What's not tested: File upload flow, model switching, search group selection, tool invocation rendering
- Files: `components/ui/form-component.tsx` (3,323 lines)
- Risk: Major features could break in production without notice
- Priority: High - form is critical path for users

**API Error Handling:**
- What's not tested: Timeout handling, malformed request responses, partial failures in batch operations
- Files: `app/api/**/*.ts`
- Risk: Unclear behavior during infrastructure issues or bad input
- Priority: High - error handling consistency critical for reliability

**Payment Webhook Processing:**
- What's not tested: Duplicate webhook delivery, out-of-order webhook processing, partial payment scenarios
- Files: `app/api/webhooks/*`, `lib/auth.ts` (payment callbacks)
- Risk: Double-charging or missed charges possible
- Priority: Critical - financial operations must be bulletproof

**Authentication State Consistency:**
- What's not tested: Session expiration, concurrent login attempts, auth client vs server state mismatch
- Files: `lib/auth.ts`, `lib/auth-client.ts`
- Risk: Users might stay logged in after logout, or see stale user data
- Priority: High - fundamental security issue

**Extreme Search (Research Tool):**
- What's not tested: Large result sets, timeout scenarios, concurrent search requests
- Files: `components/extreme-search.tsx`, `lib/tools/extreme-search.ts`
- Risk: UI crashes with large datasets, search gets stuck
- Priority: Medium - affects user experience but not core functionality

**Database Migration & Seeding:**
- What's not tested: Schema migration rollback, data loss scenarios, foreign key constraint violations
- Files: Not visible - migration files not in main schema
- Risk: Data loss in production, failed deployments
- Priority: Critical - must test before any schema changes

---

*Concerns audit: 2026-02-02*
