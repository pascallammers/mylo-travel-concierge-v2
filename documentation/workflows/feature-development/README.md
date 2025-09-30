# 📋 Feature Development Workflow

## 🎯 Overview
This workflow manages the complete lifecycle of features from planning through implementation to completion. Features progress through three distinct stages: **Planned** → **Active** → **Completed**.

## 📁 Directory Structure

```
feature-development/
├── README.md           # This file
├── planned/           # Features awaiting implementation
│   └── [feature-name]/
│       ├── spec.md         # Technical specification
│       └── requirements.md # Business requirements
├── active/            # Features currently in development
│   └── [feature-name]/
│       ├── spec.md         # Technical specification
│       ├── progress.md     # Implementation tracker
│       └── tasks.md        # Detailed task breakdown
└── completed/         # Finished features (archive)
    └── [feature-name]/
        ├── spec.md         # Final specification
        ├── summary.md      # Implementation summary
        └── lessons.md      # Lessons learned
```

## 🔄 Feature Lifecycle

### 1️⃣ Planning Phase (`/planned/`)
- Create feature folder with clear name (kebab-case)
- Write technical specification (`spec.md`)
- Define requirements and acceptance criteria
- Estimate complexity and timeline

### 2️⃣ Active Development (`/active/`)
- Move feature folder from planned to active
- Add `progress.md` to track implementation
- Create `tasks.md` with detailed task breakdown
- Update progress daily during development

### 3️⃣ Completion (`/completed/`)
- Move feature folder to completed
- Create `summary.md` with implementation details
- Document lessons learned
- Archive for future reference

## 📝 Document Templates

### Specification Template (`spec.md`)
```markdown
# [Feature Name] Specification

> ### 📍 Current Status: `PLANNED` | `ACTIVE` | `COMPLETED`
> **Location:** `/planned/` | `/active/` | `/completed/`
> **Last Updated:** YYYY-MM-DD

**Priority:** High | Medium | Low
**Estimated Effort:** Small | Medium | Large

## Overview
Brief description of the feature.

## Technical Design
- Architecture decisions
- Implementation approach
- Integration points

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Success Criteria
What defines completion?
```

### Progress Template (`progress.md`)
```markdown
# [Feature Name] Progress

> ### 🚀 Current Status: `ACTIVE`
> **Location:** `/active/[feature-name]/`
> **Started:** YYYY-MM-DD
> **Target Completion:** YYYY-MM-DD

**Current Phase:** 1 of N

## Status Summary
Current implementation status.

## Completed Tasks
- [x] Task 1
- [x] Task 2

## In Progress
- [ ] Current task

## Blockers
Any blocking issues.

## Next Steps
What comes next.
```

## 🚀 Usage Guidelines

### For AI Agents
1. Check `/active/` for current work
2. Read spec and progress files for context
3. Update progress.md after each session
4. Reference completed features for patterns

### For Developers
1. Always start features in `/planned/`
2. Move to `/active/` when starting work
3. Keep progress.md updated daily
4. Move to `/completed/` when done

## 🔍 Best Practices

### Naming Conventions
- Use kebab-case: `user-authentication`, `payment-integration`
- Be descriptive but concise
- Include feature type if relevant: `feature-`, `bugfix-`, `refactor-`

### Documentation Standards
- Keep specs concise and technical
- Update progress in real-time
- Include code references in summaries
- Document decisions and trade-offs

### Progress Tracking
- Update status at least daily when active
- Include blockers immediately when found
- Reference relevant commits and PRs
- Track actual vs estimated effort

## 🔗 Related Documentation
- → [Project Setup](../project-setup/)
- → [Bugfix Management](../bugfix-management/) - For handling bugs in features
- → [Debugging Workflows](../debugging/)
- → [Stack Documentation](../../stack/)
- → [Pattern Library](../../patterns/)

## 📊 Feature Status Overview

### Currently Active
Check the `/active/` directory for features in development.

### Recently Completed
Check `/completed/` for recently finished features and their implementation details.

### Upcoming Features
Check `/planned/` for the feature backlog and priorities.

---

*This workflow ensures systematic feature development with clear tracking and documentation at each stage.*