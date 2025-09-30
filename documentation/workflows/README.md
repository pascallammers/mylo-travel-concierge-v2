# 🔄 Development Workflows

## Overview
Structured workflows for systematic development, bug fixing, and project management.

## Available Workflows

### 📋 [Feature Development](./feature-development/)
Complete lifecycle management for new features:
- **Planning** → **Active Development** → **Completion**
- Specification templates
- Progress tracking
- Feature archival

### 🐛 [Bugfix Management](./bugfix-management/)
Systematic approach to bug resolution:
- **Reported** → **Investigating** → **Resolved**
- Root cause analysis
- Fix verification
- Postmortem documentation

### 🚀 [Project Setup](./project-setup/)
Initial project configuration and bootstrapping:
- Environment setup
- Stack configuration
- Tool installation

### 🔍 [Debugging](./debugging/)
Troubleshooting guides and debug strategies:
- Common issues
- Debug tools
- Performance profiling

## Workflow Integration

### Features ↔ Bugs
- Bugs discovered during feature development → Create in bugfix-management
- Features needed for bug resolution → Create in feature-development
- Cross-reference related items in documentation

### Development Flow
```
1. New Work Arrives
   ├─ Feature Request → feature-development/planned/
   └─ Bug Report → bugfix-management/reported/

2. Active Work
   ├─ Feature → feature-development/active/
   └─ Bug → bugfix-management/investigating/

3. Completion
   ├─ Feature → feature-development/completed/
   └─ Bug → bugfix-management/resolved/
```

## Best Practices

### Documentation
- Always create documentation before starting work
- Update progress regularly (daily for active items)
- Complete documentation before marking as done

### Cross-Referencing
- Link related features and bugs
- Reference stack documentation
- Include pattern library examples

### Prioritization
- **P0/Critical**: Immediate action required
- **P1/High**: Next sprint priority
- **P2/Medium**: Current quarter
- **P3/Low**: Backlog

## Quick Links

### Active Work
- [Active Features](./feature-development/active/)
- [Investigating Bugs](./bugfix-management/investigating/)

### Planning
- [Planned Features](./feature-development/planned/)
- [Reported Bugs](./bugfix-management/reported/)

### Archives
- [Completed Features](./feature-development/completed/)
- [Resolved Bugs](./bugfix-management/resolved/)

---

*These workflows ensure consistent, documented, and trackable development processes across all project activities.*