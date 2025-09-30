# 🐛 Bugfix Management Workflow

## 🎯 Overview
Systematic approach to identifying, analyzing, and resolving bugs in the codebase. Each bug follows a structured lifecycle: **Reported** → **Investigating** → **Resolved**.

## 📁 Directory Structure

```
bugfix-management/
├── README.md              # This file
├── reported/             # New bugs awaiting triage
│   └── [bug-id]/
│       ├── report.md     # Bug report with reproduction
│       └── context.md    # Related code/feature context
├── investigating/        # Bugs being analyzed/fixed
│   └── [bug-id]/
│       ├── report.md     # Original bug report
│       ├── analysis.md   # Root cause analysis
│       ├── fix-plan.md   # Implementation strategy
│       └── progress.md   # Fix progress tracking
└── resolved/            # Fixed bugs (archive)
    └── [bug-id]/
        ├── report.md     # Original report
        ├── solution.md   # Final solution
        └── postmortem.md # Lessons learned
```

## 🔄 Bug Lifecycle

### 1️⃣ Reported Phase (`/reported/`)
- Create folder with bug ID (e.g., `bug-001-auth-failure`)
- Write detailed bug report
- Gather context from related features
- Assign priority and severity

### 2️⃣ Investigating Phase (`/investigating/`)
- Move bug folder from reported
- Perform root cause analysis
- Create fix implementation plan
- Track progress during fixing

### 3️⃣ Resolved Phase (`/resolved/`)
- Move to resolved after verification
- Document final solution
- Create postmortem if critical
- Archive for future reference

## 📝 Document Templates

### Bug Report Template (`report.md`)
```markdown
# Bug Report: [Short Description]

> ### 🔴 Current Status: `REPORTED` | `INVESTIGATING` | `RESOLVED`
> **Location:** `/reported/` | `/investigating/` | `/resolved/`
> **Last Updated:** YYYY-MM-DD

**Bug ID:** bug-XXX-description
**Reported:** YYYY-MM-DD
**Severity:** Critical | High | Medium | Low
**Priority:** P0 | P1 | P2 | P3
**Affected Features:** List affected areas

## Description
Clear description of the bug.

## Reproduction Steps
1. Step 1
2. Step 2
3. Expected: What should happen
4. Actual: What happens instead

## Environment
- Browser/OS:
- Version:
- User Type:

## Error Messages
```
Paste any error messages here
```

## Screenshots/Videos
Attach if available

## Impact
- Users affected:
- Features broken:
- Workaround available: Yes/No

## Related Issues
- Links to related bugs
- Related features
```

### Analysis Template (`analysis.md`)
```markdown
# Root Cause Analysis: [Bug ID]

> ### 🔍 Current Status: `INVESTIGATING`
> **Location:** `/investigating/[bug-id]/`
> **Started:** YYYY-MM-DD

**Analyst:** Name/AI Agent

## Investigation Summary
What was discovered during investigation.

## Root Cause
The actual cause of the bug.

## Affected Code
- File: path/to/file.ts:line
- Function: functionName()
- Related: other/file.ts

## Stack Trace Analysis
```
Detailed stack trace if applicable
```

## Dependencies
- Components affected
- Data flow issues
- Integration points

## Fix Strategy
Proposed approach to fix the bug.

## Risk Assessment
- Regression risk: High/Medium/Low
- Testing needed: Unit/Integration/E2E

## Cross-References
→ [Related Feature](../../feature-development/completed/feature-name/)
→ [Stack Documentation](../../../stack/nextjs-convex/)
→ [Pattern Library](../../../patterns/error-handling/)
```

### Fix Plan Template (`fix-plan.md`)
```markdown
# Fix Implementation Plan: [Bug ID]

## Approach
Detailed fix approach.

## Changes Required
1. [ ] File1: Specific change
2. [ ] File2: Specific change
3. [ ] Tests: Add/update tests

## Verification Steps
1. [ ] Reproduce bug first
2. [ ] Apply fix
3. [ ] Verify fix works
4. [ ] Check for regressions
5. [ ] Run test suite

## Code References
- Current broken code: file:line
- Similar working pattern: file:line
- Test location: test/file.test.ts

## Rollback Plan
How to rollback if fix causes issues.
```

## 🚀 Bug Fixing Process

### Step 1: Triage
1. Review new bugs in `/reported/`
2. Verify reproduction steps
3. Assign severity and priority
4. Move to `/investigating/` when starting

### Step 2: Analysis
1. Reproduce the bug locally
2. Debug to find root cause
3. Document in `analysis.md`
4. Check related features/patterns

### Step 3: Planning
1. Create `fix-plan.md`
2. Review similar fixes in `/resolved/`
3. Check documentation for patterns
4. Estimate impact and risk

### Step 4: Implementation
1. Follow fix plan systematically
2. Update `progress.md` regularly
3. Write/update tests
4. Verify fix thoroughly

### Step 5: Resolution
1. Confirm bug is fixed
2. Run regression tests
3. Document solution
4. Move to `/resolved/`

## 🔍 Best Practices

### Bug ID Naming
- Format: `bug-XXX-short-description`
- Examples: `bug-001-login-timeout`, `bug-002-data-sync-error`
- Keep descriptive but concise

### Priority Levels
- **P0**: Critical - System down, data loss
- **P1**: High - Major feature broken
- **P2**: Medium - Feature degraded
- **P3**: Low - Minor issue, cosmetic

### Cross-Referencing
Always link to:
- Related feature documentation
- Stack/technology docs
- Similar resolved bugs
- Pattern library solutions

### Code Analysis
- Include file paths with line numbers
- Reference specific functions/methods
- Link to relevant commits
- Show before/after code snippets

## 🔗 Integration Points

### With Feature Development
- Check `/feature-development/active/` for related work
- Reference completed features for context
- Coordinate fixes with ongoing development

### With Stack Documentation
- → [Next.js Patterns](../../stack/nextjs-convex/)
- → [Convex Debugging](../../stack/convex/debugging.md)
- → [Error Handling](../../patterns/error-handling/)

### With Testing
- Unit test patterns
- Integration test requirements
- E2E test scenarios

## 📊 Bug Metrics

Track these metrics:
- Time to resolution
- Bug recurrence rate
- Most affected areas
- Root cause patterns

## 🚨 Emergency Procedures

For critical production bugs:
1. Create bug report immediately
2. Skip to `/investigating/`
3. Apply hotfix if needed
4. Document thoroughly after
5. Conduct postmortem

## 🛠️ Debugging Tools

### For Next.js/React
```bash
# Check build errors
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### For Convex
```bash
# Check Convex logs
npx convex logs

# Debug functions
npx convex dashboard
```

### Browser DevTools
- Console errors
- Network tab
- React DevTools
- Redux DevTools

---

*This workflow ensures systematic bug resolution with proper documentation and learning from each fix.*