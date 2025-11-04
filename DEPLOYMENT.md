# Deployment Guide - Flight Search Feature

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] All tests passing (51 test cases)
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] Code reviewed
- [x] Documentation complete

### ✅ Database
- [x] Migration `0008_peaceful_sunfire.sql` created
- [x] Migration applied to development database
- [ ] Migration ready for staging
- [ ] Migration ready for production

### ✅ Environment Variables
Required variables for Flight Search:

**Server-side:**
```bash
# Database
DATABASE_URL=postgresql://...

# Seats.aero API
SEATSAERO_API_KEY=your_api_key

# Amadeus API
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENVIRONMENT=test  # or 'production'
```

**Client-side:**
```bash
# Feature Flag
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false  # Start disabled
```

### ✅ API Credentials
- [ ] Seats.aero API key validated
- [ ] Amadeus Client ID validated
- [ ] Amadeus Client Secret validated
- [ ] Amadeus test environment accessible
- [ ] Amadeus production environment accessible (for prod)

---

## Staging Deployment

### Step 1: Verify Branch
```bash
git checkout feature/v1-to-v2-tool-calling-migration
git status
git log --oneline -10
```

**Expected commits:**
- `786ec0d` feat(tests): Add comprehensive unit and integration tests
- `3f71926` feat(phase-5): Complete Chat Integration
- `b656638` fix: Change parameters to inputSchema
- `8531a4c` feat(phase-4): Flight Search Tool implementation
- Plus earlier commits for Phases 0-3

### Step 2: Push to GitHub
```bash
git push origin feature/v1-to-v2-tool-calling-migration
```

### Step 3: Create Pull Request (Optional)
```bash
gh pr create \
  --title "feat: V1 to V2 Tool-Calling Migration - Flight Search" \
  --body "Implements flight search with Seats.aero and Amadeus integration" \
  --base main
```

### Step 4: Deploy to Vercel Preview

**Option A: Automatic (on PR creation)**
- Vercel will automatically create a preview deployment
- Check GitHub PR for deployment URL

**Option B: Manual (via Vercel CLI)**
```bash
vercel --prod=false
```

### Step 5: Configure Staging Environment Variables

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Select "Preview" environment
3. Add variables:

```
SEATSAERO_API_KEY=xxx
AMADEUS_CLIENT_ID=xxx
AMADEUS_CLIENT_SECRET=xxx
AMADEUS_ENVIRONMENT=test
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true
```

4. Redeploy preview for changes to take effect

### Step 6: Apply Database Migration

**Important:** Ensure staging database URL is configured

```bash
# Set staging database URL
export DATABASE_URL="postgresql://staging..."

# Apply migration
npx drizzle-kit push:pg
```

### Step 7: Staging Verification

Run through manual test checklist:

**Basic Functionality:**
- [ ] Chat interface loads
- [ ] Flight tool appears in tool selector (if UI shows tools)
- [ ] Can send flight search query in German
- [ ] Results display correctly
- [ ] Both award and cash flights show

**Test Queries:**
```
1. "Suche Business Class Flüge von Frankfurt nach New York am 15. März 2025"
2. "Zeige mir die günstigsten Award-Flüge von FRA nach JFK"
3. "Ich brauche einen Hin- und Rückflug von München nach Tokyo im Juni"
```

**Error Handling:**
- [ ] Invalid date handling
- [ ] Invalid airport codes
- [ ] API failures handled gracefully

**Performance:**
- [ ] Response time <5 seconds
- [ ] No console errors
- [ ] Database queries efficient

### Step 8: Monitor Staging
- Check Vercel logs for errors
- Monitor database for tool_calls entries
- Verify token caching works
- Check deduplication logic

---

## Production Deployment

### Prerequisites
- [ ] Staging tests all passing
- [ ] No critical bugs found
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Team approval obtained

### Step 1: Merge to Main
```bash
# Update main branch
git checkout main
git pull origin main

# Merge feature branch
git merge feature/v1-to-v2-tool-calling-migration

# Push to main
git push origin main
```

### Step 2: Tag Release (Optional)
```bash
git tag -a v2.0.0-flight-search -m "Flight Search Feature Release"
git push origin v2.0.0-flight-search
```

### Step 3: Configure Production Environment Variables

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Select "Production" environment
3. Add variables:

```
SEATSAERO_API_KEY=xxx_production
AMADEUS_CLIENT_ID=xxx_production
AMADEUS_CLIENT_SECRET=xxx_production
AMADEUS_ENVIRONMENT=production
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false  # Start disabled!
```

### Step 4: Deploy to Production
```bash
vercel --prod
```

Or use Vercel dashboard to promote from main branch.

### Step 5: Apply Production Database Migration

**⚠️ Critical: Backup database first!**

```bash
# Backup production database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Set production database URL
export DATABASE_URL="postgresql://production..."

# Apply migration
npx drizzle-kit push:pg
```

### Step 6: Gradual Rollout

**Phase 1: Internal Testing (0-24 hours)**
```
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false
```
- Monitor for any deployment issues
- Test manually with internal team
- Check logs for errors

**Phase 2: Limited Rollout (24-48 hours)**
```
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true
```
- Enable feature flag
- Monitor error rates
- Track performance metrics
- Limit to 10% of users (if user-based rollout available)

**Phase 3: Full Rollout (48+ hours)**
- Enable for all users
- Continue monitoring
- Address any issues promptly

### Step 7: Production Monitoring

**Metrics to Track:**
1. **API Success Rates**
   - Seats.aero: Target >95%
   - Amadeus: Target >95%
   - Overall: Target >95%

2. **Performance**
   - p95 response time: Target <5s
   - Database query time: Monitor
   - Token cache hit rate: Target >90%

3. **Error Rates**
   - Monitor Vercel logs
   - Check database error logs
   - Track API failures

4. **Usage Stats**
   - Number of searches per day
   - Popular routes
   - Cabin class preferences

**Monitoring Tools:**
- Vercel Analytics
- Vercel Logs
- Database monitoring (Neon)
- PostHog (if configured)

---

## Rollback Procedures

### Level 1: Feature Flag Disable (Immediate)
**When:** Minor issues, user-facing bugs

```bash
# In Vercel Dashboard
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false
```

**Time to effect:** ~1 minute
**Impact:** Feature hidden from users, no data loss

### Level 2: Vercel Rollback (Fast)
**When:** Severe bugs, performance issues

```bash
vercel rollback
```

Or via Vercel Dashboard:
1. Go to Deployments
2. Find previous stable deployment
3. Click "Promote to Production"

**Time to effect:** ~2-5 minutes
**Impact:** Entire app rolled back to previous version

### Level 3: Database Rollback (Last Resort)
**When:** Database corruption, critical data issues

```bash
# Restore from backup
psql $DATABASE_URL < backup_TIMESTAMP.sql

# Or drop new tables
DROP TABLE IF EXISTS tool_calls CASCADE;
DROP TABLE IF EXISTS session_states CASCADE;
DROP TABLE IF EXISTS amadeus_tokens CASCADE;
```

**Time to effect:** 5-30 minutes
**Impact:** Loss of tool-call history, session data, cached tokens

---

## Post-Deployment

### Week 1: Active Monitoring
- [ ] Check logs daily
- [ ] Monitor error rates
- [ ] Track performance metrics
- [ ] Collect user feedback
- [ ] Address issues promptly

### Week 2-4: Optimization
- [ ] Analyze usage patterns
- [ ] Optimize slow queries
- [ ] Improve error messages
- [ ] Enhance user experience

### Month 2+: Iteration
- [ ] Plan enhancements based on feedback
- [ ] Consider new features (multi-city, price alerts)
- [ ] Optimize API usage for cost
- [ ] A/B test improvements

---

## Troubleshooting

### Issue: Feature not appearing
**Check:**
- Feature flag enabled: `NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true`
- Environment variable deployed
- Browser cache cleared
- Tool registered in `app/api/search/route.ts`

### Issue: API errors
**Check:**
- API credentials correct
- `AMADEUS_ENVIRONMENT` set correctly
- Rate limits not exceeded
- Network connectivity

### Issue: Slow performance
**Check:**
- Database queries optimized
- Token caching working
- Parallel execution working
- Network latency

### Issue: Database errors
**Check:**
- Migration applied
- Database connection stable
- Table permissions correct
- Indexes created

---

## Emergency Contacts

**Development Team:**
- Lead Developer: [contact]
- DevOps: [contact]

**API Providers:**
- Seats.aero Support: [link]
- Amadeus Support: [link]

**Infrastructure:**
- Vercel Status: https://vercel-status.com
- Neon Status: https://neonstatus.com

---

## Success Criteria

### Deployment Success
- [ ] Zero-downtime deployment
- [ ] All services healthy
- [ ] Feature flag working
- [ ] Monitoring active

### Feature Success (Week 1)
- [ ] >95% API success rate
- [ ] <5s p95 response time
- [ ] >90% token cache hit rate
- [ ] Zero critical bugs
- [ ] Positive user feedback

### Long-term Success (Month 1)
- [ ] Consistent performance
- [ ] Growing usage
- [ ] Low error rates
- [ ] User satisfaction high
