# 🗺️ Mylo Travel Concierge v2 - Master Implementation Plan

> **Project Overview:** Migration from existing Travel Concierge to enhanced Scira-based architecture with Seats.Aero integration and comprehensive miles/points optimization.

**Created:** 2025-01-29
**Status:** Planning Phase
**Estimated Total Time:** 12-18 days
**Priority:** High

---

## 📋 Executive Summary

This master plan outlines the complete transformation of the Scira codebase into Mylo Travel Concierge v2, a specialized AI-powered travel assistant focused on award travel, miles optimization, and premium cabin upgrades.

### Current State ✅
- [x] Database on Neon PostgreSQL configured
- [x] Drizzle migrations executed
- [x] .env.local configured with API keys
- [x] Localhost development environment running

### Target State 🎯
- AI Travel Concierge specialized in:
  - Award flight search (Seats.Aero)
  - Miles & points optimization
  - Business/First class upgrades
  - Transfer partner recommendations
  - Redemption value analysis

---

## 🗂️ Phase Overview

| Phase | Name | Priority | Effort | Status | Dependencies |
|-------|------|----------|--------|--------|--------------|
| **1** | Environment Config Fix | 🔴 Critical | 1-2 hours | Planned | Database ✅ |
| **2** | Seats.Aero Integration | 🔴 High | 3-5 days | Planned | Phase 1 |
| **3** | Flight Search Enhancement | 🟡 Medium | 2-3 days | Planned | Phase 1, 2 |
| **4** | Miles & Points Logic | 🟡 Med-High | 4-6 days | Planned | Phase 1, 2, 3 |
| **5** | Travel Concierge Branding | 🟢 Medium | 2-3 days | Planned | Phase 1-4 |

**Total Estimated Time:** 12-18 days (can be parallelized with multiple Droids)

---

## 📍 Phase Details

### Phase 1: Environment Config Fix 🔴
**File:** [`phase-1-environment-config-fix/spec.md`](./phase-1-environment-config-fix/spec.md)

**Goal:** Make app functional with minimal API keys

**Key Changes:**
- Refactor `env/server.ts` to make most keys optional
- Add runtime validation for critical keys
- Conditional tool loading based on available keys
- Update `.env.example` with categorized keys

**Deliverables:**
- ✅ App starts with only DATABASE_URL + AUTH_SECRET + 1 AI Provider
- ✅ Helpful error messages for missing critical keys
- ✅ Tools load conditionally based on API key availability

**Effort:** 1-2 hours
**Blocking:** No - can start immediately

---

### Phase 2: Seats.Aero Integration 🔴
**File:** [`phase-2-seats-aero-integration/spec.md`](./phase-2-seats-aero-integration/spec.md)

**Goal:** Core award flight search functionality

**Key Features:**
- Seats.Aero API integration
- Award availability search tool
- UI component for results display
- System prompt for travel context

**Deliverables:**
- ✅ `seats_aero_search` tool functional
- ✅ Award search results display in chat
- ✅ Travel-specific system prompts
- ✅ Error handling & fallbacks

**Effort:** 3-5 days
**Blocking:** Phase 1 must complete first

**Open Questions:**
- [ ] Seats.Aero API access - how to obtain?
- [ ] Rate limits and pricing?
- [ ] Caching policy?

---

### Phase 3: Flight Search Enhancement 🟡
**File:** [`phase-3-flight-search-enhancement/spec.md`](./phase-3-flight-search-enhancement/spec.md)

**Goal:** Cash price flight search + comparison

**Key Features:**
- Amadeus Flight Offers API integration
- Cash price search tool
- Shared Amadeus client (token caching)
- Cash vs Award comparison view

**Deliverables:**
- ✅ `search_flights` tool functional
- ✅ Refactored flight tracker to use shared client
- ✅ Comparison UI component
- ✅ Price sorting and filtering

**Effort:** 2-3 days
**Blocking:** Phase 1, 2 (for comparison feature)

**Advantages:**
- Amadeus API key already available
- Existing flight tracker code as reference
- Clear API documentation

---

### Phase 4: Miles & Points Logic 🟡
**File:** [`phase-4-miles-points-logic/spec.md`](./phase-4-miles-points-logic/spec.md)

**Goal:** Intelligent optimization engine

**Key Features:**
- Redemption value calculator
- Transfer partner optimizer
- Sweet spots database
- Routing rules engine

**Deliverables:**
- ✅ Miles calculator tool
- ✅ Transfer optimizer tool
- ✅ Sweet spots finder tool
- ✅ JSON data files (programs, partners, sweet spots)
- ✅ Analysis UI components

**Effort:** 4-6 days
**Blocking:** Phase 1, 2, 3 (for complete integration)

**Data Requirements:**
- Loyalty program redemption charts
- Transfer partner relationships
- Known sweet spots compilation

---

### Phase 5: Travel Concierge Branding 🟢
**File:** [`phase-5-travel-concierge-branding/spec.md`](./phase-5-travel-concierge-branding/spec.md)

**Goal:** Transform generic app into branded travel concierge

**Key Features:**
- New landing page
- Quick actions for common queries
- Search categories (Award/Cash/Hotels)
- Onboarding tour
- Updated system prompts

**Deliverables:**
- ✅ Landing page with travel focus
- ✅ Quick actions component
- ✅ Onboarding tour
- ✅ Branding assets (logo, colors)
- ✅ SEO optimization

**Effort:** 2-3 days
**Blocking:** Phase 1-4 (all features should work first)

**Optional Enhancements:**
- User profiles
- Favorite routes
- Price alerts
- Trip planning workspace

---

## 🚀 Execution Strategy

### Option A: Sequential (Single Droid)
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
│         │         │         │         └─ 2-3 days
│         │         │         └─ 4-6 days
│         │         └─ 2-3 days
│         └─ 3-5 days
└─ 1-2 hours

Total: 12-18 days
```

**Pros:** Clear dependencies, lower coordination overhead
**Cons:** Slower to market

---

### Option B: Parallel (Multiple Droids) ⚡ RECOMMENDED
```
Droid 1: Phase 1 → Phase 2 (Core functionality)
Droid 2: Phase 3 (Can start after Phase 1, parallel with Phase 2)
Droid 3: Phase 4 Data Collection → Implementation (after Phase 2)
Droid 4: Phase 5 (after Phase 2 core is working)

Timeline:
Day 1:      Phase 1 complete
Day 2-6:    Phase 2 (Droid 1) + Phase 3 start (Droid 2) + Phase 4 data (Droid 3)
Day 7-9:    Phase 3 complete + Phase 4 implementation + Phase 5 start
Day 10-12:  Phase 4 complete + Phase 5 complete

Total: 10-12 days (25% faster)
```

**Pros:** Faster delivery, efficient resource utilization
**Cons:** Requires coordination, potential merge conflicts

---

## 📊 Resource Requirements

### API Keys & Services

| Service | Phase | Priority | Status | Cost |
|---------|-------|----------|--------|------|
| PostgreSQL (Neon) | 1 | 🔴 Critical | ✅ Done | Free tier |
| XAI / Groq / Anthropic | 1 | 🔴 Critical | ✅ Done | Pay-per-use |
| Tavily / Exa | 1 | 🟡 Important | ✅ Done | Free tier |
| **Seats.Aero** | 2 | 🔴 Critical | ⚠️  TBD | Unknown |
| Amadeus API | 3 | 🟡 Important | ✅ Done | Free tier |
| Google Maps | Optional | 🟢 Nice-to-have | ✅ Done | Free tier |

**Action Items:**
- [ ] Research Seats.Aero API access (pricing, documentation)
- [ ] Verify Amadeus API tier limits
- [ ] Document all API rate limits

---

### Data Requirements

| Data Type | Phase | Source | Status |
|-----------|-------|--------|--------|
| Loyalty Program Charts | 4 | Research + Community | ⚠️  To collect |
| Transfer Partners | 4 | Credit card websites | ⚠️  To collect |
| Sweet Spots | 4 | Award travel blogs | ⚠️  To collect |
| Airline Alliances | 4 | Public data | ✅ Easy |

**Data Collection Strategy:**
- Use existing award travel resources (The Points Guy, AwardHacker)
- Community contributions post-launch
- Regular updates via JSON files

---

## ✅ Success Metrics

### Phase 1 Success
- [ ] App starts with minimal config
- [ ] Clear error messages
- [ ] Basic chat functionality works

### Phase 2 Success  
- [ ] Award search returns real results
- [ ] UI displays flights correctly
- [ ] User can interact naturally

### Phase 3 Success
- [ ] Cash search functional
- [ ] Comparison view works
- [ ] Price sorting accurate

### Phase 4 Success
- [ ] Calculator gives accurate values
- [ ] Transfer recommendations sensible
- [ ] Sweet spots helpful

### Phase 5 Success
- [ ] Landing page compelling
- [ ] Branding consistent
- [ ] Onboarding helpful

### Overall Launch Criteria
- [ ] All 5 phases complete
- [ ] No critical bugs
- [ ] Mobile responsive
- [ ] Performance acceptable (<5s search)
- [ ] Documentation complete

---

## 🎯 Milestones

### Milestone 1: MVP Ready (Phase 1 + 2 complete)
**Target:** Day 6
**Criteria:**
- Minimal environment config working
- Award search functional
- Basic user can search flights

### Milestone 2: Feature Complete (Phase 1-4 complete)
**Target:** Day 12
**Criteria:**
- All search features working
- Calculator and optimizer functional
- Data files populated

### Milestone 3: Launch Ready (All phases complete)
**Target:** Day 15
**Criteria:**
- Branding complete
- Polish done
- Ready for beta users

---

## 🔄 Post-Launch Roadmap

### Short-term (Week 2-4)
- User feedback collection
- Bug fixes
- Performance optimization
- Data refinement

### Medium-term (Month 2-3)
- Hotel search integration
- Price alerts system
- User profiles & preferences
- Advanced routing strategies

### Long-term (Month 4+)
- Mobile app
- Community features
- Trip planning workspace
- Integration with booking platforms

---

## 📚 Documentation Structure

```
documentation/workflows/feature-development/planned/
├── MASTER-PLAN.md (this file)
├── phase-1-environment-config-fix/
│   └── spec.md
├── phase-2-seats-aero-integration/
│   └── spec.md
├── phase-3-flight-search-enhancement/
│   └── spec.md
├── phase-4-miles-points-logic/
│   └── spec.md
└── phase-5-travel-concierge-branding/
    └── spec.md
```

Each phase spec includes:
- Detailed technical design
- Implementation code examples
- File structure
- Testing checklists
- Dependencies
- Risk mitigation

---

## 🤝 Collaboration Guidelines

### For Individual Droids
1. Read full phase spec before starting
2. Check dependencies are met
3. Update progress in spec file
4. Test thoroughly before marking complete
5. Document any deviations

### For Parallel Work
1. **Communication:** Update shared status doc
2. **Code Conflicts:** Use feature branches
3. **Integration:** Test combined features
4. **Blockers:** Escalate immediately

### Git Workflow
```bash
# Branch naming
feature/phase-1-env-config
feature/phase-2-seats-aero
feature/phase-3-flight-search
feature/phase-4-miles-logic
feature/phase-5-branding

# Commit messages
feat(phase-1): make API keys optional
feat(phase-2): add Seats.Aero search tool
fix(phase-2): handle API timeout errors
docs(phase-4): add sweet spots data
```

---

## ⚠️ Risks & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Seats.Aero API unavailable | 🔴 High | Medium | Alternative providers (ExpertFlyer) |
| Rate limits too restrictive | 🟡 Medium | Medium | Caching, user limits |
| Data accuracy issues | 🟡 Medium | High | Timestamps, disclaimers |
| Performance degradation | 🟢 Low | Low | Monitoring, optimization |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API costs too high | 🟡 Medium | Medium | Free tier analysis, pricing model |
| User adoption low | 🟡 Medium | Low | Marketing, onboarding |
| Competition | 🟢 Low | High | Unique features, UX focus |

---

## 📞 Next Actions

### Immediate (This Week)
1. ✅ Review all phase specs
2. ✅ Approve master plan
3. [ ] Research Seats.Aero API access
4. [ ] Assign Droids to phases
5. [ ] Start Phase 1 implementation

### Short-term (Week 2)
1. [ ] Complete Phase 1
2. [ ] Begin Phase 2 & 3 in parallel
3. [ ] Start data collection for Phase 4
4. [ ] Design branding assets for Phase 5

### Medium-term (Week 3-4)
1. [ ] Complete all phases
2. [ ] Integration testing
3. [ ] Beta user testing
4. [ ] Launch preparation

---

## 📖 References

### Internal Documentation
- [Project README](../../../../README.md)
- [CLAUDE.md](../../../../CLAUDE.md) - AI agent instructions
- [Feature Development Workflow](../README.md)

### External Resources
- [Seats.Aero](https://seats.aero/)
- [Amadeus API Docs](https://developers.amadeus.com/)
- [The Points Guy](https://thepointsguy.com/)
- [AwardHacker](https://www.awardhacker.com/)

### Tech Stack
- Next.js 15 (App Router)
- Vercel AI SDK
- Drizzle ORM + PostgreSQL
- ShadCN UI + Tailwind CSS
- Better Auth

---

## 🎉 Launch Checklist

### Pre-Launch
- [ ] All phases complete
- [ ] Testing complete
- [ ] Documentation updated
- [ ] API keys secured (not exposed)
- [ ] Error tracking configured
- [ ] Analytics setup

### Launch Day
- [ ] Deploy to production
- [ ] Smoke tests pass
- [ ] Monitoring active
- [ ] Support ready

### Post-Launch
- [ ] Collect user feedback
- [ ] Monitor errors
- [ ] Track usage metrics
- [ ] Plan iteration 1

---

**Last Updated:** 2025-01-29
**Maintained By:** Development Team
**Status:** Ready for Approval ✅

---

> 💡 **Pro Tip:** Use this master plan as the single source of truth. Update it as phases complete and requirements evolve. Each Droid should reference this before starting work.
