# 📊 Status Management Guide

## Overview
Every feature and bug has a clear status badge that shows its current state and location in the workflow.

## Status Badges & Locations

### Feature Development
| Status | Badge | Location | Description |
|--------|-------|----------|-------------|
| PLANNED | 📍 `PLANNED` | `/planned/` | Feature specified, awaiting start |
| ACTIVE | 🚀 `ACTIVE` | `/active/` | Currently in development |
| COMPLETED | ✅ `COMPLETED` | `/completed/` | Finished and archived |

### Bugfix Management
| Status | Badge | Location | Description |
|--------|-------|----------|-------------|
| REPORTED | 🔴 `REPORTED` | `/reported/` | New bug, needs triage |
| INVESTIGATING | 🔍 `INVESTIGATING` | `/investigating/` | Being analyzed/fixed |
| RESOLVED | ✅ `RESOLVED` | `/resolved/` | Fixed and verified |

## Status Badge Format

Every document starts with a prominent status section:

```markdown
> ### [Icon] Current Status: `STATUS_NAME`
> **Location:** `/directory/item-name/`
> **Last Updated:** YYYY-MM-DD
```

## Workflow Transitions

### Feature Development
```
📍 PLANNED → 🚀 ACTIVE → ✅ COMPLETED
```
When transitioning:
1. Update status badge in `spec.md`
2. Move entire folder to new location
3. Update STATUS.md in both directories
4. Add/update progress tracking files

### Bugfix Management
```
🔴 REPORTED → 🔍 INVESTIGATING → ✅ RESOLVED
```
When transitioning:
1. Update status badge in `report.md`
2. Move entire folder to new location
3. Update STATUS.md in both directories
4. Add analysis/solution documents

## STATUS.md Files

Each directory contains a `STATUS.md` with:
- Overview of all items in that status
- Quick statistics
- Priority/severity breakdown
- Process reminders

## Best Practices

### Daily Updates
- Check `/active/` and `/investigating/` daily
- Update progress files
- Keep status badges current

### Status Transitions
- Always update badge BEFORE moving folders
- Document reason for transition
- Update both source and destination STATUS.md

### AI Agent Instructions
When working on features/bugs:
1. Check current status first
2. Update status when changing phases
3. Keep STATUS.md files synchronized
4. Reference status in commit messages

## Quick Commands

### Check All Active Work
```bash
ls documentation-v2/workflows/feature-development/active/
ls documentation-v2/workflows/bugfix-management/investigating/
```

### Find Items by Status
```bash
grep -r "Current Status: \`ACTIVE\`" documentation-v2/
grep -r "Current Status: \`INVESTIGATING\`" documentation-v2/
```

## Status Priority Matrix

### Features
- 🚀 **ACTIVE** - Highest attention
- 📍 **PLANNED** - Review weekly
- ✅ **COMPLETED** - Reference only

### Bugs
- 🔍 **INVESTIGATING** - Highest attention
- 🔴 **REPORTED** - Triage daily
- ✅ **RESOLVED** - Reference only

---

*Consistent status tracking ensures clear communication and prevents work from being forgotten or duplicated.*