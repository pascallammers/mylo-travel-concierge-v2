# Task: V1 zu V2 Tool-Calling Migration

**Task ID:** v1-to-v2-tool-calling-migration  
**Date:** 31. Oktober 2024  
**Type:** Full-Stack  
**Status:** Planning Phase ✅ | Implementation Phase ⏳

---

## 📋 Task Overview

Migration des Tool-Calling-Systems von V1 (Supabase Edge Functions) zu V2 (Next.js + Vercel AI SDK).

**Hauptziele:**
- ✈️ Seats.aero Integration für Award-Flugsuche
- 🌍 Amadeus Integration für Cash-Flugsuche
- 🗄️ Tool-Call Registry System
- 💾 Session State Management
- 🔐 Token-Management für APIs

---

## 📁 Task Structure

```
v1-to-v2-tool-calling-migration/
├── README.md                                          # This file
├── research-v1-to-v2-tool-calling-migration.md       # Research phase ✅
├── plan-v1-to-v2-tool-calling-migration.md           # Implementation plan ✅
├── files-edited.md                                    # Files changed (TBD)
└── verification.md                                    # Test results (TBD)
```

---

## 🎯 Goals

1. **Research Phase** ✅
   - Analyzed V1 architecture (Supabase Edge Functions)
   - Analyzed V2 architecture (Next.js + Vercel AI SDK)
   - Identified gaps and requirements
   - Evaluated migration approaches
   - **Decision:** Full Next.js Migration (Option A)

2. **Planning Phase** ✅
   - Created detailed implementation plan
   - Defined 7 implementation phases
   - Estimated timeline: 11-18 days
   - Prepared database schemas
   - Defined API integrations

3. **Implementation Phase** ⏳ (Next)
   - Phase 0: Preparation
   - Phase 1: Tool-Call Infrastructure
   - Phase 2: Seats.aero Integration
   - Phase 3: Amadeus Integration
   - Phase 4: Flight Search Tool
   - Phase 5: Chat Integration
   - Phase 6: Testing
   - Phase 7: Deployment

---

## 📊 Current Status

**Completed:**
- ✅ Research Phase
- ✅ Planning Phase

**In Progress:**
- ⏳ Phase 0: Preparation
  - [ ] Create database schemas
  - [ ] Setup environment variables
  - [ ] Create project structure

**Pending:**
- ⏳ Phase 1-7 (See plan document)

---

## 🔗 Key Files

**Research:**
- [`research-v1-to-v2-tool-calling-migration.md`](./research-v1-to-v2-tool-calling-migration.md)
  - V1 architecture analysis
  - V2 architecture analysis
  - Gap analysis
  - API requirements

**Plan:**
- [`plan-v1-to-v2-tool-calling-migration.md`](./plan-v1-to-v2-tool-calling-migration.md)
  - 7 implementation phases
  - Code examples
  - Database schemas
  - Timeline & estimates

**Reference:**
- `documentation/context/mylo-tool-calling.md` - V1 documentation
- `documentation/migration/v1-to-v2-tool-calling-migration-plan.md` - Original combined document

---

## 🚀 Quick Start (Phase 0)

### Prerequisites

1. **API Credentials:**
   - Seats.aero Partner API Key
   - Amadeus API Key + Secret
   - OpenAI API Key (already configured)

2. **Environment:**
   ```bash
   AMADEUS_API_KEY=<Client ID>
   AMADEUS_API_SECRET=<Client Secret>
   AMADEUS_ENV=test
   SEATSAERO_API_KEY=<Partner API Key>
   ```

3. **Database:**
   - PostgreSQL with Drizzle ORM
   - New tables: `tool_calls`, `session_states`, `amadeus_tokens`

### Setup Commands

```bash
# 1. Create database schemas
touch lib/db/schema/tool-calls.ts
touch lib/db/schema/session-states.ts
touch lib/db/schema/amadeus-tokens.ts

# 2. Create API clients
mkdir -p lib/api
touch lib/api/seats-aero-client.ts
touch lib/api/amadeus-client.ts
touch lib/api/amadeus-token.ts

# 3. Create flight search tool
mkdir -p lib/tools/flight-search
touch lib/tools/flight-search.ts

# 4. Generate and apply migrations
pnpm drizzle-kit generate:pg
pnpm drizzle-kit push:pg

# 5. Add environment variables to Vercel
vercel env add AMADEUS_API_KEY
vercel env add AMADEUS_API_SECRET
vercel env add AMADEUS_ENV
vercel env add SEATSAERO_API_KEY
```

---

## 📝 Implementation Checklist

### Phase 0: Preparation (1-2 Days)
- [ ] Create `lib/db/schema/tool-calls.ts`
- [ ] Create `lib/db/schema/session-states.ts`
- [ ] Create `lib/db/schema/amadeus-tokens.ts`
- [ ] Update `lib/db/schema/index.ts`
- [ ] Generate Drizzle migration
- [ ] Apply migration to database
- [ ] Add environment variables to Vercel
- [ ] Update `.env.local` for development
- [ ] Create project structure

### Phase 1: Tool-Call Infrastructure (2-3 Days)
- [ ] Create `lib/db/queries/tool-calls.ts`
- [ ] Create `lib/db/queries/session-state.ts`
- [ ] Update `lib/db/queries/index.ts`
- [ ] Create `lib/api/amadeus-token.ts`
- [ ] Write unit tests

### Phase 2: Seats.aero Integration (2-3 Days)
- [ ] Create `lib/api/seats-aero-client.ts`
- [ ] Implement search functionality
- [ ] Implement flight details loading
- [ ] Write unit tests

### Phase 3: Amadeus Integration (2-3 Days)
- [ ] Create `lib/api/amadeus-client.ts`
- [ ] Integrate token management
- [ ] Implement search functionality
- [ ] Write unit tests

### Phase 4: Flight Search Tool (1-2 Days)
- [ ] Create `lib/tools/flight-search.ts`
- [ ] Implement tool with Vercel AI SDK
- [ ] Integrate with tool-call registry
- [ ] Integrate with session state
- [ ] Write unit tests

### Phase 5: Chat Integration (1-2 Days)
- [ ] Register tool in `app/api/search/route.ts`
- [ ] Add "flights" group to `app/actions.ts`
- [ ] Add flight instructions to `app/actions.ts`
- [ ] Test tool in chat

### Phase 6: Testing (2-3 Days)
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Manual testing with test queries
- [ ] Performance testing
- [ ] Error handling verification

### Phase 7: Deployment (1-2 Days)
- [ ] Deploy to staging
- [ ] Enable feature flag
- [ ] Test on staging
- [ ] Deploy to production
- [ ] Monitor for issues

---

## 🔄 Next Actions

1. **Start Phase 0:**
   - Create database schemas
   - Setup environment variables
   - Create project structure

2. **Review with Team:**
   - Verify API credentials available
   - Confirm timeline acceptable
   - Review architecture decisions

3. **Begin Implementation:**
   - Follow plan document step-by-step
   - Test each component before moving forward
   - Document any issues or changes

---

## 📚 Related Documentation

- V1 System: `documentation/context/mylo-tool-calling.md`
- V2 Tools: `lib/tools/*.ts`
- V2 Chat API: `app/api/search/route.ts`
- Agents Workflow: `AGENTS.md`

---

## 📞 Questions & Support

**Before Implementation:**
- ❓ Do we have Seats.aero API access?
- ❓ Do we have Amadeus API credentials?
- ❓ Which Amadeus environment (test/prod)?
- ❓ Acceptable response time (<5s)?
- ❓ API budget per month?

**Technical Questions:**
- See research document for detailed analysis
- See plan document for implementation details

---

**Last Updated:** 31. Oktober 2024  
**Next Review:** After Phase 0 completion
